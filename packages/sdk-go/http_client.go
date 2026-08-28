package convey

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"math/rand"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	defaultTimeout    = 10 * time.Second
	defaultMaxRetries = 3
	initialBackoffMs  = 100
	maxBackoffMs      = 10000
	sdkVersion        = "1.0.0"
)

// HTTPClient is the core resilient HTTP engine for the Convey Go SDK.
type HTTPClient struct {
	baseURL        string
	apiKey         string
	isSandbox      bool
	teamID         string
	timeout        time.Duration
	maxRetries     int
	httpClient     *http.Client
	defaultHeaders map[string]string
	userAgent      string
	middlewares    []Middleware
	rateLimiter    *RateLimiter
}

// NewDefaultTransport returns a high-performance tuned HTTP transport with socket pooling.
func NewDefaultTransport() *http.Transport {
	return &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   5 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          100,
		MaxIdleConnsPerHost:   100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   5 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		ResponseHeaderTimeout: 15 * time.Second,
	}
}

// RequestOptions allows overriding options per request.
type RequestOptions struct {
	BaseURL        string
	Timeout        *time.Duration
	MaxRetries     *int
	IdempotencyKey string
	Traceparent    string
	Headers        map[string]string
	Query          map[string]string
	IsSandbox      *bool
}

// RequestOption is a functional argument for RequestOptions.
type RequestOption func(*RequestOptions)

// WithReqBaseURL sets per-request base URL override.
func WithReqBaseURL(u string) RequestOption {
	return func(o *RequestOptions) {
		o.BaseURL = u
	}
}

// Request executes an authenticated HTTP request with full-jitter exponential retries and distributed tracing.
func (c *HTTPClient) Request(ctx context.Context, method, path string, body interface{}, opts *RequestOptions, target interface{}) error {
	effectiveBaseURL := c.baseURL
	if opts != nil && opts.BaseURL != "" {
		effectiveBaseURL = opts.BaseURL
	}

	if strings.TrimSpace(effectiveBaseURL) == "" {
		return &ConfigurationError{
			BaseError: BaseError{Message: "Convey client requires a valid base URL. Please specify WithBaseURL(), WithEnvironment(), or set CONVEY_BASE_URL environment variable"},
		}
	}

	reqURL, err := url.Parse(effectiveBaseURL)
	if err != nil {
		return &NetworkError{
			BaseError: BaseError{Message: fmt.Sprintf("invalid base URL: %s", err.Error())},
			Cause:     err,
		}
	}

	cleanPath := path
	if !strings.HasPrefix(cleanPath, "/") {
		cleanPath = "/" + cleanPath
	}
	reqURL.Path = strings.TrimRight(reqURL.Path, "/") + cleanPath

	// Query params
	if opts != nil && len(opts.Query) > 0 {
		q := reqURL.Query()
		for k, v := range opts.Query {
			if v != "" {
				q.Set(k, v)
			}
		}
		reqURL.RawQuery = q.Encode()
	}

	// Payload serialization
	var bodyBytes []byte
	if body != nil {
		switch b := body.(type) {
		case []byte:
			bodyBytes = b
		case string:
			bodyBytes = []byte(b)
		default:
			data, err := json.Marshal(body)
			if err != nil {
				return &ValidationError{
					APIError: APIError{
						BaseError: BaseError{Message: fmt.Sprintf("failed to serialize request payload: %s", err.Error())},
					},
				}
			}
			bodyBytes = data
		}
	}

	maxRetries := c.maxRetries
	if opts != nil && opts.MaxRetries != nil {
		maxRetries = *opts.MaxRetries
	}

	timeout := c.timeout
	if opts != nil && opts.Timeout != nil {
		timeout = *opts.Timeout
	}

	traceparentHeader := GenerateTraceparent()
	if opts != nil && opts.Traceparent != "" {
		traceparentHeader = CreateChildTraceparent(opts.Traceparent)
	}

	idempotencyKey := ""
	if opts != nil && opts.IdempotencyKey != "" {
		idempotencyKey = opts.IdempotencyKey
	} else if method != http.MethodGet && method != http.MethodHead && method != http.MethodOptions {
		idempotencyKey = "sdk_" + GenerateULID()
	}

	isSandbox := c.isSandbox
	if opts != nil && opts.IsSandbox != nil {
		isSandbox = *opts.IsSandbox
	}

	// Transport with middlewares
	transport := c.httpClient.Transport
	if len(c.middlewares) > 0 {
		transport = NewMiddlewareChain(transport, c.middlewares...)
	}

	attempt := 0
	for {
		attempt++

		if c.rateLimiter != nil {
			c.rateLimiter.Wait()
		}

		reqCtx := ctx
		var cancel context.CancelFunc
		if timeout > 0 {
			reqCtx, cancel = context.WithTimeout(ctx, timeout)
		}

		var bodyReader io.Reader
		if len(bodyBytes) > 0 {
			bodyReader = bytes.NewReader(bodyBytes)
		}

		httpReq, err := http.NewRequestWithContext(reqCtx, method, reqURL.String(), bodyReader)
		if err != nil {
			if cancel != nil {
				cancel()
			}
			return &NetworkError{
				BaseError: BaseError{Message: fmt.Sprintf("failed to create request: %s", err.Error())},
				Cause:     err,
			}
		}

		// Headers
		httpReq.Header.Set("Accept", "application/json")
		httpReq.Header.Set("User-Agent", c.userAgent)
		httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
		httpReq.Header.Set("x-api-key", c.apiKey)
		httpReq.Header.Set("traceparent", traceparentHeader)

		if bodyBytes != nil {
			httpReq.Header.Set("Content-Type", "application/json")
		}

		if idempotencyKey != "" {
			httpReq.Header.Set("Idempotency-Key", idempotencyKey)
		}

		if isSandbox {
			httpReq.Header.Set("x-convey-sandbox", "true")
		}

		if c.teamID != "" {
			httpReq.Header.Set("x-convey-team", c.teamID)
		}

		for k, v := range c.defaultHeaders {
			httpReq.Header.Set(k, v)
		}

		if opts != nil && len(opts.Headers) > 0 {
			for k, v := range opts.Headers {
				httpReq.Header.Set(k, v)
			}
		}

		// Execute
		resp, err := transport.RoundTrip(httpReq)

		if err != nil {
			if cancel != nil {
				cancel()
			}

			// Context timeout check
			if errors.Is(reqCtx.Err(), context.DeadlineExceeded) || errors.Is(ctx.Err(), context.DeadlineExceeded) {
				return &TimeoutError{
					BaseError: BaseError{Message: fmt.Sprintf("request timed out after %v", timeout)},
					TimeoutMs: int(timeout.Milliseconds()),
				}
			}

			// Context cancel check
			if errors.Is(reqCtx.Err(), context.Canceled) || errors.Is(ctx.Err(), context.Canceled) {
				return &BaseError{Message: "request cancelled by caller context"}
			}

			// Retry on network failures
			if attempt <= maxRetries {
				backoff := computeBackoff(attempt)
				select {
				case <-time.After(backoff):
					continue
				case <-ctx.Done():
					return ctx.Err()
				}
			}

			return &NetworkError{
				BaseError: BaseError{Message: fmt.Sprintf("network request failed: %s", err.Error())},
				Cause:     err,
			}
		}

		respBody, readErr := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		if cancel != nil {
			cancel()
		}

		if readErr != nil {
			return &NetworkError{
				BaseError: BaseError{Message: fmt.Sprintf("failed to read response body: %s", readErr.Error())},
				Cause:     readErr,
			}
		}

		// Success (2xx)
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			if target != nil && len(respBody) > 0 {
				if err := json.Unmarshal(respBody, target); err != nil {
					return &ValidationError{
						APIError: APIError{
							BaseError: BaseError{Message: fmt.Sprintf("failed to parse JSON response: %s", err.Error())},
							RawBody:   string(respBody),
						},
					}
				}
			}
			return nil
		}

		// Retry condition: 429 or 500, 502, 503, 504
		isTransient5xx := resp.StatusCode == 500 || resp.StatusCode == 502 || resp.StatusCode == 503 || resp.StatusCode == 504
		isRateLimit := resp.StatusCode == 429
		canRetry := (isTransient5xx || isRateLimit) && attempt <= maxRetries

		if canRetry {
			var delay time.Duration
			retryAfterHeader := resp.Header.Get("Retry-After")
			if retryAfterHeader != "" {
				if seconds, err := strconv.Atoi(retryAfterHeader); err == nil && seconds >= 0 {
					delay = time.Duration(seconds) * time.Second
				} else if targetTime, err := http.ParseTime(retryAfterHeader); err == nil {
					delay = time.Until(targetTime)
					if delay < 0 {
						delay = 0
					}
				}
			}

			if delay == 0 {
				delay = computeBackoff(attempt)
			}

			select {
			case <-time.After(delay):
				continue
			case <-ctx.Done():
				return ctx.Err()
			}
		}

		return c.deserializeError(resp, respBody, traceparentHeader)
	}
}

func computeBackoff(attempt int) time.Duration {
	base := float64(initialBackoffMs) * math.Pow(2, float64(attempt-1))
	if base > float64(maxBackoffMs) {
		base = float64(maxBackoffMs)
	}
	jitter := rand.Float64() * base
	return time.Duration(jitter) * time.Millisecond
}

func (c *HTTPClient) deserializeError(resp *http.Response, rawBody []byte, traceparent string) error {
	statusCode := resp.StatusCode
	errorCode := "API_ERROR"
	message := fmt.Sprintf("Convey HTTP %d %s", statusCode, resp.Status)
	var details interface{}

	var parsed map[string]interface{}
	if err := json.Unmarshal(rawBody, &parsed); err == nil && parsed != nil {
		if errObj, ok := parsed["error"].(map[string]interface{}); ok {
			if code, ok := errObj["code"].(string); ok {
				errorCode = code
			}
			if msg, ok := errObj["message"].(string); ok {
				message = msg
			}
			details = errObj["details"]
		} else if errMsg, ok := parsed["error"].(string); ok {
			message = errMsg
		} else if msg, ok := parsed["message"].(string); ok {
			message = msg
			if code, ok := parsed["code"].(string); ok {
				errorCode = code
			}
			details = parsed["details"]
		}
	} else if len(rawBody) > 0 {
		strBody := string(rawBody)
		if len(strBody) > 500 {
			strBody = strBody[:500]
		}
		message = strBody
	}

	apiErr := APIError{
		BaseError:   BaseError{Message: message},
		StatusCode:  statusCode,
		ErrorCode:   errorCode,
		Details:     details,
		RequestID:   resp.Header.Get("x-request-id"),
		Traceparent: traceparent,
		Headers:     resp.Header,
		RawBody:     string(rawBody),
	}

	switch statusCode {
	case 400:
		return &ValidationError{APIError: apiErr}
	case 401:
		return &AuthenticationError{APIError: apiErr}
	case 403:
		return &ForbiddenError{APIError: apiErr}
	case 404:
		return &NotFoundError{APIError: apiErr}
	case 409:
		return &ConflictError{APIError: apiErr}
	case 429:
		var retrySec *int
		if s := resp.Header.Get("Retry-After"); s != "" {
			if val, err := strconv.Atoi(s); err == nil {
				retrySec = &val
			}
		}
		return &RateLimitError{APIError: apiErr, RetryAfterSeconds: retrySec}
	default:
		return &apiErr
	}
}
