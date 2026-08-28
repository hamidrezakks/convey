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
	defaultBaseURL      = "http://localhost:3000"
	defaultTimeout      = 10 * time.Second
	defaultMaxRetries   = 3
	initialBackoffMs    = 100
	maxBackoffMs        = 10000
	sdkVersion          = "1.0.0"
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
	Timeout        *time.Duration
	MaxRetries     *int
	IdempotencyKey string
	Traceparent    string
	Headers        map[string]string
	Query          map[string]string
	IsSandbox      *bool
}

// Request executes an authenticated HTTP request with full-jitter exponential retries and distributed tracing.
func (c *HTTPClient) Request(ctx context.Context, method, path string, body interface{}, opts *RequestOptions, target interface{}) error {
	reqURL, err := url.Parse(c.baseURL)
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

	attempt := 0
	for {
		attempt++

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
				BaseError: BaseError{Message: fmt.Sprintf("failed to build HTTP request: %s", err.Error())},
				Cause:     err,
			}
		}

		// Set headers
		httpReq.Header.Set("Accept", "application/json")
		httpReq.Header.Set("Authorization", "Bearer "+c.apiKey)
		httpReq.Header.Set("x-api-key", c.apiKey)
		httpReq.Header.Set("traceparent", traceparentHeader)
		httpReq.Header.Set("User-Agent", c.userAgent)

		if len(bodyBytes) > 0 {
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

		if opts != nil && opts.Headers != nil {
			for k, v := range opts.Headers {
				httpReq.Header.Set(k, v)
			}
		}

		resp, err := c.httpClient.Do(httpReq)
		if err != nil {
			if cancel != nil {
				cancel()
			}

			if errors.Is(ctx.Err(), context.Canceled) || errors.Is(ctx.Err(), context.DeadlineExceeded) {
				return ctx.Err()
			}
			if reqCtx.Err() == context.DeadlineExceeded {
				return &TimeoutError{
					BaseError: BaseError{Message: fmt.Sprintf("request timed out after %s", timeout)},
					TimeoutMs: int(timeout.Milliseconds()),
				}
			}

			// Transient network failure retry
			if attempt <= maxRetries {
				sleepDuration := calculateFullJitter(attempt)
				select {
				case <-ctx.Done():
					return ctx.Err()
				case <-time.After(sleepDuration):
					continue
				}
			}

			return &NetworkError{
				BaseError: BaseError{Message: fmt.Sprintf("network request failed: %s", err.Error())},
				Cause:     err,
			}
		}

		respBytes, readErr := io.ReadAll(resp.Body)
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
			if target == nil || len(respBytes) == 0 {
				return nil
			}

			// If target is *string or *[]byte
			switch t := target.(type) {
			case *string:
				*t = string(respBytes)
				return nil
			case *[]byte:
				*t = respBytes
				return nil
			default:
				if err := json.Unmarshal(respBytes, target); err != nil {
					return &APIError{
						BaseError:   BaseError{Message: fmt.Sprintf("failed to parse JSON response: %s", err.Error())},
						StatusCode:  resp.StatusCode,
						Headers:     resp.Header,
						RawBody:     string(respBytes),
						Traceparent: traceparentHeader,
					}
				}
				return nil
			}
		}

		// Evaluate retry on 429 or transient 5xx (500, 502, 503, 504)
		isTransient5xx := resp.StatusCode == 500 || resp.StatusCode == 502 || resp.StatusCode == 503 || resp.StatusCode == 504
		isRateLimited := resp.StatusCode == 429
		canRetry := (isTransient5xx || isRateLimited) && attempt <= maxRetries

		if canRetry {
			retryAfterHeader := resp.Header.Get("Retry-After")
			var sleepDuration time.Duration
			if retryAfterHeader != "" {
				if seconds, err := strconv.Atoi(retryAfterHeader); err == nil && seconds >= 0 {
					sleepDuration = time.Duration(seconds) * time.Second
				} else if targetTime, err := http.ParseTime(retryAfterHeader); err == nil {
					sleepDuration = time.Until(targetTime)
					if sleepDuration < 0 {
						sleepDuration = 0
					}
				}
			}

			if sleepDuration <= 0 {
				sleepDuration = calculateFullJitter(attempt)
			}

			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(sleepDuration):
				continue
			}
		}

		return c.deserializeError(resp, respBytes, traceparentHeader)
	}
}

func calculateFullJitter(attempt int) time.Duration {
	backoffFactor := math.Pow(2, float64(attempt-1))
	currentMax := math.Min(float64(maxBackoffMs), float64(initialBackoffMs)*backoffFactor)
	sleepMs := rand.Float64() * currentMax
	return time.Duration(sleepMs) * time.Millisecond
}

func (c *HTTPClient) deserializeError(resp *http.Response, bodyBytes []byte, traceparent string) error {
	statusCode := resp.StatusCode
	errorCode := "API_ERROR"
	message := fmt.Sprintf("Convey HTTP %d %s", statusCode, resp.Status)
	var details interface{}
	rawBody := string(bodyBytes)

	var parsed map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &parsed); err == nil {
		if errVal, ok := parsed["error"]; ok {
			switch e := errVal.(type) {
			case string:
				message = e
			case map[string]interface{}:
				if code, ok := e["code"].(string); ok {
					errorCode = code
				}
				if msg, ok := e["message"].(string); ok {
					message = msg
				}
				details = e["details"]
			}
		} else if msgVal, ok := parsed["message"].(string); ok {
			message = msgVal
			if code, ok := parsed["code"].(string); ok {
				errorCode = code
			}
			details = parsed["details"]
		}
	} else if len(rawBody) > 0 {
		if len(rawBody) > 500 {
			message = rawBody[:500]
		} else {
			message = rawBody
		}
	}

	requestID := resp.Header.Get("x-request-id")
	if requestID == "" {
		requestID = resp.Header.Get("request-id")
	}

	apiErr := APIError{
		BaseError:   BaseError{Message: message},
		StatusCode:  statusCode,
		ErrorCode:   errorCode,
		Details:     details,
		RequestID:   requestID,
		Traceparent: traceparent,
		Headers:     resp.Header,
		RawBody:     rawBody,
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
		var retryAfterSec *int
		if headerVal := resp.Header.Get("Retry-After"); headerVal != "" {
			if s, err := strconv.Atoi(headerVal); err == nil {
				retryAfterSec = &s
			}
		}
		return &RateLimitError{APIError: apiErr, RetryAfterSeconds: retryAfterSec}
	default:
		return &apiErr
	}
}
