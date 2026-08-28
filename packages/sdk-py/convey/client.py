"""
convey.client
Convey synchronous and asynchronous main client entry points.
"""

from __future__ import annotations

import os
from typing import Any, Callable, Dict, List, Optional, Union

from convey.builder import MessageBuilder
from convey.environments import ConveyEnvironment
from convey.http import (
    AsyncHttpClient,
    DEFAULT_MAX_RETRIES,
    DEFAULT_TIMEOUT,
    SyncHttpClient,
)
from convey.middleware import ConveyMiddleware
from convey.rate_limiter import TokenBucketRateLimiter
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
from convey.webhook_handler import WebhookHandler, generate_test_event


class Convey:
    """Official synchronous Convey communication client."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        *,
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
        resolved_key = api_key if api_key is not None else (os.getenv("CONVEY_API_KEY") or "")
        self.http = SyncHttpClient(
            api_key=resolved_key,
            base_url=base_url,
            environment=environment,
            timeout=timeout,
            max_retries=max_retries,
            is_sandbox=is_sandbox,
            team_id=team_id,
            default_headers=default_headers,
            rate_limiter=rate_limiter,
            middlewares=middlewares,
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

    @property
    def base_url(self) -> str:
        return self.http.base_url

    def set_base_url(self, url: str) -> None:
        self.http.set_base_url(url)

    def use(self, middleware: ConveyMiddleware) -> Convey:
        self.http.use(middleware)
        return self

    def with_team(self, team_id: str) -> Convey:
        """Return a cloned client targeting a specific tenant team."""
        return Convey(
            api_key=self.http.api_key,
            base_url=self.http.base_url,
            timeout=self.http.timeout,
            max_retries=self.http.max_retries,
            is_sandbox=self.http.is_sandbox,
            team_id=team_id,
            default_headers=self.http.default_headers,
            rate_limiter=self.http.rate_limiter,
            middlewares=list(self.http.pipeline.middlewares),
        )

    def with_options(self, **kwargs: Any) -> Convey:
        """Return a cloned client with custom overrides."""
        opts = {
            "api_key": self.http.api_key,
            "base_url": self.http.base_url,
            "timeout": self.http.timeout,
            "max_retries": self.http.max_retries,
            "is_sandbox": self.http.is_sandbox,
            "team_id": self.http.team_id,
            "default_headers": self.http.default_headers,
            "rate_limiter": self.http.rate_limiter,
            "middlewares": list(self.http.pipeline.middlewares),
        }
        opts.update(kwargs)
        return Convey(**opts)

    def message(self) -> MessageBuilder:
        """Start constructing a message with the fluent MessageBuilder."""
        return MessageBuilder(self.messages)

    @staticmethod
    def create_webhook_handler(
        secret: str,
        handlers: Optional[Dict[str, Callable]] = None,
        tolerance_seconds: int = 300,
    ) -> WebhookHandler:
        """Create a webhook verification and routing handler."""
        return WebhookHandler(secret, handlers=handlers, tolerance_seconds=tolerance_seconds)

    @staticmethod
    def generate_test_webhook_event(
        secret: str,
        event_type: str,
        data: Any,
        timestamp: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Generate signed test event fixture for unit/integration tests."""
        return generate_test_event(secret, event_type, data, timestamp)

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
        environment: Optional[Union[ConveyEnvironment, str]] = None,
        timeout: float = DEFAULT_TIMEOUT,
        max_retries: int = DEFAULT_MAX_RETRIES,
        is_sandbox: Optional[bool] = None,
        team_id: Optional[str] = None,
        default_headers: Optional[Dict[str, str]] = None,
        rate_limiter: Optional[Union[TokenBucketRateLimiter, Dict[str, Any]]] = None,
        middlewares: Optional[List[ConveyMiddleware]] = None,
    ) -> None:
        self._sync_client = Convey(
            api_key=api_key,
            base_url=base_url,
            environment=environment,
            timeout=timeout,
            max_retries=max_retries,
            is_sandbox=is_sandbox,
            team_id=team_id,
            default_headers=default_headers,
            rate_limiter=rate_limiter,
            middlewares=middlewares,
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

    @property
    def base_url(self) -> str:
        return self._sync_client.base_url

    def set_base_url(self, url: str) -> None:
        self._sync_client.set_base_url(url)

    def use(self, middleware: ConveyMiddleware) -> AsyncConvey:
        self._sync_client.use(middleware)
        return self

    def message(self) -> MessageBuilder:
        return MessageBuilder(self.messages)

    @staticmethod
    def create_webhook_handler(
        secret: str,
        handlers: Optional[Dict[str, Callable]] = None,
        tolerance_seconds: int = 300,
    ) -> WebhookHandler:
        return WebhookHandler(secret, handlers=handlers, tolerance_seconds=tolerance_seconds)

    @staticmethod
    def generate_test_webhook_event(
        secret: str,
        event_type: str,
        data: Any,
        timestamp: Optional[int] = None,
    ) -> Dict[str, Any]:
        return generate_test_event(secret, event_type, data, timestamp)

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
