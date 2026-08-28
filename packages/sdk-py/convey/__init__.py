"""
Convey Python SDK
Official zero-dependency, high-performance Python client for the Convey communication service.
"""

from convey.client import AsyncConvey, AsyncConveyClient, Convey, ConveyClient
from convey.errors import (
    ConveyApiError,
    ConveyAuthenticationError,
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

__version__ = "1.0.0"

__all__ = [
    # Clients
    "Convey",
    "ConveyClient",
    "AsyncConvey",
    "AsyncConveyClient",
    # Errors
    "ConveyError",
    "ConveyApiError",
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
