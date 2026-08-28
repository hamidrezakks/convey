package convey

import "net/http"

// Middleware allows intercepting and mutating outbound HTTP requests and responses.
type Middleware func(req *http.Request, next func(*http.Request) (*http.Response, error)) (*http.Response, error)

// MiddlewareChain wraps a slice of middlewares around a base RoundTripper.
type MiddlewareChain struct {
	middlewares []Middleware
	base        http.RoundTripper
}

// NewMiddlewareChain creates a new transport pipeline with interceptors.
func NewMiddlewareChain(base http.RoundTripper, middlewares ...Middleware) *MiddlewareChain {
	if base == nil {
		base = http.DefaultTransport
	}
	return &MiddlewareChain{
		middlewares: middlewares,
		base:        base,
	}
}

// RoundTrip executes the middleware chain in registration order.
func (c *MiddlewareChain) RoundTrip(req *http.Request) (*http.Response, error) {
	var buildChain func(idx int) func(*http.Request) (*http.Response, error)

	buildChain = func(idx int) func(*http.Request) (*http.Response, error) {
		if idx >= len(c.middlewares) {
			return c.base.RoundTrip
		}
		return func(r *http.Request) (*http.Response, error) {
			return c.middlewares[idx](r, buildChain(idx+1))
		}
	}

	return buildChain(0)(req)
}
