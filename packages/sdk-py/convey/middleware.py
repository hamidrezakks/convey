"""
convey.middleware
Extensible request/response interceptor pipeline for the Convey Python SDK.
"""

from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional


class ConveyMiddleware:
    """Base interface for request, response, and error interceptors."""

    def on_request(self, context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Invoked before the HTTP request is dispatched. Can mutate headers/body."""
        return context

    def on_response(self, response: Any, duration_ms: float) -> Optional[Any]:
        """Invoked after receiving a successful response."""
        return response

    def on_error(self, error: Exception, duration_ms: float) -> None:
        """Invoked on HTTP or network error."""
        pass


class MiddlewarePipeline:
    """Manages ordered execution of middlewares."""

    def __init__(self, middlewares: Optional[List[ConveyMiddleware]] = None) -> None:
        self.middlewares: List[ConveyMiddleware] = list(middlewares or [])

    def use(self, middleware: ConveyMiddleware) -> None:
        self.middlewares.append(middleware)

    def run_on_request(self, context: Dict[str, Any]) -> Dict[str, Any]:
        current = dict(context)
        for mw in self.middlewares:
            res = mw.on_request(current)
            if res is not None and isinstance(res, dict):
                current = res
        return current

    def run_on_response(self, response: Any, duration_ms: float) -> Any:
        current = response
        for mw in reversed(self.middlewares):
            res = mw.on_response(current, duration_ms)
            if res is not None:
                current = res
        return current

    def run_on_error(self, error: Exception, duration_ms: float) -> None:
        for mw in self.middlewares:
            try:
                mw.on_error(error, duration_ms)
            except Exception:
                pass
