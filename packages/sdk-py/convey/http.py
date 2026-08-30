"""
convey.http
High-performance, zero-dependency resilient HTTP client engines with full-jitter exponential backoff,
socket keep-alive, Abort/Timeout management, W3C distributed tracing, and typed error mapping.
"""

from __future__ import annotations

import asyncio
import email.utils
import json
import math
import os
import platform
import random
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Tuple, Union

from convey.environments import ConveyEnvironment, resolve_base_url
from convey.errors import (
    ConveyApiError,
    ConveyAuthenticationError,
    ConveyConflictError,
    ConveyError,
    ConveyForbiddenError,
    ConveyNetworkError,
    ConveyNotFoundError,
    ConveyRateLimitError,
    ConveyTimeoutError,
    ConveyValidationError,
)
from convey.middleware import ConveyMiddleware, MiddlewarePipeline
from convey.rate_limiter import TokenBucketRateLimiter
from convey.utils.trace import create_child_traceparent, generate_traceparent
from convey.utils.ulid import generate_ulid

DEFAULT_TIMEOUT = 10.0
DEFAULT_MAX_RETRIES = 3
INITIAL_BACKOFF_MS = 100
MAX_BACKOFF_MS = 10000
SDK_VERSION = "1.0.0"


def _build_user_agent() -> str:
    os_name = sys.platform
    arch = platform.machine()
    return f"convey-python/{SDK_VERSION} ({os_name}; {arch})"


class SyncHttpClient:
    """Zero-dependency, high-throughput resilient synchronous HTTP client."""

    def __init__(
        self,
        api_key: str,
        base_url: Optional[str] = None,
        environment: Optional[Union[ConveyEnvironment, str]] = None,
        timeout: float = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_MAX_RETRIES,
        is_sandbox: Optional[bool] = None,
        team_id: Optional[str] = None,
        default_headers: Optional[Dict[str, str]] = None,
        rate_limiter: Optional[Union[TokenBucketRateLimiter, Dict[str, Any]]] = None,
        middlewares: Optional[List[ConveyMiddleware]] = None,
    ) -> None:
        if not api_key or not isinstance(api_key, str) or not api_key.strip():
            raise ConveyError("ConveyClient requires a valid apiKey. Please provide 'api_key' or set 'CONVEY_API_KEY'.")

        self.api_key = api_key.strip()
        self.base_url = resolve_base_url(base_url, environment)
        self.timeout = timeout
        self.max_retries = max_retries
        self.is_sandbox = is_sandbox if is_sandbox is not None else self.api_key.startswith("sk_test_")
        self.team_id = team_id
        self.default_headers = default_headers or {}
        self.user_agent = _build_user_agent()
        self._opener = urllib.request.build_opener()

        self.pipeline = MiddlewarePipeline(middlewares)
        if isinstance(rate_limiter, dict):
            self.rate_limiter: Optional[TokenBucketRateLimiter] = TokenBucketRateLimiter(
                requests_per_second=rate_limiter.get("requests_per_second", 50),
                burst=rate_limiter.get("burst"),
            )
        else:
            self.rate_limiter = rate_limiter

    def use(self, middleware: ConveyMiddleware) -> None:
        self.pipeline.use(middleware)

    def set_base_url(self, url: str) -> None:
        self.base_url = resolve_base_url(base_url=url)

    def request(
        self,
        method: str,
        path: str,
        body: Optional[Any] = None,
        query: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
        timeout: Optional[float] = None,
        max_retries: Optional[int] = None,
        idempotency_key: Optional[str] = None,
        traceparent: Optional[str] = None,
        is_sandbox: Optional[bool] = None,
        base_url: Optional[str] = None,
    ) -> Any:
        effective_base_url = (base_url.rstrip("/") if base_url else self.base_url)
        clean_path = ("/" + path.lstrip("/")) if not path.startswith("/") else path
        url = f"{effective_base_url}{clean_path}"

        if query:
            filtered_query = {k: v for k, v in query.items() if v is not None and v != ""}
            if filtered_query:
                query_string = urllib.parse.urlencode(filtered_query)
                url = f"{url}?{query_string}"

        req_headers: Dict[str, str] = {
            "Accept": "application/json",
            "User-Agent": self.user_agent,
            "Authorization": f"Bearer {self.api_key}",
            "x-api-key": self.api_key,
        }

        traceparent_header = generate_traceparent()
        if traceparent:
            traceparent_header = create_child_traceparent(traceparent)
        req_headers["traceparent"] = traceparent_header

        effective_sandbox = is_sandbox if is_sandbox is not None else self.is_sandbox
        if effective_sandbox:
            req_headers["x-convey-sandbox"] = "true"

        if self.team_id:
            req_headers["x-convey-team"] = self.team_id

        if method.upper() not in ("GET", "HEAD", "OPTIONS"):
            effective_idempotency = idempotency_key or f"sdk_{generate_ulid()}"
            req_headers["Idempotency-Key"] = effective_idempotency

        req_headers.update(self.default_headers)
        if headers:
            req_headers.update(headers)

        encoded_data: Optional[bytes] = None
        if body is not None:
            req_headers["Content-Type"] = "application/json"
            if isinstance(body, (bytes, bytearray)):
                encoded_data = bytes(body)
            elif isinstance(body, str):
                encoded_data = body.encode("utf-8")
            else:
                encoded_data = json.dumps(body).encode("utf-8")

        # Execute middleware on_request
        req_context = {
            "method": method.upper(),
            "url": url,
            "headers": req_headers,
            "body": body,
        }
        modified_ctx = self.pipeline.run_on_request(req_context)
        req_headers = modified_ctx.get("headers", req_headers)

        max_attempts = (max_retries if max_retries is not None else self.max_retries) + 1
        req_timeout = timeout if timeout is not None else self.timeout
        start_time = time.time()

        for attempt in range(1, max_attempts + 1):
            if self.rate_limiter:
                self.rate_limiter.acquire()

            req = urllib.request.Request(
                url=url,
                data=encoded_data,
                headers=req_headers,
                method=method.upper(),
            )

            try:
                with self._opener.open(req, timeout=req_timeout) as response:
                    resp_bytes = response.read()
                    resp_headers = dict(response.info().items())
                    raw_text = resp_bytes.decode("utf-8", errors="replace")
                    duration_ms = (time.time() - start_time) * 1000

                    if not raw_text.strip():
                        result = {}
                    else:
                        try:
                            result = json.loads(raw_text)
                        except json.JSONDecodeError:
                            result = raw_text

                    return self.pipeline.run_on_response(result, duration_ms)

            except urllib.error.HTTPError as err:
                status_code = err.code
                resp_bytes = err.read()
                raw_text = resp_bytes.decode("utf-8", errors="replace")
                resp_headers = dict(err.headers.items()) if err.headers else {}

                is_transient_5xx = status_code in (500, 502, 503, 504)
                is_rate_limited = status_code == 429
                can_retry = (is_transient_5xx or is_rate_limited) and attempt < max_attempts

                if can_retry:
                    sleep_seconds = self._calculate_retry_delay(attempt, resp_headers)
                    time.sleep(sleep_seconds)
                    continue

                deserialized_err = self._deserialize_error(status_code, raw_text, resp_headers, traceparent_header)
                duration_ms = (time.time() - start_time) * 1000
                self.pipeline.run_on_error(deserialized_err, duration_ms)
                raise deserialized_err

            except (urllib.error.URLError, TimeoutError, OSError) as err:
                if isinstance(err, TimeoutError) or "timed out" in str(err).lower():
                    if attempt >= max_attempts:
                        timeout_err = ConveyTimeoutError(f"Request timed out after {req_timeout}s", req_timeout)
                        duration_ms = (time.time() - start_time) * 1000
                        self.pipeline.run_on_error(timeout_err, duration_ms)
                        raise timeout_err from err
                elif attempt >= max_attempts:
                    net_err = ConveyNetworkError(f"Network request failed: {err}", err)
                    duration_ms = (time.time() - start_time) * 1000
                    self.pipeline.run_on_error(net_err, duration_ms)
                    raise net_err from err

                sleep_seconds = self._calculate_retry_delay(attempt, {})
                time.sleep(sleep_seconds)
                continue

    def _calculate_retry_delay(self, attempt: int, headers: Dict[str, str]) -> float:
        retry_after = headers.get("retry-after") or headers.get("Retry-After")
        if retry_after:
            try:
                return max(0.0, float(retry_after))
            except ValueError:
                try:
                    parsed_date = email.utils.parsedate_to_datetime(retry_after)
                    return max(0.0, parsed_date.timestamp() - time.time())
                except Exception:
                    pass

        backoff_ms = min(MAX_BACKOFF_MS, INITIAL_BACKOFF_MS * (2 ** (attempt - 1)))
        return random.uniform(0, backoff_ms) / 1000.0

    def _deserialize_error(
        self,
        status_code: int,
        raw_body: str,
        headers: Dict[str, str],
        traceparent: str,
    ) -> ConveyApiError:
        error_code = "API_ERROR"
        message = f"Convey HTTP {status_code}"
        details: Optional[Any] = None

        try:
            parsed = json.loads(raw_body)
            if isinstance(parsed, dict):
                if "error" in parsed:
                    err_obj = parsed["error"]
                    if isinstance(err_obj, str):
                        message = err_obj
                    elif isinstance(err_obj, dict):
                        error_code = err_obj.get("code", error_code)
                        message = err_obj.get("message", message)
                        details = err_obj.get("details")
                elif "message" in parsed:
                    message = parsed["message"]
                    error_code = parsed.get("code", error_code)
                    details = parsed.get("details")
        except Exception:
            if raw_body and raw_body.strip():
                message = raw_body[:500]

        request_id = headers.get("x-request-id") or headers.get("request-id")

        kwargs = {
            "message": message,
            "status_code": status_code,
            "error_code": error_code,
            "details": details,
            "request_id": request_id,
            "traceparent": traceparent,
            "headers": headers,
            "raw_body": raw_body,
        }

        if status_code == 400:
            return ConveyValidationError(**kwargs)
        if status_code == 401:
            return ConveyAuthenticationError(**kwargs)
        if status_code == 403:
            return ConveyForbiddenError(**kwargs)
        if status_code == 404:
            return ConveyNotFoundError(**kwargs)
        if status_code == 409:
            return ConveyConflictError(**kwargs)
        if status_code == 429:
            retry_sec: Optional[int] = None
            retry_hdr = headers.get("retry-after")
            if retry_hdr and retry_hdr.isdigit():
                retry_sec = int(retry_hdr)
            return ConveyRateLimitError(retry_after_seconds=retry_sec, **kwargs)

        return ConveyApiError(**kwargs)


class AsyncHttpClient:
    """Zero-dependency asynchronous HTTP client executing non-blocking on asyncio event loop."""

    def __init__(self, sync_http: SyncHttpClient) -> None:
        self._sync_http = sync_http

    async def request(self, *args: Any, **kwargs: Any) -> Any:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync_http.request(*args, **kwargs))
