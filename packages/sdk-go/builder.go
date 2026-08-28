package convey

import (
	"context"
	"time"
)

// MessageBuilder provides a fluent builder API for constructing and sending messages.
type MessageBuilder struct {
	messagesResource *MessagesResource
	req              SendMessageRequest
	content          MessageContent
}

// NewMessageBuilder creates a new MessageBuilder.
func NewMessageBuilder(resource ...*MessagesResource) *MessageBuilder {
	var res *MessagesResource
	if len(resource) > 0 {
		res = resource[0]
	}
	return &MessageBuilder{
		messagesResource: res,
	}
}

// To sets the recipient.
func (b *MessageBuilder) To(recipient string) *MessageBuilder {
	b.req.Recipient = recipient
	return b
}

// Channel sets the delivery channel.
func (b *MessageBuilder) Channel(channel Channel) *MessageBuilder {
	b.req.Channel = channel
	return b
}

// Email configures an email channel shortcut.
func (b *MessageBuilder) Email(subject, html string) *MessageBuilder {
	b.req.Channel = ChannelEmail
	b.content.Subject = subject
	b.content.Body = html
	return b
}

// SMS configures an SMS channel shortcut.
func (b *MessageBuilder) SMS(body string) *MessageBuilder {
	b.req.Channel = ChannelSMS
	b.content.Body = body
	return b
}

// WhatsApp configures a WhatsApp channel shortcut.
func (b *MessageBuilder) WhatsApp(body string) *MessageBuilder {
	b.req.Channel = ChannelWhatsApp
	b.content.Body = body
	return b
}

// Slack configures a Slack channel shortcut.
func (b *MessageBuilder) Slack(channelID, text string) *MessageBuilder {
	b.req.Channel = ChannelSlack
	if channelID != "" {
		b.req.Recipient = channelID
	}
	b.content.Body = text
	return b
}

// Push configures a Push notification channel shortcut.
func (b *MessageBuilder) Push(title, body string) *MessageBuilder {
	b.req.Channel = ChannelPush
	b.content.Subject = title
	b.content.Body = body
	return b
}

// Subject sets the subject.
func (b *MessageBuilder) Subject(subject string) *MessageBuilder {
	b.content.Subject = subject
	return b
}

// Body sets the message body text or html.
func (b *MessageBuilder) Body(body string) *MessageBuilder {
	b.content.Body = body
	return b
}

// Template sets template ID and optional variable map.
func (b *MessageBuilder) Template(templateID string, variables map[string]interface{}) *MessageBuilder {
	b.content.TemplateID = templateID
	b.content.Variables = variables
	return b
}

// Variables sets the template substitution variables.
func (b *MessageBuilder) Variables(variables map[string]interface{}) *MessageBuilder {
	b.content.Variables = variables
	b.req.Variables = variables
	return b
}

// Metadata attaches arbitrary metadata.
func (b *MessageBuilder) Metadata(metadata map[string]interface{}) *MessageBuilder {
	b.req.Metadata = metadata
	return b
}

// Priority sets message delivery priority.
func (b *MessageBuilder) Priority(priority MessagePriority) *MessageBuilder {
	b.req.Priority = priority
	return b
}

// ScheduledAt sets scheduled delivery timestamp.
func (b *MessageBuilder) ScheduledAt(t time.Time) *MessageBuilder {
	b.req.ScheduledAt = &t
	return b
}

// IdempotencyKey sets explicit idempotency key.
func (b *MessageBuilder) IdempotencyKey(key string) *MessageBuilder {
	b.req.IdempotencyKey = key
	return b
}

// Team sets tenant team scoping.
func (b *MessageBuilder) Team(teamID string) *MessageBuilder {
	b.req.Team = teamID
	return b
}

// UserID sets user identifier.
func (b *MessageBuilder) UserID(userID string) *MessageBuilder {
	b.req.UserID = userID
	return b
}

// Build constructs the SendMessageRequest payload.
func (b *MessageBuilder) Build() *SendMessageRequest {
	req := b.req
	if b.content.Subject != "" || b.content.Body != "" || b.content.TemplateID != "" || b.content.Variables != nil {
		req.Content = &b.content
	}
	return &req
}

// Send dispatches the message via the configured MessagesResource.
func (b *MessageBuilder) Send(ctx context.Context, opts ...*RequestOptions) (*MessageAcceptedResponse, error) {
	if b.messagesResource == nil {
		return nil, &ConfigurationError{BaseError{Message: "MessageBuilder was created without a client context. Call builder.Build() and pass to client.Messages.Send()"}}
	}
	built := b.Build()
	return b.messagesResource.Send(ctx, *built, opts...)
}
