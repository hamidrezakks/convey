import type { HttpClient } from '../http';
import type {
  PreferenceCheckResult,
  RecipientPreferencesDto,
  RequestOptions,
  SubscriptionTopicDto,
} from '../types';

export class PreferencesResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List subscription topics.
   */
  async listTopics(
    tenantId: string,
    team: string,
    options?: RequestOptions,
  ): Promise<{ success: boolean; topics: SubscriptionTopicDto[] }> {
    return this.http.request<{ success: boolean; topics: SubscriptionTopicDto[] }>(
      '/api/v1/plugins/preferences/topics',
      {
        method: 'GET',
        query: { tenantId, team },
        ...options,
      },
    );
  }

  /**
   * Create or update a subscription topic.
   */
  async createTopic(
    data: {
      tenantId: string;
      team: string;
      key: string;
      name: string;
      description?: string;
      isMandatory?: boolean;
    },
    options?: RequestOptions,
  ): Promise<{ success: boolean; topic: SubscriptionTopicDto }> {
    return this.http.request<{ success: boolean; topic: SubscriptionTopicDto }>(
      '/api/v1/plugins/preferences/topics',
      {
        method: 'POST',
        body: data,
        ...options,
      },
    );
  }

  /**
   * Get recipient preferences.
   */
  async getPreferences(
    tenantId: string,
    recipientId: string,
    options?: RequestOptions,
  ): Promise<{ success: boolean; preferences: RecipientPreferencesDto }> {
    return this.http.request<{ success: boolean; preferences: RecipientPreferencesDto }>(
      `/api/v1/plugins/preferences/${encodeURIComponent(recipientId)}`,
      {
        method: 'GET',
        query: { tenantId },
        ...options,
      },
    );
  }

  /**
   * Check dispatch consent and quiet hours.
   */
  async check(
    data: {
      tenantId: string;
      recipientId: string;
      channel: string;
      topicKey?: string;
    },
    options?: RequestOptions,
  ): Promise<{ success: boolean } & PreferenceCheckResult> {
    return this.http.request<{ success: boolean } & PreferenceCheckResult>(
      '/api/v1/plugins/preferences/check',
      {
        method: 'POST',
        body: data,
        ...options,
      },
    );
  }
}
