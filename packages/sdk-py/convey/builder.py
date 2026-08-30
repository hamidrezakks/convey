"""
convey.builder
Fluent message construction and batch dispatch DSL.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional, Union

from convey.errors import ConveyConfigurationError
from convey.types import Channel, MessageAcceptedResponse, MessageContent, MessagePriority, SendMessageRequest


class MessageBuilder:
    """Chainable message builder for Convey omnichannel communications."""

    def __init__(self, resource: Optional[Any] = None) -> None:
        self._resource = resource
        self._recipient: str = ""
        self._channel: Channel = Channel.EMAIL
        self._content: Dict[str, Any] = {}
        self._priority: Optional[MessagePriority] = None
        self._scheduled_at: Optional[str] = None
        self._idempotency_key: Optional[str] = None
        self._team: Optional[str] = None
        self._user_id: Optional[str] = None
        self._category: Optional[str] = None
        self._country: Optional[str] = None
        self._metadata: Optional[Dict[str, Any]] = None
        self._variables: Optional[Dict[str, Any]] = None

    def to(self, recipient: str) -> MessageBuilder:
        self._recipient = recipient
        return self

    def channel(self, channel: Union[Channel, str]) -> MessageBuilder:
        self._channel = channel if isinstance(channel, Channel) else Channel(channel.upper())
        return self

    def email(
        self,
        subject: str,
        body: Optional[str] = None,
        html: Optional[str] = None,
        to: Optional[str] = None,
    ) -> MessageBuilder:
        self._channel = Channel.EMAIL
        if to:
            self._recipient = to
        self._content["subject"] = subject
        self._content["body"] = html or body or ""
        return self

    def sms(self, body: str, to: Optional[str] = None) -> MessageBuilder:
        self._channel = Channel.SMS
        if to:
            self._recipient = to
        self._content["body"] = body
        return self

    def whatsapp(
        self,
        body: Optional[str] = None,
        template_id: Optional[str] = None,
        variables: Optional[Dict[str, Any]] = None,
        to: Optional[str] = None,
    ) -> MessageBuilder:
        self._channel = Channel.WHATSAPP
        if to:
            self._recipient = to
        if body:
            self._content["body"] = body
        if template_id:
            self._content["templateId"] = template_id
        if variables:
            self._content["variables"] = variables
        return self

    def slack(self, text: str, channel_id: Optional[str] = None) -> MessageBuilder:
        self._channel = Channel.SLACK
        if channel_id:
            self._recipient = channel_id
        self._content["body"] = text
        return self

    def push(self, body: str, title: Optional[str] = None, token: Optional[str] = None) -> MessageBuilder:
        self._channel = Channel.PUSH
        if token:
            self._recipient = token
        if title:
            self._content["subject"] = title
        self._content["body"] = body
        return self

    def subject(self, subject: str) -> MessageBuilder:
        self._content["subject"] = subject
        return self

    def body(self, body: str) -> MessageBuilder:
        self._content["body"] = body
        return self

    def html(self, html: str) -> MessageBuilder:
        self._content["body"] = html
        return self

    def template(self, template_id: str, variables: Optional[Dict[str, Any]] = None) -> MessageBuilder:
        self._content["templateId"] = template_id
        if variables:
            self._content["variables"] = variables
            self._variables = variables
        return self

    def variables(self, variables: Dict[str, Any]) -> MessageBuilder:
        self._variables = variables
        self._content["variables"] = variables
        return self

    def metadata(self, metadata: Dict[str, Any]) -> MessageBuilder:
        self._metadata = metadata
        return self

    def priority(self, priority: Union[MessagePriority, str]) -> MessageBuilder:
        self._priority = priority if isinstance(priority, MessagePriority) else MessagePriority(priority.upper())
        return self

    def scheduled_at(self, dt: Union[datetime, str]) -> MessageBuilder:
        self._scheduled_at = dt.isoformat() if isinstance(dt, datetime) else dt
        return self

    def idempotency_key(self, key: str) -> MessageBuilder:
        self._idempotency_key = key
        return self

    def team(self, team_id: str) -> MessageBuilder:
        self._team = team_id
        return self

    def user_id(self, user_id: str) -> MessageBuilder:
        self._user_id = user_id
        return self

    def build(self) -> SendMessageRequest:
        content_dto = MessageContent(**self._content) if self._content else None
        return SendMessageRequest(
            recipient=self._recipient,
            channel=self._channel,
            content=content_dto,
            priority=self._priority or MessagePriority.DEFAULT,
            scheduled_at=self._scheduled_at,
            idempotency_key=self._idempotency_key,
            team=self._team,
            user_id=self._user_id,
            category=self._category,
            country=self._country,
            metadata=self._metadata,
            variables=self._variables,
        )

    def send(self, **kwargs: Any) -> Any:
        """Dispatch message via synchronous or asynchronous resource."""
        if not self._resource:
            raise ConveyConfigurationError(
                "MessageBuilder was created without a client context. Call builder.build() and pass to client.messages.send()."
            )
        return self._resource.send(self.build(), **kwargs)
