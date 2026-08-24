/**
 * @convey/sdk - Convey Main Client
 * Primary entry point for the Convey communication service.
 */

import { HttpClient } from './http';
import { AdminResource } from './resources/admin';
import { BatchesResource } from './resources/batches';
import { DlqResource } from './resources/dlq';
import { MessagesResource } from './resources/messages';
import { ReportsResource } from './resources/reports';
import { SandboxResource } from './resources/sandbox';
import { SuppressionsResource } from './resources/suppressions';
import { WebhooksResource } from './resources/webhooks';
import type { ConveyClientOptions, ConveyWebhookEvent } from './types';
import { constructWebhookEvent, verifyWebhookSignature } from './utils/crypto';

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

  constructor(options: ConveyClientOptions) {
    this.http = new HttpClient(options);
    this.messages = new MessagesResource(this.http);
    this.batches = new BatchesResource(this.http);
    this.suppressions = new SuppressionsResource(this.http);
    this.webhooks = new WebhooksResource(this.http);
    this.dlq = new DlqResource(this.http);
    this.sandbox = new SandboxResource(this.http);
    this.reports = new ReportsResource(this.http);
    this.admin = new AdminResource(this.http);
  }

  /**
   * Static cryptographic webhook verification helpers.
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
  };
}

// Alias for developers preferring ConveyClient naming
export const ConveyClient = Convey;
