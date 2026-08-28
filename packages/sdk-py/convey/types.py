"""
convey.types
Domain enums, request models, and response DTOs for the Convey Python SDK.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, Generic, List, Optional, TypeVar, Union

T = TypeVar("T")


class Channel(str, Enum):
    EMAIL = "EMAIL"
    SMS = "SMS"
    WHATSAPP = "WHATSAPP"
    PUSH = "PUSH"
    SLACK = "SLACK"
    TOOL = "TOOL"
    VOICE = "VOICE"
    IN_APP = "IN_APP"
    DISCORD = "DISCORD"
    TELEGRAM = "TELEGRAM"
    WEBHOOK = "WEBHOOK"

    def __str__(self) -> str:
        return str(self.value)


class MessagePriority(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    DEFAULT = "DEFAULT"
    LOW = "LOW"

    def __str__(self) -> str:
        return str(self.value)


class MessageStatus(str, Enum):
    ACCEPTED = "ACCEPTED"
    QUEUED = "QUEUED"
    SENDING = "SENDING"
    DELIVERED = "DELIVERED"
    FAILED = "FAILED"
    SUPPRESSED = "SUPPRESSED"
    REPLAYED = "REPLAYED"

    def __str__(self) -> str:
        return str(self.value)


class CircuitState(str, Enum):
    CLOSED = "CLOSED"
    HALF_OPEN = "HALF_OPEN"
    OPEN = "OPEN"

    def __str__(self) -> str:
        return str(self.value)


class SuppressionReason(str, Enum):
    HARD_BOUNCE = "HARD_BOUNCE"
    SPAM_COMPLAINT = "SPAM_COMPLAINT"
    UNSUBSCRIBE = "UNSUBSCRIBE"
    MANUAL_BLOCK = "MANUAL_BLOCK"

    def __str__(self) -> str:
        return str(self.value)


class DlqFailureCategory(str, Enum):
    PROVIDER_5XX = "PROVIDER_5XX"
    RATE_LIMIT_429 = "RATE_LIMIT_429"
    INVALID_RECIPIENT_400 = "INVALID_RECIPIENT_400"
    AUTH_EXPIRED_401 = "AUTH_EXPIRED_401"
    TIMEOUT_504 = "TIMEOUT_504"
    POLICY_REJECTED = "POLICY_REJECTED"
    UNKNOWN = "UNKNOWN"

    def __str__(self) -> str:
        return str(self.value)


class UserRole(str, Enum):
    ORG_ADMIN = "ORG_ADMIN"
    TEAM_ADMIN = "TEAM_ADMIN"
    DEVELOPER = "DEVELOPER"
    VIEWER = "VIEWER"

    def __str__(self) -> str:
        return str(self.value)


class BatchState(str, Enum):
    INITIALIZING = "INITIALIZING"
    PROCESSING = "PROCESSING"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

    def __str__(self) -> str:
        return str(self.value)


@dataclass
class MessageContent:
    subject: Optional[str] = None
    body: Optional[str] = None
    text: Optional[str] = None
    html: Optional[str] = None
    template_id: Optional[str] = None
    variables: Optional[Dict[str, Any]] = None


@dataclass
class SendMessageRequest:
    channel: Optional[Union[Channel, str]] = None
    recipient: Optional[str] = None
    recipients: Optional[Dict[str, Any]] = None
    channels: Optional[List[Dict[str, Any]]] = None
    content: Optional[Union[MessageContent, Dict[str, Any]]] = None
    template: Optional[str] = None
    variables: Optional[Dict[str, Any]] = None
    priority: Optional[Union[MessagePriority, str]] = None
    category: Optional[str] = None
    country: Optional[str] = None
    team: Optional[str] = None
    user_id: Optional[str] = None
    idempotency_key: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None
    fallback: Optional[Any] = None
    cascade: Optional[Any] = None
    scheduled_at: Optional[str] = None


@dataclass
class MessageAcceptedResponse:
    message_id: str
    public_id: str
    state: str
    status: str
    created_at: str
    accepted_at: str
    success: bool = True
    is_sandbox: bool = False
    scheduled_at: Optional[str] = None
    idempotency_key: Optional[str] = None


@dataclass
class BulkMessageResponse:
    total: int
    items: List[MessageAcceptedResponse] = field(default_factory=list)


@dataclass
class MessageAttemptDto:
    id: str
    provider: str
    channel: str
    status: str
    latency_ms: int
    created_at: str
    attempt_num: int = 1
    error: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class MessageDetailDto:
    public_id: str
    team: str
    channel: str
    recipient: str
    status: str
    priority: str
    cost_usd: float = 0.0
    created_at: str = ""
    delivered_at: Optional[str] = None
    attempts: List[MessageAttemptDto] = field(default_factory=list)
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class MessageTimelineResponse:
    message_id: str
    timeline: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class TraceSpan:
    name: str
    duration_ms: float
    timestamp: str
    attributes: Optional[Dict[str, Any]] = None


@dataclass
class MessageTraceResponse:
    message_id: str
    traceparent: str
    total_duration_ms: float
    spans: List[TraceSpan] = field(default_factory=list)


@dataclass
class TemplatePreviewResponse:
    rendered: str
    subject: Optional[str] = None
    body: Optional[str] = None
    text: Optional[str] = None
    html: Optional[str] = None
    missing_variables: List[str] = field(default_factory=list)


@dataclass
class BatchDto:
    id: str
    team: str
    state: str
    total_count: int
    processed_count: int
    success_count: int
    failed_count: int
    created_at: str
    completed_at: Optional[str] = None


@dataclass
class BatchActionResponse:
    success: bool
    batch_id: str
    state: str
    message: Optional[str] = None



@dataclass
class SuppressionDto:
    id: str
    team: str
    recipient: str
    channel: str
    reason: str
    created_at: str
    category: Optional[str] = None


@dataclass
class WebhookSubscriptionDto:
    id: str
    team: str
    url: str
    events: List[str]
    secret: str
    is_active: bool
    created_at: str
    description: Optional[str] = None


@dataclass
class ConveyWebhookEvent(Generic[T]):
    id: str
    type: str
    timestamp: int
    data: T
    team: Optional[str] = None
    signature: Optional[str] = None


@dataclass
class LiveTelemetrySnapshot:
    timestamp: str = ""
    throughput_rps: float = 0.0
    latency: Optional[Dict[str, Any]] = None
    queues: Optional[Dict[str, Any]] = None
    runtime_guard: Optional[Dict[str, Any]] = None
    subsystems: Optional[Dict[str, Any]] = None
    recent_activity: Optional[List[Dict[str, Any]]] = None
    heap_saturation: float = 0.0
    queue_depths: Optional[Dict[str, int]] = None
    active_workers: int = 0
    p95_latency_ms: float = 0.0
    circuit_breakers: Optional[Dict[str, str]] = None
    system_health: str = "HEALTHY"
    extra_diagnostics: Optional[Dict[str, Any]] = None


@dataclass
class ProviderHealthDto:
    id: str
    name: str
    channel: str
    circuit_state: str
    success_rate: float
    p95_latency_ms: float
    is_active: bool = True


@dataclass
class TemplateDto:
    id: str
    slug: str
    name: str
    category: str
    environment: str
    created_at: str
    updated_at: str
    description: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class TemplateVersionDto:
    id: str
    version: str
    body: str
    is_active: bool
    created_at: str
    subject: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class AuditLogDto:
    id: str
    actor: str
    action: str
    target: str
    timestamp: str
    ip_address: str
    hash: str
    metadata: Optional[Dict[str, Any]] = None

