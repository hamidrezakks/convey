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
		c.http.baseURL = url
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
