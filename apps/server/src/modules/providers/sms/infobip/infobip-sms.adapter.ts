import type { ProviderAdapter } from '../../core/provider-adapter';
import {
  Channel,
  ErrorCategory,
  type ProviderCapabilities,
  type ProviderSendOptions,
  type ProviderSendResult,
} from '../../core/provider-types';

export class InfobipSmsAdapter implements ProviderAdapter {
  id = 'infobip-sms';
  name = 'Infobip SMS';
  channel = Channel.SMS;

  capabilities: ProviderCapabilities = {
    supportsBulk: true,
    maxBulkSize: 100,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: false,
    supportsAttachments: false,
    supportsTemplates: false,
    supportsMedia: false,
  };

  private apiKey: string;
  private baseUrl: string;

  constructor(config?: { apiKey?: string; baseUrl?: string }) {
    this.apiKey = config?.apiKey || '';
    this.baseUrl = config?.baseUrl || 'https://api.infobip.com';
  }

  hasSetup(configOverride?: { apiKey?: string; baseUrl?: string }): boolean {
    const apiKey = configOverride?.apiKey || this.apiKey;
    return Boolean(apiKey);
  }

  async send(options: ProviderSendOptions): Promise<ProviderSendResult> {
    const to = options.recipient.phone as string;
    const text = (options.content.text as string) || '';
    const from = (options.content.from as string) || 'Convey';

    if (!to) {
      return {
        success: false,
        error: { code: 'INVALID_RECIPIENT', message: 'Recipient phone is required', category: ErrorCategory.PERMANENT },
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/sms/2/text/advanced`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `App ${this.apiKey}`,
        },
        body: JSON.stringify({
          messages: [
            {
              from,
              destinations: [{ to }],
              text,
            },
          ],
        }),
      });

      const data = (await response.json()) as { messages?: Array<{ messageId?: string; status?: { name: string } }> };
      const msg = data.messages?.[0];

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: `INFOBIP_${response.status}`,
            message: 'Infobip SMS send failed',
            category: response.status >= 500 ? ErrorCategory.TRANSIENT : ErrorCategory.PERMANENT,
          },
        };
      }

      return {
        success: true,
        providerMessageId: msg?.messageId,
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: { code: 'FETCH_ERROR', message: (err as Error).message, category: ErrorCategory.TRANSIENT },
      };
    }
  }
}
