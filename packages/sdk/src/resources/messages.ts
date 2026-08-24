/**
 * @convey/sdk - Messages Resource Client
 * Omnichannel message dispatches, bulk pipelines, timeline inspections, and trace waterfalls.
 */

import type { HttpClient } from '../http';
import type {
  BulkMessageResponse,
  BulkSendMessageRequest,
  MessageAcceptedResponse,
  MessageDetailDto,
  MessagePriority,
  MessageStatus,
  MessageTimelineResponse,
  MessageTraceResponse,
  RequestOptions,
  SendMessageRequest,
  TemplatePreviewRequest,
  TemplatePreviewResponse,
} from '../types';
import { generateUlid } from '../utils/ulid';

export class MessagesResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Normalize an ergonomic SDK request into the Convey wire schema.
   */
  private normalizeSendPayload(
    request: SendMessageRequest<Record<string, unknown>, Record<string, unknown>>,
  ): Record<string, unknown> {
    // If caller passed fully formed raw wire schema (with channels and recipients), pass it through directly
    if (request.channels && (request.recipients || request.recipient)) {
      return {
        idempotencyKey: request.idempotencyKey || `sdk_${generateUlid()}`,
        userId: request.userId || 'usr_anonymous',
        team: request.team || this.http.teamId || 'default-team',
        category: request.category || 'TRANSACTIONAL',
        country: request.country || 'US',
        priority: this.mapPriority(request.priority),
        recipients: request.recipients || { email: request.recipient },
        channels: request.channels,
        template: request.template,
        variables: request.content?.variables || request.variables,
        metadata: request.metadata,
        fallback: request.fallback,
        cascade: request.cascade,
        scheduledAt: request.scheduledAt ? new Date(request.scheduledAt).toISOString() : undefined,
      };
    }

    const channelStr = String(request.channel || 'EMAIL').toLowerCase();
    const recipientStr = request.recipient || '';
    const content = request.content || {};

    const recipientsObj: Record<string, unknown> = request.recipients || {};
    if (channelStr === 'email') {
      recipientsObj.email = recipientStr;
    } else if (channelStr === 'sms') {
      recipientsObj.phone = recipientStr;
    } else if (channelStr === 'whatsapp') {
      recipientsObj.whatsapp = recipientStr;
    } else if (channelStr === 'slack') {
      recipientsObj.slack = { channelId: recipientStr };
    } else if (channelStr === 'push' || channelStr === 'fcm') {
      recipientsObj.fcmTokens = [recipientStr];
    } else if (channelStr === 'telegram') {
      recipientsObj.telegramChatId = recipientStr;
    }

    const channelsArray: Array<Record<string, unknown>> = [];
    if (channelStr === 'email') {
      channelsArray.push({
        channel: 'email',
        content: {
          subject: content.subject || 'Notification',
          html: content.body || '',
          text: content.body || '',
          render: content.templateId
            ? {
                template: content.templateId,
                props: content.variables,
              }
            : undefined,
        },
      });
    } else if (channelStr === 'sms') {
      channelsArray.push({
        channel: 'sms',
        content: {
          text: content.body || '',
        },
      });
    } else if (channelStr === 'whatsapp') {
      channelsArray.push({
        channel: 'whatsapp',
        content: {
          text: content.body,
          template: content.templateId,
          variables: content.variables,
        },
      });
    } else if (channelStr === 'slack') {
      channelsArray.push({
        channel: 'slack',
        content: {
          text: content.body || '',
        },
      });
    } else if (channelStr === 'push' || channelStr === 'fcm') {
      channelsArray.push({
        channel: 'fcm',
        content: {
          title: content.subject || '',
          body: content.body || '',
        },
      });
    } else {
      channelsArray.push({
        channel: channelStr,
        content: {
          text: content.body || '',
          subject: content.subject,
        },
      });
    }

    return {
      idempotencyKey: request.idempotencyKey || `sdk_${generateUlid()}`,
      userId: request.userId || 'usr_anonymous',
      team: request.team || this.http.teamId || 'default-team',
      category: request.category || 'TRANSACTIONAL',
      country: request.country || 'US',
      priority: this.mapPriority(request.priority),
      recipients: recipientsObj,
      channels: channelsArray,
      metadata: request.metadata,
      scheduledAt: request.scheduledAt ? new Date(request.scheduledAt).toISOString() : undefined,
    };
  }

  private mapPriority(priority?: MessagePriority | string): string {
    if (!priority) return 'normal';
    const p = String(priority).toUpperCase();
    if (p === 'CRITICAL') return 'critical';
    if (p === 'HIGH') return 'transactional';
    if (p === 'DEFAULT' || p === 'NORMAL') return 'normal';
    if (p === 'LOW' || p === 'MARKETING') return 'marketing';
    return String(priority).toLowerCase();
  }

  private formatAcceptedResponse(raw: Record<string, unknown>, isSandbox = false): MessageAcceptedResponse {
    const id = String(raw.messageId || raw.publicId || '');
    const state = String(raw.state || raw.status || 'accepted');
    const status = (state.toUpperCase() as MessageStatus) || 'ACCEPTED';
    const createdAt = String(raw.createdAt || new Date().toISOString());

    return {
      messageId: id,
      publicId: id,
      state,
      status,
      createdAt,
      acceptedAt: createdAt,
      scheduledAt: raw.scheduledAt ? String(raw.scheduledAt) : undefined,
      success: true,
      isSandbox: typeof raw.isSandbox === 'boolean' ? raw.isSandbox : isSandbox,
      idempotencyKey: raw.idempotencyKey ? String(raw.idempotencyKey) : undefined,
    };
  }

  /**
   * Dispatch a single omnichannel message with zero-provider exposure and idempotency protection.
   */
  async send<TVariables = Record<string, unknown>, TMetadata = Record<string, unknown>>(
    request: SendMessageRequest<TVariables, TMetadata>,
    options?: RequestOptions,
  ): Promise<MessageAcceptedResponse> {
    const wireBody = this.normalizeSendPayload(
      request as unknown as SendMessageRequest<Record<string, unknown>, Record<string, unknown>>,
    );
    const raw = await this.http.request<Record<string, unknown>>('/v1/messages', {
      method: 'POST',
      body: wireBody,
      ...options,
    });
    return this.formatAcceptedResponse(raw, options?.isSandbox ?? this.http.isSandbox);
  }

  /**
   * High-throughput bulk message dispatch into the transactional outbox pipeline.
   */
  async sendBulk<TVariables = Record<string, unknown>, TMetadata = Record<string, unknown>>(
    messages: Array<SendMessageRequest<TVariables, TMetadata>> | BulkSendMessageRequest<TVariables, TMetadata>,
    options?: RequestOptions,
  ): Promise<BulkMessageResponse> {
    const rawList = Array.isArray(messages) ? messages : messages.messages;
    const normalized = rawList.map((m) =>
      this.normalizeSendPayload(m as unknown as SendMessageRequest<Record<string, unknown>, Record<string, unknown>>),
    );
    const rawRes = await this.http.request<{ total: number; items: Record<string, unknown>[] }>('/v1/messages/bulk', {
      method: 'POST',
      body: { messages: normalized },
      ...options,
    });

    const isSandbox = options?.isSandbox ?? this.http.isSandbox;
    return {
      total: rawRes.total ?? (rawRes.items ? rawRes.items.length : 0),
      items: (rawRes.items || []).map((item) => this.formatAcceptedResponse(item, isSandbox)),
    };
  }

  /**
   * Retrieve message lifecycle status, provider delivery attempts, and metadata.
   */
  async get(messageId: string, options?: RequestOptions): Promise<MessageDetailDto> {
    return this.http.request<MessageDetailDto>(`/v1/messages/${encodeURIComponent(messageId)}`, {
      method: 'GET',
      ...options,
    });
  }

  /**
   * Query the chronological event timeline of all provider attempts for a message.
   */
  async getTimeline(messageId: string, options?: RequestOptions): Promise<MessageTimelineResponse> {
    return this.http.request<MessageTimelineResponse>(`/v1/messages/${encodeURIComponent(messageId)}/timeline`, {
      method: 'GET',
      ...options,
    });
  }

  /**
   * Query the W3C distributed trace span waterfall for end-to-end delivery diagnostics.
   */
  async getTrace(messageId: string, options?: RequestOptions): Promise<MessageTraceResponse> {
    return this.http.request<MessageTraceResponse>(`/v1/messages/${encodeURIComponent(messageId)}/trace`, {
      method: 'GET',
      ...options,
    });
  }

  /**
   * Preview and test variable rendering against a message template.
   */
  async previewTemplate(request: TemplatePreviewRequest, options?: RequestOptions): Promise<TemplatePreviewResponse> {
    const wireBody = {
      template: typeof request.template === 'string' ? { body: request.template } : request.template,
      variables: request.variables || {},
      recipient: typeof request.recipient === 'string' ? { email: request.recipient } : request.recipient,
    };

    const res = await this.http.request<TemplatePreviewResponse>('/v1/messages/templates/preview', {
      method: 'POST',
      body: wireBody,
      ...options,
    });

    return {
      subject: res.subject,
      body: res.body,
      text: res.text,
      html: res.html,
      rendered: res.rendered || res.text || res.body || res.html || '',
      missingVariables: res.missingVariables || [],
    };
  }
}
