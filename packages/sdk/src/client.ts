/**
 * @convey/sdk - Convey Main Client
 * Primary entry point for the Convey communication service.
 */

import type { MessageBuilder } from './builder';
import { HttpClient } from './http';
import type { ConveyMiddleware } from './middleware';
import { AdminResource } from './resources/admin';
import { BatchesResource } from './resources/batches';
import { DlqResource } from './resources/dlq';
import { InboxResource } from './resources/inbox';
import { MessagesResource } from './resources/messages';
import { PreferencesResource } from './resources/preferences';
import { ReportsResource } from './resources/reports';
import { SandboxResource } from './resources/sandbox';
import { SuppressionsResource } from './resources/suppressions';
import { TemplatesResource } from './resources/templates';
import { WebhooksResource } from './resources/webhooks';
import type { ConveyClientOptions, ConveyWebhookEvent } from './types';
import { constructWebhookEvent, verifyWebhookSignature } from './utils/crypto';
import {
  createWebhookHandler,
  type GenerateTestEventOptions,
  generateTestWebhookEvent,
  type WebhookHandler,
  type WebhookHandlerConfig,
} from './webhooks-handler';

export class Convey {
  readonly http: HttpClient;
  readonly messages: MessagesResource;
  readonly batches: BatchesResource;
  readonly suppressions: SuppressionsResource;
  readonly webhooks: WebhooksResource;
  readonly dlq: DlqResource;
  readonly sandbox: SandboxResource;
  readonly reports: ReportsResource;
  readonly admin: AdminResource;
  readonly templates: TemplatesResource;
  readonly preferences: PreferencesResource;
  readonly inbox: InboxResource;
  private readonly rawOptions: ConveyClientOptions;

  constructor(options: ConveyClientOptions = {}) {
    this.rawOptions = { ...options };
    this.http = new HttpClient(options);
    this.messages = new MessagesResource(this.http);
    this.batches = new BatchesResource(this.http);
    this.suppressions = new SuppressionsResource(this.http);
    this.webhooks = new WebhooksResource(this.http);
    this.dlq = new DlqResource(this.http);
    this.sandbox = new SandboxResource(this.http);
    this.reports = new ReportsResource(this.http);
    this.admin = new AdminResource(this.http);
    this.templates = new TemplatesResource(this.http);
    this.preferences = new PreferencesResource(this.http);
    this.inbox = new InboxResource(this.http);
  }

  /**
   * Get the current effective base URL.
   */
  get baseUrl(): string {
    return this.http.baseUrl;
  }

  /**
   * Helper method to retrieve current base URL.
   */
  getBaseUrl(): string {
    return this.http.baseUrl;
  }

  /**
   * Dynamically update the base URL for subsequent client requests.
   */
  setBaseUrl(url: string): void {
    this.http.setBaseUrl(url);
  }

  /**
   * Register a middleware interceptor into the client pipeline.
   */
  use(middleware: ConveyMiddleware): this {
    this.http.use(middleware);
    return this;
  }

  /**
   * Create an ergonomic fluent MessageBuilder attached to this client.
   */
  message<TVariables = Record<string, unknown>, TMetadata = Record<string, unknown>>(): MessageBuilder<
    TVariables,
    TMetadata
  > {
    return this.messages.builder<TVariables, TMetadata>();
  }

  /**
   * Create a scoped clone of this client with a specific default team ID boundary.
   */
  withTeam(teamId: string): Convey {
    return new Convey({
      ...this.rawOptions,
      baseUrl: this.http.baseUrl,
      teamId,
    });
  }

  /**
   * Create a clone of this client with overridden options.
   */
  withOptions(overrides: Partial<ConveyClientOptions>): Convey {
    return new Convey({
      ...this.rawOptions,
      baseUrl: overrides.baseUrl || this.http.baseUrl,
      ...overrides,
    });
  }

  /**
   * Static cryptographic webhook verification and framework adapter helpers.
   */
  static readonly webhooks = {
    /**
     * Verify the cryptographic HMAC-SHA256 signature on an incoming Convey webhook payload.
     */
    verifySignature(
      payload: string | Uint8Array,
      signature: string,
      secret: string,
      toleranceSeconds = 300,
    ): Promise<boolean> {
      return verifyWebhookSignature(payload, signature, secret, toleranceSeconds);
    },

    /**
     * Verify signature and deserialize the incoming webhook payload into a typed Convey event.
     */
    constructEvent<T = Record<string, unknown>>(
      payload: string | Uint8Array,
      signature: string,
      secret: string,
      toleranceSeconds = 300,
    ): Promise<ConveyWebhookEvent<T>> {
      return constructWebhookEvent<T>(payload, signature, secret, toleranceSeconds);
    },

    /**
     * Create a framework-agnostic webhook receiver and event router (Next.js, Cloudflare, Express, Hono).
     */
    createHandler<T = Record<string, unknown>>(config: WebhookHandlerConfig<T>): WebhookHandler<T> {
      return createWebhookHandler<T>(config);
    },

    /**
     * Generate a cryptographically valid mock webhook event and signature header for local unit testing.
     */
    generateTestEvent<T = Record<string, unknown>>(options: GenerateTestEventOptions<T>) {
      return generateTestWebhookEvent<T>(options);
    },
  };
}

// Alias for developers preferring ConveyClient naming
export const ConveyClient = Convey;
