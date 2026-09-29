package gateway

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/recover"
	"github.com/hamidrezakks/convey/apps/gateway/internal/customer"
	"go.uber.org/fx"
)

type failure struct {
	status        int
	code, message string
}

func (f *failure) Error() string   { return f.message }
func invalid(message string) error { return &failure{400, "INVALID_REQUEST", message} }
func respond(c fiber.Ctx, err error) error {
	var f *failure
	if !errors.As(err, &f) {
		f = &failure{502, "UPSTREAM_UNAVAILABLE", "upstream request failed"}
	}
	return c.Status(f.status).JSON(fiber.Map{"error": fiber.Map{"code": f.code, "message": f.message}})
}

func NewClient() *http.Client {
	return &http.Client{Timeout: 15 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }, Transport: &http.Transport{
		Proxy: nil, MaxIdleConns: 128, MaxIdleConnsPerHost: 64, MaxConnsPerHost: 128, IdleConnTimeout: 90 * time.Second,
		TLSHandshakeTimeout: 5 * time.Second, ResponseHeaderTimeout: 10 * time.Second, DisableCompression: true,
		DialContext: (&net.Dialer{Timeout: 3 * time.Second, KeepAlive: 30 * time.Second}).DialContext,
	}}
}
func NewResolver(c Config, client *http.Client) (customer.Resolver, error) {
	if !strings.HasPrefix(c.CustomerPath, "/") || strings.HasPrefix(c.CustomerPath, "//") || strings.ContainsAny(c.CustomerPath, "?#\\") || strings.Contains(c.CustomerPath, "..") {
		return nil, errors.New("CUSTOMER_LOOKUP_PATH must be an absolute path")
	}
	if c.CustomerMode == "single" && strings.Count(c.CustomerPath, "{userId}") != 1 {
		return nil, errors.New("single lookup path must contain {userId} exactly once")
	}
	if c.CustomerMode == "bulk" && strings.Contains(c.CustomerPath, "{") {
		return nil, errors.New("bulk lookup path cannot have placeholders")
	}
	return &customer.HTTP{Client: client, BaseURL: c.CustomerURL, Token: c.CustomerToken, Mode: c.CustomerMode, Path: c.CustomerPath}, nil
}
func allowed(method, path string) bool {
	for _, pattern := range routes[method] {
		p := strings.Split(pattern, "/")
		parts := strings.Split(path, "/")
		if len(p) != len(parts) {
			continue
		}
		match := true
		for i, s := range p {
			if strings.HasPrefix(s, ":") {
				if parts[i] == "" {
					match = false
				}
			} else if s != parts[i] {
				match = false
			}
		}
		if match {
			return true
		}
	}
	return false
}
func canonical(raw string) (string, error) {
	path, err := url.PathUnescape(raw)
	if err != nil {
		return "", invalid("invalid path")
	}
	// Encoded separators/dots and alternate normalization must not bypass route boundaries.
	if path != raw || strings.Contains(path, "\\") || strings.Contains(path, "//") {
		return "", invalid("noncanonical path")
	}
	path = strings.TrimSuffix(path, "/")
	for _, s := range strings.Split(path, "/") {
		if s == "." || s == ".." {
			return "", invalid("noncanonical path")
		}
	}
	return path, nil
}

var hopHeaders = []string{"Connection", "Proxy-Connection", "Keep-Alive", "Proxy-Authenticate", "Proxy-Authorization", "Te", "Trailer", "Transfer-Encoding", "Upgrade"}

func stripHop(h http.Header) {
	for _, value := range h.Values("Connection") {
		for _, name := range strings.Split(value, ",") {
			h.Del(strings.TrimSpace(name))
		}
	}
	for _, name := range hopHeaders {
		h.Del(name)
	}
}
func headers(c fiber.Ctx) http.Header {
	h := make(http.Header)
	c.Request().Header.VisitAll(func(k, v []byte) { h.Add(string(k), string(v)) })
	stripHop(h)
	for name := range h {
		lower := strings.ToLower(name)
		if lower == "forwarded" || strings.HasPrefix(lower, "x-forwarded-") || strings.HasPrefix(lower, "x-convey-tenant") || lower == "x-convey-team" {
			h.Del(name)
		}
	}
	h.Del("Host")
	h.Del("Content-Length")
	return h
}
func request(ctx context.Context, client *http.Client, cfg Config, method, path string, h http.Header, body []byte) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, method, strings.TrimRight(cfg.ConveyURL, "/")+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header = h
	return client.Do(req)
}
func readResponse(resp *http.Response, limit int64) ([]byte, error) {
	defer resp.Body.Close()
	b, err := io.ReadAll(io.LimitReader(resp.Body, limit+1))
	if err != nil || int64(len(b)) > limit {
		return nil, errors.New("upstream body exceeds limit or is unreadable")
	}
	return b, nil
}
func relay(c fiber.Ctx, resp *http.Response) error {
	b, err := readResponse(resp, 32<<20)
	if err != nil {
		return respond(c, err)
	}
	stripHop(resp.Header)
	resp.Header.Del("Content-Length")
	for k, values := range resp.Header {
		for _, v := range values {
			c.Response().Header.Add(k, v)
		}
	}
	return c.Status(resp.StatusCode).Send(b)
}
func authenticate(ctx context.Context, c fiber.Ctx, cfg Config, client *http.Client) (customer.Scope, error) {
	h := make(http.Header)
	for _, key := range []string{"Authorization", "X-API-Key", "X-Convey-Sandbox", "X-Convey-Environment"} {
		if v := c.Get(key); v != "" {
			h.Set(key, v)
		}
	}
	if h.Get("Authorization") == "" && h.Get("X-API-Key") == "" {
		return customer.Scope{}, &failure{401, "UNAUTHORIZED", "API credential required"}
	}
	resp, err := request(ctx, client, cfg, "GET", "/v1/auth/session", h, nil)
	if err != nil {
		return customer.Scope{}, err
	}
	b, err := readResponse(resp, 64<<10)
	if err != nil {
		return customer.Scope{}, err
	}
	if resp.StatusCode == 401 || resp.StatusCode == 403 {
		return customer.Scope{}, &failure{resp.StatusCode, "UNAUTHORIZED", "credential rejected"}
	}
	if resp.StatusCode != 200 {
		return customer.Scope{}, errors.New("auth unavailable")
	}
	var identity struct {
		customer.Scope
		Role string `json:"role"`
	}
	if json.Unmarshal(b, &identity) != nil || identity.TenantID == "" || identity.Team == "" {
		return customer.Scope{}, errors.New("invalid auth identity")
	}
	if identity.Role != "DEVELOPER" && identity.Role != "ORG_ADMIN" {
		return customer.Scope{}, &failure{403, "FORBIDDEN", "credential does not permit message submission"}
	}
	return identity.Scope, nil
}
func NewApp(cfg Config, client *http.Client, resolver customer.Resolver) *fiber.App {
	app := fiber.New(fiber.Config{AppName: "Convey recipient gateway", BodyLimit: 4 << 20, ReadTimeout: 15 * time.Second, WriteTimeout: 20 * time.Second, IdleTimeout: 60 * time.Second, ErrorHandler: func(c fiber.Ctx, err error) error {
		var f *fiber.Error
		if errors.As(err, &f) {
			return respond(c, &failure{f.Code, "HTTP_ERROR", f.Message})
		}
		return respond(c, err)
	}})
	app.Use(recover.New())
	app.Get("/healthz", func(c fiber.Ctx) error { return c.JSON(fiber.Map{"status": "ok"}) })
	// Readiness reports listener availability. Dependency failures surface on requests.
	app.Get("/readyz", func(c fiber.Ctx) error { return c.JSON(fiber.Map{"status": "ready"}) })
	app.Use(func(c fiber.Ctx) error {
		start := time.Now()
		err := handle(c, cfg, client, resolver)
		// Never log URLs, request bodies, credentials, user IDs, or customer addresses.
		slog.Info("gateway request", "method", c.Method(), "status", c.Response().StatusCode(), "duration_ms", time.Since(start).Milliseconds())
		return err
	})
	return app
}
func handle(c fiber.Ctx, cfg Config, client *http.Client, resolver customer.Resolver) error {
	path, err := canonical(string(c.Request().URI().PathOriginal()))
	if err != nil {
		return respond(c, err)
	}
	if !allowed(c.Method(), path) {
		return respond(c, &failure{404, "NOT_FOUND", "route not exposed by gateway"})
	}
	ctx, cancel := context.WithTimeout(c.Context(), cfg.Timeout)
	defer cancel()
	body := c.Body()
	h := headers(c)
	if c.Method() == "POST" && (path == "/v1/messages" || path == "/v1/messages/bulk") {
		if encoding := c.Get("Content-Encoding"); encoding != "" && encoding != "identity" {
			return respond(c, &failure{415, "UNSUPPORTED_ENCODING", "message submissions require uncompressed JSON"})
		}
		if !strings.HasPrefix(strings.ToLower(c.Get("Content-Type")), "application/json") {
			return respond(c, &failure{415, "UNSUPPORTED_MEDIA_TYPE", "message submissions require application/json"})
		}
		scope, err := authenticate(ctx, c, cfg, client)
		if err != nil {
			return respond(c, err)
		}
		body, err = enrich(ctx, resolver, scope, body, path == "/v1/messages/bulk")
		if err != nil {
			return respond(c, err)
		}
		h.Del("Content-Encoding")
		h.Del("Content-MD5")
		h.Del("Digest")
		h.Set("Content-Type", "application/json")
	}
	target := path
	if q := string(c.Request().URI().QueryString()); q != "" {
		target += "?" + q
	}
	resp, err := request(ctx, client, cfg, c.Method(), target, h, body)
	if err != nil {
		return respond(c, err)
	}
	return relay(c, resp)
}
func RegisterLifecycle(lc fx.Lifecycle, app *fiber.App, cfg Config, client *http.Client, shutdown fx.Shutdowner) {
	var listener net.Listener
	lc.Append(fx.Hook{OnStart: func(ctx context.Context) error {
		var err error
		listener, err = net.Listen("tcp", cfg.Listen)
		if err != nil {
			return err
		}
		go func() {
			if err := app.Listener(listener, fiber.ListenConfig{DisableStartupMessage: true}); err != nil {
				slog.Error("gateway listener stopped")
				_ = shutdown.Shutdown(fx.ExitCode(1))
			}
		}()
		return nil
	}, OnStop: func(ctx context.Context) error {
		err := app.ShutdownWithContext(ctx)
		client.CloseIdleConnections()
		return err
	}})
}
