/**
 * @convey/sdk - Webhooks Resource Client
 * Webhook subscription management, cryptographic HMAC-SHA256 signature verification,
 * and typed event payload deserialization.
 */

import type { HttpClient } from '../http';
import type {
  ConveyWebhookEvent,
  CreateWebhookSubscriptionRequest,
  CreateWebhookSubscriptionResponse,
  ListWebhookSubscriptionsResponse,
  RequestOptions,
} from '../types';
import { constructWebhookEvent, verifyWebhookSignature } from '../utils/crypto';

export class WebhookSubscriptionsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * Register a new webhook endpoint subscription to receive real-time message lifecycle events.
   */
  async create(
    request: CreateWebhookSubscriptionRequest,
    options?: RequestOptions,
  ): Promise<CreateWebhookSubscriptionResponse> {
    return this.http.request<CreateWebhookSubscriptionResponse>('/v1/webhook-subscriptions', {
      method: 'POST',
      body: request,
      ...options,
    });
  }

  /**
   * List all configured webhook subscriptions.
   */
  async list(options?: RequestOptions): Promise<ListWebhookSubscriptionsResponse> {
    return this.http.request<ListWebhookSubscriptionsResponse>('/v1/webhook-subscriptions', {
      method: 'GET',
      ...options,
    });
  }

  /**
   * Delete a webhook subscription by ID.
   */
  async delete(id: string, options?: RequestOptions): Promise<{ success: boolean }> {
    return this.http.request<{ success: boolean }>(`/v1/webhook-subscriptions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      ...options,
    });
  }

  /**
   * Trigger a test ping event to verify the target webhook endpoint connectivity.
   */
  async test(id: string, options?: RequestOptions): Promise<{ success: boolean; message: string }> {
    return this.http.request<{ success: boolean; message: string }>(
      `/v1/webhook-subscriptions/${encodeURIComponent(id)}/test`,
      {
        method: 'POST',
        ...options,
      },
    );
  }
}

export class WebhooksResource {
  readonly subscriptions: WebhookSubscriptionsResource;

  constructor(http: HttpClient) {
    this.subscriptions = new WebhookSubscriptionsResource(http);
  }

  /**
   * Verify the cryptographic HMAC-SHA256 signature on an incoming Convey webhook payload.
   *
   * @param payload Raw string or Uint8Array payload received from the HTTP request body.
   * @param signature Value of the `x-convey-signature` HTTP header.
   * @param secret Webhook signing secret configured for the subscription.
   * @param toleranceSeconds Maximum acceptable clock skew in seconds (default: 300).
   */
  async verifySignature(
    payload: string | Uint8Array,
    signature: string,
    secret: string,
    toleranceSeconds = 300,
  ): Promise<boolean> {
    return verifyWebhookSignature(payload, signature, secret, toleranceSeconds);
  }

  /**
   * Verify signature and deserialize the incoming webhook payload into a typed Convey event.
   * Throws `ConveySecurityError` if signature verification fails or payload is malformed.
   */
  async constructEvent<T = Record<string, unknown>>(
    payload: string | Uint8Array,
    signature: string,
    secret: string,
    toleranceSeconds = 300,
  ): Promise<ConveyWebhookEvent<T>> {
    return constructWebhookEvent<T>(payload, signature, secret, toleranceSeconds);
  }
}
