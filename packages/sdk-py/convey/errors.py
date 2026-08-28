"""
convey.errors
Strongly-typed exception hierarchy for the Convey Python SDK.
"""

from typing import Any, Dict, Optional


class ConveyError(Exception):
    """Base exception for all errors raised by the Convey SDK."""
    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class ConveyApiError(ConveyError):
    """Exception raised when Convey API returns a non-2xx status code."""
    def __init__(
        self,
        message: str,
        status_code: int,
        error_code: str = "API_ERROR",
        details: Optional[Any] = None,
        request_id: Optional[str] = None,
        traceparent: Optional[str] = None,
        headers: Optional[Dict[str, str]] = None,
        raw_body: Optional[str] = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.error_code = error_code
        self.details = details
        self.request_id = request_id
        self.traceparent = traceparent
        self.headers = headers or {}
        self.raw_body = raw_body

    def __str__(self) -> str:
        if self.error_code and self.error_code != "API_ERROR":
            return f"convey: [{self.error_code}] {self.message} (HTTP {self.status_code})"
        return f"convey: HTTP {self.status_code} - {self.message}"


class ConveyValidationError(ConveyApiError):
    """Raised on HTTP 400 Bad Request / schema validation errors."""
    pass


class ConveyAuthenticationError(ConveyApiError):
    """Raised on HTTP 401 Unauthorized (missing or invalid API key)."""
    pass


class ConveyForbiddenError(ConveyApiError):
    """Raised on HTTP 403 Forbidden (permission or tier denial)."""
    pass


class ConveyNotFoundError(ConveyApiError):
    """Raised on HTTP 404 Not Found."""
    pass


class ConveyConflictError(ConveyApiError):
    """Raised on HTTP 409 Conflict (e.g. idempotency key mismatch)."""
    pass


class ConveyRateLimitError(ConveyApiError):
    """Raised on HTTP 429 Too Many Requests."""
    def __init__(
        self,
        message: str,
        status_code: int = 429,
        error_code: str = "RATE_LIMIT_EXCEEDED",
        retry_after_seconds: Optional[int] = None,
        **kwargs: Any,
    ) -> None:
        super().__init__(message, status_code=status_code, error_code=error_code, **kwargs)
        self.retry_after_seconds = retry_after_seconds


class ConveyTimeoutError(ConveyError):
    """Raised when an HTTP request exceeds the configured timeout."""
    def __init__(self, message: str, timeout_seconds: float) -> None:
        super().__init__(message)
        self.timeout_seconds = timeout_seconds


class ConveyNetworkError(ConveyError):
    """Raised on socket disconnections, DNS resolution failures, or low-level transport errors."""
    def __init__(self, message: str, cause: Optional[BaseException] = None) -> None:
        super().__init__(message)
        self.cause = cause


class ConveySecurityError(ConveyError):
    """Raised when cryptographic verification (e.g. webhook HMAC signature) fails."""
    pass
