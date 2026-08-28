"""
convey.resources.messages
Messages resource for omnichannel delivery, bulk outbox, timelines, and traces.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Union
import urllib.parse

from convey.types import (
    BulkMessageResponse,
    Channel,
    MessageAcceptedResponse,
    MessageAttemptDto,
    MessageContent,
    MessageDetailDto,
    MessagePriority,
    MessageStatus,
    MessageTimelineResponse,
    MessageTraceResponse,
    SendMessageRequest,
    TemplatePreviewResponse,
    TraceSpan,
)
from convey.utils.ulid import generate_ulid


def _normalize_send_payload(http_client: Any, request: Union[SendMessageRequest, Dict[str, Any]]) -> Dict[str, Any]:
    req = request if isinstance(request, dict) else request.__dict__

    channels = req.get("channels")
    recipients = req.get("recipients")
    recipient = req.get("recipient")

    if channels and (recipients or recipient):
        idempotency_key = req.get("idempotency_key") or f"sdk_{generate_ulid()}"
        team = req.get("team") or http_client.team_id or "default-team"
        category = req.get("category") or "TRANSACTIONAL"
        country = req.get("country") or "US"
        user_id = req.get("user_id") or "usr_anonymous"
        priority_val = _map_priority(req.get("priority"))

        wire: Dict[str, Any] = {
            "idempotencyKey": idempotency_key,
            "userId": user_id,
            "team": team,
            "category": category,
            "country": country,
            "priority": priority_val,
            "recipients": recipients or {"email": recipient},
            "channels": channels,
            "metadata": req.get("metadata"),
        }
        if req.get("template"):
            wire["template"] = req["template"]
        if req.get("variables"):
            wire["variables"] = req["variables"]
        if req.get("fallback"):
            wire["fallback"] = req["fallback"]
        if req.get("cascade"):
            wire["cascade"] = req["cascade"]
        if req.get("scheduled_at"):
            wire["scheduledAt"] = req["scheduled_at"]
        return wire

    channel_str = str(req.get("channel") or "EMAIL").lower()
    recipients_obj = dict(req.get("recipients") or {})
    recipient_str = req.get("recipient") or ""

    if channel_str == "email":
        recipients_obj["email"] = recipient_str
    elif channel_str == "sms":
        recipients_obj["phone"] = recipient_str
    elif channel_str == "whatsapp":
        recipients_obj["whatsapp"] = recipient_str
    elif channel_str == "slack":
        recipients_obj["slack"] = {"channelId": recipient_str}
    elif channel_str in ("push", "fcm"):
        recipients_obj["fcmTokens"] = [recipient_str]
    elif channel_str == "telegram":
        recipients_obj["telegramChatId"] = recipient_str

    content_raw = req.get("content") or {}
    content = content_raw if isinstance(content_raw, dict) else content_raw.__dict__

    channels_array: List[Dict[str, Any]] = []
    if channel_str == "email":
        render = None
        if content.get("template_id"):
            render = {"template": content["template_id"], "props": content.get("variables")}
        channels_array.append({
            "channel": "email",
            "content": {
                "subject": content.get("subject", "Notification"),
                "html": content.get("html") or content.get("body", ""),
                "text": content.get("text") or content.get("body", ""),
                "render": render,
            },
        })
    elif channel_str == "sms":
        channels_array.append({"channel": "sms", "content": {"text": content.get("body", "")}})
    elif channel_str == "whatsapp":
        channels_array.append({
            "channel": "whatsapp",
            "content": {
                "text": content.get("body"),
                "template": content.get("template_id"),
                "variables": content.get("variables"),
            },
        })
    elif channel_str == "slack":
        channels_array.append({"channel": "slack", "content": {"text": content.get("body", "")}})
    elif channel_str in ("push", "fcm"):
        channels_array.append({
            "channel": "fcm",
            "content": {"title": content.get("subject", ""), "body": content.get("body", "")},
        })
    else:
        channels_array.append({
            "channel": channel_str,
            "content": {"subject": content.get("subject"), "text": content.get("body", "")},
        })

    idempotency_key = req.get("idempotency_key") or f"sdk_{generate_ulid()}"
    team = req.get("team") or http_client.team_id or "default-team"

    wire = {
        "idempotencyKey": idempotency_key,
        "userId": req.get("user_id") or "usr_anonymous",
        "team": team,
        "category": req.get("category") or "TRANSACTIONAL",
        "country": req.get("country") or "US",
        "priority": _map_priority(req.get("priority")),
        "recipients": recipients_obj,
        "channels": channels_array,
        "metadata": req.get("metadata"),
    }
    if req.get("scheduled_at"):
        wire["scheduledAt"] = req["scheduled_at"]

    return wire


def _map_priority(priority: Optional[Union[MessagePriority, str]]) -> str:
    if not priority:
        return "normal"
    p = str(priority).upper()
    if p == "CRITICAL":
        return "critical"
    if p == "HIGH":
        return "transactional"
    if p in ("DEFAULT", "NORMAL"):
        return "normal"
    if p in ("LOW", "MARKETING"):
        return "marketing"
    return str(priority).lower()


def _format_accepted_response(raw: Dict[str, Any], is_sandbox: bool = False) -> MessageAcceptedResponse:
    mid = raw.get("messageId") or raw.get("publicId") or ""
    state = raw.get("state") or raw.get("status") or "accepted"
    status = state.upper()
    created_at = raw.get("createdAt") or ""

    return MessageAcceptedResponse(
        message_id=mid,
        public_id=mid,
        state=state,
        status=status,
        created_at=created_at,
        accepted_at=created_at,
        success=True,
        is_sandbox=raw.get("isSandbox", is_sandbox),
        scheduled_at=raw.get("scheduledAt"),
        idempotency_key=raw.get("idempotencyKey"),
    )


class SyncMessagesResource:
    """Synchronous Messages resource client."""

    def __init__(self, http_client: Any) -> None:
        self._http = http_client

    def send(
        self,
        request: Optional[Union[SendMessageRequest, Dict[str, Any]]] = None,
        *,
        channel: Optional[Union[Channel, str]] = None,
        recipient: Optional[str] = None,
        content: Optional[Union[MessageContent, Dict[str, Any]]] = None,
        priority: Optional[Union[MessagePriority, str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        idempotency_key: Optional[str] = None,
        **kwargs: Any,
    ) -> MessageAcceptedResponse:
        """Dispatch a single omnichannel communication message."""
        if request is None:
            request = SendMessageRequest(
                channel=channel,
                recipient=recipient,
                content=content,
                priority=priority,
                metadata=metadata,
                idempotency_key=idempotency_key,
                **kwargs,
            )
        wire_body = _normalize_send_payload(self._http, request)
        raw = self._http.request("POST", "/v1/messages", body=wire_body)
        return _format_accepted_response(raw, self._http.is_sandbox)

    def send_bulk(
        self,
        messages: List[Union[SendMessageRequest, Dict[str, Any]]],
    ) -> BulkMessageResponse:
        """High-throughput bulk message dispatch into the outbox pipeline."""
        normalized = [_normalize_send_payload(self._http, m) for m in messages]
        raw = self._http.request("POST", "/v1/messages/bulk", body={"messages": normalized})
        items_raw = raw.get("items") or []
        items = [_format_accepted_response(item, self._http.is_sandbox) for item in items_raw]
        total = raw.get("total", len(items))
        return BulkMessageResponse(total=total, items=items)

    def get(self, message_id: str) -> MessageDetailDto:
        """Retrieve message status and provider delivery attempts."""
        raw = self._http.request("GET", f"/v1/messages/{urllib.parse.quote(message_id)}")
        attempts = [
            MessageAttemptDto(
                id=a.get("id", ""),
                provider=a.get("provider", ""),
                channel=a.get("channel", ""),
                status=a.get("status", ""),
                latency_ms=a.get("latencyMs", 0),
                created_at=a.get("createdAt", ""),
                attempt_num=a.get("attemptNum", 1),
                error=a.get("error"),
                metadata=a.get("metadata"),
            )
            for a in raw.get("attempts", [])
        ]
        return MessageDetailDto(
            public_id=raw.get("publicId", message_id),
            team=raw.get("team", ""),
            channel=raw.get("channel", ""),
            recipient=raw.get("recipient", ""),
            status=raw.get("status", ""),
            priority=raw.get("priority", "normal"),
            cost_usd=float(raw.get("costUsd", 0.0)),
            created_at=raw.get("createdAt", ""),
            delivered_at=raw.get("deliveredAt"),
            attempts=attempts,
            metadata=raw.get("metadata"),
        )

    def get_timeline(self, message_id: str) -> MessageTimelineResponse:
        """Query the chronological event timeline of provider attempts."""
        raw = self._http.request("GET", f"/v1/messages/{urllib.parse.quote(message_id)}/timeline")
        return MessageTimelineResponse(
            message_id=raw.get("messageId", message_id),
            timeline=raw.get("timeline", []),
        )

    def get_trace(self, message_id: str) -> MessageTraceResponse:
        """Query the W3C distributed trace span waterfall."""
        raw = self._http.request("GET", f"/v1/messages/{urllib.parse.quote(message_id)}/trace")
        spans = [
            TraceSpan(
                name=s.get("name", ""),
                duration_ms=float(s.get("durationMs", 0.0)),
                timestamp=s.get("timestamp", ""),
                attributes=s.get("attributes"),
            )
            for s in raw.get("spans", [])
        ]
        return MessageTraceResponse(
            message_id=raw.get("messageId", message_id),
            traceparent=raw.get("traceparent", ""),
            total_duration_ms=float(raw.get("totalDurationMs", 0.0)),
            spans=spans,
        )

    def preview_template(
        self,
        template: Any,
        variables: Optional[Dict[str, Any]] = None,
        recipient: Optional[Any] = None,
    ) -> TemplatePreviewResponse:
        """Preview and test variable rendering against a message template."""
        wire = {
            "template": {"body": template} if isinstance(template, str) else template,
            "variables": variables or {},
            "recipient": {"email": recipient} if isinstance(recipient, str) else (recipient or {}),
        }
        res = self._http.request("POST", "/v1/messages/templates/preview", body=wire)
        return TemplatePreviewResponse(
            subject=res.get("subject"),
            body=res.get("body"),
            text=res.get("text"),
            html=res.get("html"),
            rendered=res.get("rendered") or res.get("text") or res.get("body") or res.get("html") or "",
            missing_variables=res.get("missingVariables", []),
        )


class AsyncMessagesResource:
    """Asynchronous Messages resource client."""

    def __init__(self, sync_res: SyncMessagesResource) -> None:
        self._sync = sync_res

    async def send(self, *args: Any, **kwargs: Any) -> MessageAcceptedResponse:
        import asyncio
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.send(*args, **kwargs))

    async def send_bulk(self, *args: Any, **kwargs: Any) -> BulkMessageResponse:
        import asyncio
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.send_bulk(*args, **kwargs))

    async def get(self, message_id: str) -> MessageDetailDto:
        import asyncio
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.get(message_id))

    async def get_timeline(self, message_id: str) -> MessageTimelineResponse:
        import asyncio
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.get_timeline(message_id))

    async def get_trace(self, message_id: str) -> MessageTraceResponse:
        import asyncio
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.get_trace(message_id))

    async def preview_template(self, *args: Any, **kwargs: Any) -> TemplatePreviewResponse:
        import asyncio
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: self._sync.preview_template(*args, **kwargs))
