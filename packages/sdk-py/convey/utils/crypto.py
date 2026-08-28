"""
convey.utils.crypto
Timing-safe HMAC-SHA256 webhook signature verification and payload deserialization.
"""

from __future__ import annotations

import hmac
import hashlib
import json
import time
from typing import Any, List, Optional, Tuple, TypeVar, Union

from convey.errors import ConveySecurityError
from convey.types import ConveyWebhookEvent

T = TypeVar("T")


def parse_webhook_signature_header(header_value: str) -> Tuple[int, List[str]]:
    """Parse x-convey-signature header into (timestamp, [signatures])."""
    timestamp = -1
    signatures: List[str] = []

    for part in header_value.split(","):
        part = part.strip()
        if part.startswith("t="):
            try:
                timestamp = int(part[2:])
            except ValueError:
                pass
        elif part.startswith("v1="):
            signatures.append(part[3:])
        elif part and "=" not in part:
            signatures.append(part)

    return timestamp, signatures


def verify_webhook_signature(
    payload: Union[str, bytes],
    signature_header: str,
    secret: str,
    tolerance_seconds: int = 300,
) -> bool:
    """Verify HMAC-SHA256 signature using constant-time comparison."""
    if not signature_header or not secret:
        return False

    timestamp, signatures = parse_webhook_signature_header(signature_header)
    if not signatures:
        return False

    if timestamp > 0 and tolerance_seconds > 0:
        current_unix = int(time.time())
        if abs(current_unix - timestamp) > tolerance_seconds:
            return False

    payload_bytes = payload.encode("utf-8") if isinstance(payload, str) else payload

    if timestamp > 0:
        signed_content = f"{timestamp}.".encode("utf-8") + payload_bytes
    else:
        signed_content = payload_bytes

    expected_sig = hmac.new(
        secret.encode("utf-8"),
        signed_content,
        hashlib.sha256,
    ).hexdigest()

    for sig in signatures:
        if hmac.compare_digest(sig.lower(), expected_sig.lower()):
            return True

    return False


def construct_webhook_event(
    payload: Union[str, bytes],
    signature_header: str,
    secret: str,
    tolerance_seconds: int = 300,
) -> ConveyWebhookEvent[Any]:
    """Verify webhook signature and deserialize payload into a ConveyWebhookEvent."""
    if not verify_webhook_signature(payload, signature_header, secret, tolerance_seconds):
        raise ConveySecurityError("Webhook signature verification failed: invalid signature or timestamp drift exceeded.")

    raw_text = payload.decode("utf-8") if isinstance(payload, bytes) else payload
    try:
        data = json.loads(raw_text)
        return ConveyWebhookEvent(
            id=data.get("id", ""),
            type=data.get("type", ""),
            timestamp=data.get("timestamp", int(time.time())),
            data=data.get("data", {}),
            team=data.get("team"),
            signature=signature_header,
        )
    except Exception as e:
        raise ConveySecurityError(f"Failed to parse webhook JSON payload: {str(e)}") from e
