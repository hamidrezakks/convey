"""
Convey Python SDK
Official zero-dependency, high-performance Python client for the Convey communication service.
"""

from convey.builder import MessageBuilder
from convey.client import AsyncConvey, AsyncConveyClient, Convey, ConveyClient
from convey.environments import ConveyEnvironment, normalize_base_url, resolve_base_url, resolve_environment_url
from convey.errors import (
    ConveyApiError,
    ConveyAuthenticationError,
    ConveyConfigurationError,
    ConveyConflictError,
    ConveyError,
    ConveyForbiddenError,
    ConveyNetworkError,
    ConveyNotFoundError,
    ConveyRateLimitError,
    ConveySecurityError,
    ConveyTimeoutError,
    ConveyValidationError,
)
from convey.middleware import ConveyMiddleware, MiddlewarePipeline
from convey.polling import (
    wait_for_batch_completion,
    wait_for_batch_completion_async,
    wait_for_delivery,
    wait_for_delivery_async,
)
from convey.rate_limiter import TokenBucketRateLimiter
from convey.types import (
    BatchDto,
    BatchState,
    BulkMessageResponse,
    Channel,
    CircuitState,
    ConveyWebhookEvent,
    DlqFailureCategory,
    MessageAcceptedResponse,
    MessageAttemptDto,
    MessageContent,
    MessageDetailDto,
    MessagePriority,
    MessageStatus,
    MessageTimelineResponse,
    MessageTraceResponse,
    SendMessageRequest,
    SuppressionDto,
    SuppressionReason,
    TemplateDto,
    TemplatePreviewResponse,
    TemplateVersionDto,
    TraceSpan,
    UserRole,
    WebhookSubscriptionDto,
)
from convey.utils.crypto import construct_webhook_event, verify_webhook_signature
from convey.utils.pagination import AsyncAutoPaginator, SyncAutoPaginator
from convey.utils.trace import create_child_traceparent, generate_traceparent
from convey.utils.ulid import generate_ulid
from convey.webhook_handler import WebhookHandler, generate_test_event

__version__ = "1.0.0"

__all__ = [
    # Clients
    "Convey",
    "ConveyClient",
    "AsyncConvey",
    "AsyncConveyClient",
    # Environments
    "ConveyEnvironment",
    "normalize_base_url",
    "resolve_environment_url",
    "resolve_base_url",
    # Errors
    "ConveyError",
    "ConveyApiError",
    "ConveyConfigurationError",
    "ConveyValidationError",
    "ConveyAuthenticationError",
    "ConveyForbiddenError",
    "ConveyNotFoundError",
    "ConveyConflictError",
    "ConveyRateLimitError",
    "ConveyTimeoutError",
    "ConveyNetworkError",
    "ConveySecurityError",
    # Enums
    "Channel",
    "MessagePriority",
    "MessageStatus",
    "CircuitState",
    "SuppressionReason",
    "DlqFailureCategory",
    "UserRole",
    "BatchState",
    # Models / DTOs
    "SendMessageRequest",
    "MessageContent",
    "MessageAcceptedResponse",
    "BulkMessageResponse",
    "MessageDetailDto",
    "MessageAttemptDto",
    "MessageTimelineResponse",
    "MessageTraceResponse",
    "TraceSpan",
    "TemplatePreviewResponse",
    "BatchDto",
    "SuppressionDto",
    "WebhookSubscriptionDto",
    "ConveyWebhookEvent",
    # Middleware & Rate Limiting
    "ConveyMiddleware",
    "MiddlewarePipeline",
    "TokenBucketRateLimiter",
    # Builders & Polling
    "MessageBuilder",
    "wait_for_delivery",
    "wait_for_delivery_async",
    "wait_for_batch_completion",
    "wait_for_batch_completion_async",
    "WebhookHandler",
    "generate_test_event",
    # Paginators
    "SyncAutoPaginator",
    "AsyncAutoPaginator",
    # Crypto & Trace Helpers
    "verify_webhook_signature",
    "construct_webhook_event",
    "generate_traceparent",
    "create_child_traceparent",
    "generate_ulid",
]
