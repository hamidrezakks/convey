/**
 * @convey/sdk - Fluent Message & Batch Builders
 * Chainable developer-friendly DSL for crafting and dispatching omnichannel messages and bulk workloads.
 */

import { ConveyConfigurationError } from './errors';
import type { MessagesResource } from './resources/messages';
import {
  type BulkMessageResponse,
  Channel,
  type ChannelType,
  type MessageAcceptedResponse,
  type MessageContent,
  MessagePriority,
  type MessagePriorityType,
  type RequestOptions,
  type SendMessageRequest,
  type TemplatePreviewResponse,
} from './types';

export class MessageBuilder<TVariables = Record<string, unknown>, TMetadata = Record<string, unknown>> {
  private readonly messagesResource?: MessagesResource;
  private req: Partial<SendMessageRequest<TVariables, TMetadata>> = {};
  private contentObj: Partial<MessageContent<TVariables>> = {};

  constructor(messagesResource?: MessagesResource) {
    this.messagesResource = messagesResource;
  }

  to(recipient: string): this {
    this.req.recipient = recipient;
    return this;
  }

  channel(channel: ChannelType): this {
    this.req.channel = channel;
    return this;
  }

  email(options: { to?: string; subject: string; html?: string; text?: string; body?: string }): this {
    this.req.channel = Channel.EMAIL;
    if (options.to) this.req.recipient = options.to;
    this.contentObj.subject = options.subject;
    this.contentObj.body = options.html || options.text || options.body || '';
    return this;
  }

  sms(options: { to?: string; body: string }): this {
    this.req.channel = Channel.SMS;
    if (options.to) this.req.recipient = options.to;
    this.contentObj.body = options.body;
    return this;
  }

  whatsapp(options: { to?: string; body?: string; templateId?: string; variables?: TVariables }): this {
    this.req.channel = Channel.WHATSAPP;
    if (options.to) this.req.recipient = options.to;
    if (options.body) this.contentObj.body = options.body;
    if (options.templateId) this.contentObj.templateId = options.templateId;
    if (options.variables) this.contentObj.variables = options.variables;
    return this;
  }

  slack(options: { channelId?: string; text: string }): this {
    this.req.channel = Channel.SLACK;
    if (options.channelId) this.req.recipient = options.channelId;
    this.contentObj.body = options.text;
    return this;
  }

  push(options: { token?: string; title?: string; body: string }): this {
    this.req.channel = Channel.PUSH;
    if (options.token) this.req.recipient = options.token;
    if (options.title) this.contentObj.subject = options.title;
    this.contentObj.body = options.body;
    return this;
  }

  subject(subject: string): this {
    this.contentObj.subject = subject;
    return this;
  }

  body(body: string): this {
    this.contentObj.body = body;
    return this;
  }

  html(html: string): this {
    this.contentObj.body = html;
    return this;
  }

  template(templateId: string, variables?: TVariables): this {
    this.contentObj.templateId = templateId;
    if (variables) {
      this.contentObj.variables = variables;
    }
    return this;
  }

  variables(variables: TVariables): this {
    this.contentObj.variables = variables;
    this.req.variables = variables;
    return this;
  }

  metadata(metadata: TMetadata): this {
    this.req.metadata = metadata;
    return this;
  }

  priority(priority: MessagePriorityType): this {
    this.req.priority = priority;
    return this;
  }

  scheduledAt(date: Date | string | number): this {
    this.req.scheduledAt = new Date(date).toISOString();
    return this;
  }

  idempotencyKey(key: string): this {
    this.req.idempotencyKey = key;
    return this;
  }

  team(teamId: string): this {
    this.req.team = teamId;
    return this;
  }

  userId(userId: string): this {
    this.req.userId = userId;
    return this;
  }

  category(category: string): this {
    this.req.category = category;
    return this;
  }

  country(country: string): this {
    this.req.country = country;
    return this;
  }

  build(): SendMessageRequest<TVariables, TMetadata> {
    const payload: SendMessageRequest<TVariables, TMetadata> = {
      channel: this.req.channel || Channel.EMAIL,
      recipient: this.req.recipient || '',
      priority: this.req.priority || MessagePriority.DEFAULT,
      content: Object.keys(this.contentObj).length > 0 ? (this.contentObj as MessageContent<TVariables>) : undefined,
      ...this.req,
    };
    return payload;
  }

  async send(options?: RequestOptions): Promise<MessageAcceptedResponse> {
    if (!this.messagesResource) {
      throw new Error(
        'MessageBuilder was created standalone without a client context. Call builder.build() and pass to convey.messages.send().',
      );
    }
    return this.messagesResource.send(this.build(), options);
  }

  async preview(options?: RequestOptions): Promise<TemplatePreviewResponse> {
    if (!this.messagesResource) {
      throw new Error(
        'MessageBuilder was created standalone without a client context. Call convey.messages.previewTemplate().',
      );
    }
    return this.messagesResource.previewTemplate(
      {
        template: this.contentObj.templateId || this.contentObj.body || '',
        variables: (this.contentObj.variables || {}) as Record<string, unknown>,
        recipient: this.req.recipient,
      },
      options,
    );
  }
}

export interface BatchDispatchOptions {
  /**
   * Maximum messages per bulk HTTP request.
   * @default 100
   */
  chunkSize?: number;

  /**
   * Maximum parallel bulk HTTP requests.
   * @default 3
   */
  concurrency?: number;

  /**
   * Progress callback invoked as messages are accepted.
   */
  onProgress?: (completed: number, total: number) => void;

  /**
   * Additional HTTP request options for the bulk calls.
   */
  requestOptions?: RequestOptions;
}

export class BatchBuilder {
  private readonly messagesResource?: MessagesResource;
  private readonly messages: Array<SendMessageRequest<Record<string, unknown>, Record<string, unknown>>> = [];

  constructor(messagesResource?: MessagesResource) {
    this.messagesResource = messagesResource;
  }

  add(message: SendMessageRequest | MessageBuilder): this {
    const msg = message instanceof MessageBuilder ? message.build() : message;
    this.messages.push(msg as SendMessageRequest<Record<string, unknown>, Record<string, unknown>>);
    return this;
  }

  addAll(messages: Array<SendMessageRequest | MessageBuilder>): this {
    for (const m of messages) {
      this.add(m);
    }
    return this;
  }

  build(): Array<SendMessageRequest<Record<string, unknown>, Record<string, unknown>>> {
    return [...this.messages];
  }

  get length(): number {
    return this.messages.length;
  }

  async dispatch(options: BatchDispatchOptions = {}): Promise<BulkMessageResponse> {
    if (!this.messagesResource) {
      throw new Error('BatchBuilder was created standalone without a client context.');
    }

    const total = this.messages.length;
    if (total === 0) {
      return { total: 0, items: [] };
    }

    const chunkSize = Math.max(1, options.chunkSize ?? 100);
    const concurrency = Math.max(1, options.concurrency ?? 3);

    const chunks: Array<Array<SendMessageRequest<Record<string, unknown>, Record<string, unknown>>>> = [];
    for (let i = 0; i < total; i += chunkSize) {
      chunks.push(this.messages.slice(i, i + chunkSize));
    }

    const allItems: MessageAcceptedResponse[] = [];
    let completedCount = 0;

    // Concurrency pool
    let activeIndex = 0;
    if (!this.messagesResource) {
      throw new ConveyConfigurationError(
        'BatchBuilder requires a MessagesResource instance to dispatch messages. Pass client.messages to builder().',
      );
    }

    const messagesResource = this.messagesResource;
    const worker = async () => {
      while (activeIndex < chunks.length) {
        const chunkIndex = activeIndex++;
        const chunk = chunks[chunkIndex];
        const res = await messagesResource.sendBulk(chunk, options.requestOptions);
        allItems.push(...res.items);
        completedCount += chunk.length;
        if (options.onProgress) {
          options.onProgress(completedCount, this.messages.length);
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, chunks.length) }, () => worker());
    await Promise.all(workers);

    return {
      total: allItems.length,
      items: allItems,
    };
  }
}
