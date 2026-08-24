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
  MessageTimelineResponse,
  MessageTraceResponse,
  RequestOptions,
  SendMessageRequest,
  TemplatePreviewRequest,
  TemplatePreviewResponse,
} from '../types';

export class MessagesResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Dispatch a single omnichannel message with zero-provider exposure and idempotency protection.
   */
  async send<TVariables = Record<string, unknown>, TMetadata = Record<string, unknown>>(
    request: SendMessageRequest<TVariables, TMetadata>,
    options?: RequestOptions,
  ): Promise<MessageAcceptedResponse> {
    return this.http.request<MessageAcceptedResponse>('/v1/messages', {
      method: 'POST',
      body: request,
      ...options,
    });
  }

  /**
   * High-throughput bulk message dispatch into the transactional outbox pipeline.
   */
  async sendBulk<TVariables = Record<string, unknown>, TMetadata = Record<string, unknown>>(
    messages: Array<SendMessageRequest<TVariables, TMetadata>> | BulkSendMessageRequest<TVariables, TMetadata>,
    options?: RequestOptions,
  ): Promise<BulkMessageResponse> {
    const payload = Array.isArray(messages) ? { messages } : messages;
    return this.http.request<BulkMessageResponse>('/v1/messages/bulk', {
      method: 'POST',
      body: payload,
      ...options,
    });
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
  async previewTemplate(
    request: TemplatePreviewRequest,
    options?: RequestOptions,
  ): Promise<TemplatePreviewResponse> {
    return this.http.request<TemplatePreviewResponse>('/v1/messages/templates/preview', {
      method: 'POST',
      body: request,
      ...options,
    });
  }
}
