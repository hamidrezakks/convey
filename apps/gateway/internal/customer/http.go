package customer

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/hamidrezakks/convey/apps/gateway/internal/outbound"
	"net/http"
	"net/url"
	"strings"
	"sync"
)

var ErrNotFound = errors.New("customer not found")
var ErrUnavailable = errors.New("customer lookup unavailable")

// HTTP implements a deliberately small reference protocol; adapt this implementation
// to the customer service, or inject another Resolver through Fx.
type HTTP struct {
	Client                     *outbound.Client
	BaseURL, Token, Mode, Path string
}
type record struct {
	Scope
	UserID     string     `json:"userId"`
	Recipients Recipients `json:"recipients"`
}

func (h *HTTP) Resolve(ctx context.Context, scope Scope, ids []string) (map[string]Recipients, error) {
	if h.Mode == "bulk" {
		return h.bulk(ctx, scope, ids)
	}
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	results := make(map[string]Recipients, len(ids))
	var mu sync.Mutex
	var first error
	jobs := make(chan string)
	var wg sync.WaitGroup
	for range min(8, len(ids)) {
		wg.Go(func() {
			for id := range jobs {
				r, err := h.single(ctx, scope, id)
				mu.Lock()
				if err != nil {
					if first == nil {
						first = err
						cancel()
					}
				} else {
					results[id] = r
				}
				mu.Unlock()
			}
		})
	}
	for _, id := range ids {
		select {
		case jobs <- id:
		case <-ctx.Done():
		}
	}
	close(jobs)
	wg.Wait()
	if first != nil {
		return nil, first
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return results, nil
}
func (h *HTTP) single(ctx context.Context, scope Scope, id string) (Recipients, error) {
	if id == "." || id == ".." || strings.ContainsAny(id, "/\\") {
		return nil, ErrNotFound
	}
	path := strings.ReplaceAll(h.Path, "{userId}", url.PathEscape(id))
	q := url.Values{"team": {scope.Team}}
	body, err := h.request(ctx, scope, "GET", path+"?"+q.Encode(), nil)
	if err != nil {
		return nil, err
	}
	var r record
	if json.Unmarshal(body, &r) != nil || r.UserID != id || r.Scope != scope || r.Recipients == nil {
		return nil, ErrUnavailable
	}
	return r.Recipients, nil
}
func (h *HTTP) bulk(ctx context.Context, scope Scope, ids []string) (map[string]Recipients, error) {
	payload, _ := json.Marshal(struct {
		Scope
		UserIDs []string `json:"userIds"`
	}{scope, ids})
	body, err := h.request(ctx, scope, "POST", h.Path, payload)
	if err != nil {
		return nil, err
	}
	var response struct {
		Customers []record `json:"customers"`
	}
	if json.Unmarshal(body, &response) != nil {
		return nil, ErrUnavailable
	}
	wanted := make(map[string]bool, len(ids))
	for _, id := range ids {
		wanted[id] = true
	}
	out := make(map[string]Recipients, len(ids))
	for _, r := range response.Customers {
		if !wanted[r.UserID] || r.Scope != scope || r.Recipients == nil || out[r.UserID] != nil {
			return nil, ErrUnavailable
		}
		out[r.UserID] = r.Recipients
	}
	if len(out) != len(wanted) {
		return nil, ErrNotFound
	}
	return out, nil
}
func (h *HTTP) request(ctx context.Context, scope Scope, method, path string, body []byte) ([]byte, error) {
	headers := make(http.Header)
	headers.Set("Content-Type", "application/json")
	headers.Set("X-Convey-Tenant-Id", scope.TenantID)
	headers.Set("X-Convey-Team", scope.Team)
	headers.Set("X-Convey-Sandbox", fmt.Sprint(scope.Sandbox))
	if h.Token != "" {
		headers.Set("Authorization", "Bearer "+h.Token)
	}
	resp, err := h.Client.Request(ctx, method, strings.TrimRight(h.BaseURL, "/")+path, headers, body, outbound.CustomerLimit)
	if err != nil {
		return nil, ErrUnavailable
	}
	defer resp.Release()
	if resp.StatusCode == 404 {
		return nil, ErrNotFound
	}
	if resp.StatusCode != 200 {
		return nil, ErrUnavailable
	}
	return append([]byte(nil), resp.Body()...), nil
}
