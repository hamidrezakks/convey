"""
convey.resources.webhooks
Webhooks resource for subscription management and HMAC-SHA256 signature verification.
"""

from __future__ import annotations

import asyncio
import urllib.parse
from typing import Any, Dict, List, Optional, Union

from convey.types import ConveyWebhookEvent, WebhookSubscriptionDto
from convey.utils.crypto import construct_webhook_event, verify_webhook_signature


class SyncWebhookSubscriptionsResource:
    """Synchronous Webhook Subscriptions resource client."""

    def __init__(self, http_client: Any) -> None:
        self._http = http_client

    def create(
        self,
        url: str,
        events: List[str],
        secret: Optional[str] = None,
        description: Optional[str] = None,
        team: Optional[str] = None,
    ) -> WebhookSubscriptionDto:
        """Register a new webhook subscription endpoint."""
        payload = {
            "url": url,
            "events": events,
            "secret": secret,
            "description": description,
            "team": team,
        }
        res = self._http.request("POST", "/v1/webhook-subscriptions", body=payload)
        sub = res.get("subscription") or res
        return WebhookSubscriptionDto(
            id=sub.get("id", ""),
            team=sub.get("team", ""),
            url=sub.get("url", url),
            events=sub.get("events", events),
            secret=sub.get("secret", ""),
            is_active=sub.get("isActive", True),
            created_at=sub.get("createdAt", ""),
            description=sub.get("description"),
        )

    def list(self) -> List[WebhookSubscriptionDto]:
        """List all configured webhook subscriptions."""
        res = self._http.request("GET", "/v1/webhook-subscriptions")
        subs_raw = res.get("subscriptions") or []
        return [
            WebhookSubscriptionDto(
                id=s.get("id", ""),
                team=s.get("team", ""),
                url=s.get("url", ""),
                events=s.get("events", []),
                secret=s.get("secret", ""),
                is_active=s.get("isActive", True),
                created_at=s.get("createdAt", ""),
                description=s.get("description"),
            )
            for s in subs_raw
        ]

    def delete(self, subscription_id: str) -> bool:
        """Delete a webhook subscription by ID."""
        res = self._http.request("DELETE", f"/v1/webhook-subscriptions/{urllib.parse.quote(subscription_id)}")
        return bool(res.get("success", True))

    def test(self, subscription_id: str) -> bool:
        """Send a test ping event to verify endpoint connectivity."""
        res = self._http.request("POST", f"/v1/webhook-subscriptions/{urllib.parse.quote(subscription_id)}/test")
        return bool(res.get("success", True))


class SyncWebhooksResource:
    """Synchronous Webhooks resource client aggregating subscriptions and crypto."""

    def __init__(self, http_client: Any) -> None:
        self.subscriptions = SyncWebhookSubscriptionsResource(http_client)

    def verify_signature(
        self,
        payload: Union[str, bytes],
        signature_header: str,
        secret: str,
        tolerance_seconds: int = 300,
    ) -> bool:
        """Verify HMAC-SHA256 signature against incoming webhook payload."""
        return verify_webhook_signature(payload, signature_header, secret, tolerance_seconds)

    def construct_event(
        self,
        payload: Union[str, bytes],
        signature_header: str,
        secret: str,
        tolerance_seconds: int = 300,
    ) -> ConveyWebhookEvent[Any]:
        """Verify signature and deserialize incoming webhook event."""
        return construct_webhook_event(payload, signature_header, secret, tolerance_seconds)


class AsyncWebhookSubscriptionsResource:
    """Asynchronous Webhook Subscriptions resource client."""

    def __init__(self, sync_res: SyncWebhookSubscriptionsResource) -> None:
        self._sync = sync_res

    async def create(self, *args: Any, **kwargs: Any) -> WebhookSubscriptionDto:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.create(*args, **kwargs))

    async def list(self) -> List[WebhookSubscriptionDto]:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._sync.list)

    async def delete(self, subscription_id: str) -> bool:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.delete(subscription_id))

    async def test(self, subscription_id: str) -> bool:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.test(subscription_id))


class AsyncWebhooksResource:
    """Asynchronous Webhooks resource client."""

    def __init__(self, sync_res: SyncWebhooksResource) -> None:
        self._sync = sync_res
        self.subscriptions = AsyncWebhookSubscriptionsResource(sync_res.subscriptions)

    def verify_signature(
        self,
        payload: Union[str, bytes],
        signature_header: str,
        secret: str,
        tolerance_seconds: int = 300,
    ) -> bool:
        return self._sync.verify_signature(payload, signature_header, secret, tolerance_seconds)

    def construct_event(
        self,
        payload: Union[str, bytes],
        signature_header: str,
        secret: str,
        tolerance_seconds: int = 300,
    ) -> ConveyWebhookEvent[Any]:
        return self._sync.construct_event(payload, signature_header, secret, tolerance_seconds)
