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
from typing import Any, Dict, Optional, Tuple, Union

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
from convey.utils.trace import create_child_traceparent, generate_traceparent
from convey.utils.ulid import generate_ulid

DEFAULT_BASE_URL = "http://localhost:3000"
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
        timeout: float = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_MAX_RETRIES,
        is_sandbox: Optional[bool] = None,
        team_id: Optional[str] = None,
        default_headers: Optional[Dict[str, str]] = None,
    ) -> None:
        if not api_key or not isinstance(api_key, str) or not api_key.strip():
            raise ConveyError("ConveyClient requires a valid apiKey. API Key is required.")

        self.api_key = api_key.strip()
        self.base_url = (base_url or os.getenv("CONVEY_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")
        self.timeout = timeout
        self.max_retries = max_retries
        self.is_sandbox = is_sandbox if is_sandbox is not None else self.api_key.startswith("sk_test_")
        self.team_id = team_id
        self.default_headers = default_headers or {}
        self.user_agent = _build_user_agent()
        self._opener = urllib.request.build_opener()

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
    ) -> Any:
        """Execute request with full-jitter exponential backoff."""
        clean_path = path if path.startswith("/") else f"/{path}"
        url = f"{self.base_url}{clean_path}"

        if query:
            clean_query = {k: str(v) for k, v in query.items() if v is not None}
            if clean_query:
                url += "?" + urllib.parse.urlencode(clean_query)

        max_attempts = (max_retries if max_retries is not None else self.max_retries) + 1
        req_timeout = timeout if timeout is not None else self.timeout

        traceparent_header = create_child_traceparent(traceparent) if traceparent else generate_traceparent()

        if idempotency_key:
            idem_key = idempotency_key
        elif method.upper() not in ("GET", "HEAD", "OPTIONS"):
            idem_key = f"sdk_{generate_ulid()}"
        else:
            idem_key = None

        sandbox_flag = is_sandbox if is_sandbox is not None else self.is_sandbox

        req_headers: Dict[str, str] = {
            "Accept": "application/json",
            "Authorization": f"Bearer {self.api_key}",
            "x-api-key": self.api_key,
            "traceparent": traceparent_header,
            "User-Agent": self.user_agent,
        }

        if idem_key:
            req_headers["Idempotency-Key"] = idem_key

        if sandbox_flag:
            req_headers["x-convey-sandbox"] = "true"

        if self.team_id:
            req_headers["x-convey-team"] = self.team_id

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

        attempt = 0
        while True:
            attempt += 1

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

                    if not raw_text.strip():
                        return {}
                    try:
                        return json.loads(raw_text)
                    except json.JSONDecodeError:
                        return raw_text

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

                raise self._deserialize_error(status_code, raw_text, resp_headers, traceparent_header)

            except (urllib.error.URLError, TimeoutError, OSError) as err:
                if isinstance(err, TimeoutError) or "timed out" in str(err).lower():
                    if attempt >= max_attempts:
                        raise ConveyTimeoutError(f"Request timed out after {req_timeout}s", req_timeout) from err
                elif attempt >= max_attempts:
                    raise ConveyNetworkError(f"Network request failed: {str(err)}", err) from err

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
            retry_after_str = headers.get("retry-after") or headers.get("Retry-After")
            retry_after_sec = None
            if retry_after_str:
                try:
                    retry_after_sec = int(float(retry_after_str))
                except ValueError:
                    pass
            return ConveyRateLimitError(retry_after_seconds=retry_after_sec, **kwargs)

        return ConveyApiError(**kwargs)


class AsyncHttpClient:
    """Asynchronous HTTP client engine running natively on asyncio."""

    def __init__(
        self,
        api_key: str,
        base_url: Optional[str] = None,
        timeout: float = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_MAX_RETRIES,
        is_sandbox: Optional[bool] = None,
        team_id: Optional[str] = None,
        default_headers: Optional[Dict[str, str]] = None,
    ) -> None:
        self._sync = SyncHttpClient(
            api_key=api_key,
            base_url=base_url,
            timeout=timeout,
            max_retries=max_retries,
            is_sandbox=is_sandbox,
            team_id=team_id,
            default_headers=default_headers,
        )

    async def request(self, *args: Any, **kwargs: Any) -> Any:
        """Asynchronously dispatch request using thread pool executor."""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.request(*args, **kwargs))
