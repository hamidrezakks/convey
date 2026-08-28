package convey

import (
	"fmt"
	"net/http"
)

// ConveyError is the base error interface for all Convey SDK errors.
type ConveyError interface {
	error
	ConveyError()
}

// BaseError implements the base error behavior.
type BaseError struct {
	Message string
}

func (e *BaseError) Error() string {
	return e.Message
}

func (e *BaseError) ConveyError() {}

// APIError represents an HTTP error response returned by the Convey API.
type APIError struct {
	BaseError
	StatusCode  int
	ErrorCode   string
	Details     interface{}
	RequestID   string
	Traceparent string
	Headers     http.Header
	RawBody     string
}

func (e *APIError) Error() string {
	if e.ErrorCode != "" && e.ErrorCode != "API_ERROR" {
		return fmt.Sprintf("convey: [%s] %s (HTTP %d)", e.ErrorCode, e.Message, e.StatusCode)
	}
	return fmt.Sprintf("convey: HTTP %d - %s", e.StatusCode, e.Message)
}

// ValidationError represents HTTP 400 Bad Request / schema validation failures.
type ValidationError struct {
	APIError
}

// AuthenticationError represents HTTP 401 Unauthorized errors (invalid or missing API key).
type AuthenticationError struct {
	APIError
}

// ForbiddenError represents HTTP 403 Forbidden errors (insufficient permissions/roles).
type ForbiddenError struct {
	APIError
}

// NotFoundError represents HTTP 404 Not Found errors.
type NotFoundError struct {
	APIError
}

// ConflictError represents HTTP 409 Conflict errors (e.g. idempotency key mismatch).
type ConflictError struct {
	APIError
}

// RateLimitError represents HTTP 429 Too Many Requests errors.
type RateLimitError struct {
	APIError
	RetryAfterSeconds *int
}

// TimeoutError represents a client-side request timeout.
type TimeoutError struct {
	BaseError
	TimeoutMs int
}

// NetworkError represents transport / DNS / socket connectivity failures.
type NetworkError struct {
	BaseError
	Cause error
}

func (e *NetworkError) Unwrap() error {
	return e.Cause
}

// SecurityError represents webhook signature verification or cryptographic failures.
type SecurityError struct {
	BaseError
}

// ConfigurationError represents SDK initialization or configuration validation failures.
type ConfigurationError struct {
	BaseError
}

// Helper predicates

// IsRateLimitError checks if an error is a RateLimitError.
func IsRateLimitError(err error) (*RateLimitError, bool) {
	if rle, ok := err.(*RateLimitError); ok {
		return rle, true
	}
	return nil, false
}

// IsValidationError checks if an error is a ValidationError.
func IsValidationError(err error) (*ValidationError, bool) {
	if ve, ok := err.(*ValidationError); ok {
		return ve, true
	}
	return nil, false
}

// IsConflictError checks if an error is a ConflictError.
func IsConflictError(err error) (*ConflictError, bool) {
	if ce, ok := err.(*ConflictError); ok {
		return ce, true
	}
	return nil, false
}

// IsAuthenticationError checks if an error is an AuthenticationError.
func IsAuthenticationError(err error) (*AuthenticationError, bool) {
	if ae, ok := err.(*AuthenticationError); ok {
		return ae, true
	}
	return nil, false
}
