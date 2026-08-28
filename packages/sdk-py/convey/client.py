"""
convey.client
Convey synchronous and asynchronous main client entry points.
"""

from __future__ import annotations

import os
from typing import Any, Dict, Optional, Union

from convey.http import AsyncHttpClient, DEFAULT_MAX_RETRIES, DEFAULT_TIMEOUT, SyncHttpClient
from convey.resources.admin import AsyncAdminResource, SyncAdminResource
from convey.resources.batches import AsyncBatchesResource, SyncBatchesResource
from convey.resources.dlq import AsyncDLQResource, SyncDLQResource
from convey.resources.inbox import AsyncInboxResource, SyncInboxResource
from convey.resources.messages import AsyncMessagesResource, SyncMessagesResource
from convey.resources.preferences import AsyncPreferencesResource, SyncPreferencesResource
from convey.resources.reports import AsyncReportsResource, SyncReportsResource
from convey.resources.sandbox import AsyncSandboxResource, SyncSandboxResource
from convey.resources.suppressions import AsyncSuppressionsResource, SyncSuppressionsResource
from convey.resources.templates import AsyncTemplatesResource, SyncTemplatesResource
from convey.resources.webhooks import AsyncWebhooksResource, SyncWebhooksResource
from convey.types import ConveyWebhookEvent
from convey.utils.crypto import construct_webhook_event, verify_webhook_signature


class Convey:
    """Official synchronous Convey communication client."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        *,
        base_url: Optional[str] = None,
        timeout: float = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_MAX_RETRIES,
        is_sandbox: Optional[bool] = None,
        team_id: Optional[str] = None,
        default_headers: Optional[Dict[str, str]] = None,
    ) -> None:
        resolved_key = api_key if api_key is not None else (os.getenv("CONVEY_API_KEY") or "")
        self.http = SyncHttpClient(
            api_key=resolved_key,
            base_url=base_url,
            timeout=timeout,
            max_retries=max_retries,
            is_sandbox=is_sandbox,
            team_id=team_id,
            default_headers=default_headers,
        )

        self.messages = SyncMessagesResource(self.http)
        self.batches = SyncBatchesResource(self.http)
        self.suppressions = SyncSuppressionsResource(self.http)
        self.webhooks = SyncWebhooksResource(self.http)
        self.dlq = SyncDLQResource(self.http)
        self.sandbox = SyncSandboxResource(self.http)
        self.reports = SyncReportsResource(self.http)
        self.templates = SyncTemplatesResource(self.http)
        self.preferences = SyncPreferencesResource(self.http)
        self.inbox = SyncInboxResource(self.http)
        self.admin = SyncAdminResource(self.http)

    @staticmethod
    def verify_webhook_signature(
        payload: Union[str, bytes],
        signature_header: str,
        secret: str,
        tolerance_seconds: int = 300,
    ) -> bool:
        """Verify HMAC-SHA256 signature on incoming webhook payload."""
        return verify_webhook_signature(payload, signature_header, secret, tolerance_seconds)

    @staticmethod
    def construct_webhook_event(
        payload: Union[str, bytes],
        signature_header: str,
        secret: str,
        tolerance_seconds: int = 300,
    ) -> ConveyWebhookEvent[Any]:
        """Verify signature and deserialize incoming webhook event."""
        return construct_webhook_event(payload, signature_header, secret, tolerance_seconds)


class AsyncConvey:
    """Official asynchronous Convey communication client."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        *,
        base_url: Optional[str] = None,
        timeout: float = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_MAX_RETRIES,
        is_sandbox: Optional[bool] = None,
        team_id: Optional[str] = None,
        default_headers: Optional[Dict[str, str]] = None,
    ) -> None:
        self._sync_client = Convey(
            api_key=api_key,
            base_url=base_url,
            timeout=timeout,
            max_retries=max_retries,
            is_sandbox=is_sandbox,
            team_id=team_id,
            default_headers=default_headers,
        )

        self.messages = AsyncMessagesResource(self._sync_client.messages)
        self.batches = AsyncBatchesResource(self._sync_client.batches)
        self.suppressions = AsyncSuppressionsResource(self._sync_client.suppressions)
        self.webhooks = AsyncWebhooksResource(self._sync_client.webhooks)
        self.dlq = AsyncDLQResource(self._sync_client.dlq)
        self.sandbox = AsyncSandboxResource(self._sync_client.sandbox)
        self.reports = AsyncReportsResource(self._sync_client.reports)
        self.templates = AsyncTemplatesResource(self._sync_client.templates)
        self.preferences = AsyncPreferencesResource(self._sync_client.preferences)
        self.inbox = AsyncInboxResource(self._sync_client.inbox)
        self.admin = AsyncAdminResource(self._sync_client.admin)

    @staticmethod
    def verify_webhook_signature(
        payload: Union[str, bytes],
        signature_header: str,
        secret: str,
        tolerance_seconds: int = 300,
    ) -> bool:
        return verify_webhook_signature(payload, signature_header, secret, tolerance_seconds)

    @staticmethod
    def construct_webhook_event(
        payload: Union[str, bytes],
        signature_header: str,
        secret: str,
        tolerance_seconds: int = 300,
    ) -> ConveyWebhookEvent[Any]:
        return construct_webhook_event(payload, signature_header, secret, tolerance_seconds)


ConveyClient = Convey
AsyncConveyClient = AsyncConvey
