"""
convey.webhook_handler
Framework webhook adapters (FastAPI, Flask, Django, Starlette) and test fixture generator.
"""

from __future__ import annotations

import json
import time
from typing import Any, Callable, Dict, Optional, Tuple, Union

from convey.errors import ConveySecurityError
from convey.types import ConveyWebhookEvent
from convey.utils.crypto import compute_hmac_sha256_hex, construct_webhook_event


WebhookHandlerCallable = Callable[[ConveyWebhookEvent[Any]], Any]


class WebhookHandler:
    """Multi-framework webhook receiver and router."""

    def __init__(
        self,
        secret: str,
        handlers: Optional[Dict[str, WebhookHandlerCallable]] = None,
        tolerance_seconds: int = 300,
    ) -> None:
        self.secret = secret
        self.handlers = handlers or {}
        self.tolerance_seconds = tolerance_seconds

    def process_raw(self, payload: Union[str, bytes], signature_header: str) -> ConveyWebhookEvent[Any]:
        """Verify signature and route event."""
        event = construct_webhook_event(
            payload=payload,
            signature_header=signature_header,
            secret=self.secret,
            tolerance_seconds=self.tolerance_seconds,
        )

        if event.type in self.handlers:
            self.handlers[event.type](event)

        if "*" in self.handlers:
            self.handlers["*"](event)

        return event

    async def handle_fastapi(self, request: Any) -> Dict[str, Any]:
        """FastAPI / Starlette route handler."""
        signature = request.headers.get("convey-signature") or request.headers.get("x-convey-signature") or ""
        body = await request.body()
        event = self.process_raw(body, signature)
        return {"received": True, "eventId": event.id}

    def handle_flask(self, request: Any) -> Tuple[Dict[str, Any], int]:
        """Flask request handler."""
        signature = request.headers.get("convey-signature") or request.headers.get("x-convey-signature") or ""
        body = request.get_data()
        event = self.process_raw(body, signature)
        return ({"received": True, "eventId": event.id}, 200)


def generate_test_event(
    secret: str,
    event_type: str,
    data: Any,
    timestamp: Optional[int] = None,
) -> Dict[str, Any]:
    """Generate cryptographically signed mock webhook payload and headers for pytest suites."""
    ts = timestamp if timestamp is not None and timestamp > 0 else int(time.time())
    event_dict = {
        "id": f"evt_test_{ts}",
        "type": event_type,
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(ts)),
        "teamId": "team_test",
        "data": data,
    }

    raw_body = json.dumps(event_dict)
    signed_content = f"{ts}.{raw_body}".encode("utf-8")
    sig_hex = compute_hmac_sha256_hex(secret, signed_content)

    signature_header = f"t={ts},v1={sig_hex}"
    return {
        "raw_body": raw_body,
        "signature": signature_header,
        "headers": {
            "Content-Type": "application/json",
            "convey-signature": signature_header,
            "x-convey-signature": signature_header,
        },
        "event": event_dict,
    }
