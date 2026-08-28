package convey

import (
	"net/http"
	"time"
)

// Option is a configuration function for customizing the Convey client.
type Option func(*Client)

// WithBaseURL sets a custom base API URL.
func WithBaseURL(url string) Option {
	return func(c *Client) {
		if norm, err := NormalizeBaseURL(url); err == nil {
			c.http.baseURL = norm
		} else {
			c.http.baseURL = url
		}
	}
}

// WithEnvironment sets the target environment preset (e.g. EnvProduction, EnvUS, EnvEU, EnvStaging, EnvLocal, EnvSandbox).
func WithEnvironment(env string) Option {
	return func(c *Client) {
		if resolved, err := ResolveEnvironmentURL(env); err == nil {
			c.http.baseURL = resolved
		}
	}
}

// WithTimeout sets the default request timeout.
func WithTimeout(timeout time.Duration) Option {
	return func(c *Client) {
		c.http.timeout = timeout
	}
}

// WithMaxRetries sets the maximum retry attempts for rate limits and transient server errors.
func WithMaxRetries(maxRetries int) Option {
	return func(c *Client) {
		c.http.maxRetries = maxRetries
	}
}

// WithHTTPClient sets a custom standard http.Client.
func WithHTTPClient(client *http.Client) Option {
	return func(c *Client) {
		if client != nil {
			c.http.httpClient = client
		}
	}
}

// WithSandbox routes all requests to simulated zero-cost sandbox environment.
func WithSandbox(isSandbox bool) Option {
	return func(c *Client) {
		c.http.isSandbox = isSandbox
	}
}

// WithTeamID sets the default tenant team scoping header.
func WithTeamID(teamID string) Option {
	return func(c *Client) {
		c.http.teamID = teamID
	}
}

// WithDefaultHeader adds a default header to all outbound requests.
func WithDefaultHeader(key, value string) Option {
	return func(c *Client) {
		if c.http.defaultHeaders == nil {
			c.http.defaultHeaders = make(map[string]string)
		}
		c.http.defaultHeaders[key] = value
	}
}

// WithMiddleware appends custom interceptors to the HTTP transport chain.
func WithMiddleware(middlewares ...Middleware) Option {
	return func(c *Client) {
		c.http.middlewares = append(c.http.middlewares, middlewares...)
	}
}

// WithRateLimiter configures client-side token bucket rate smoothing.
func WithRateLimiter(rps float64, burst int) Option {
	return func(c *Client) {
		c.http.rateLimiter = NewRateLimiter(rps, burst)
	}
}
