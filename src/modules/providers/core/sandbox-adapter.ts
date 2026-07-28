import { generateMessageId } from '../../../utils/id';
import type { ProviderCapabilities, ProviderSendOptions, ProviderSendResult } from './provider-types';

export class SandboxAdapter {
  readonly id = 'sandbox';
  readonly name = 'Convey Sandbox Mock Provider';
  readonly capabilities: ProviderCapabilities = {
    supportsBulk: true,
    supportsDeliveryReceipts: true,
    supportsReadReceipts: true,
    supportsAttachments: true,
    supportsTemplates: true,
    supportsMedia: true,
  };

  async send(options: ProviderSendOptions): Promise<ProviderSendResult> {
    // Simulate minimal sandbox dispatch processing delay
    await new Promise((resolve) => setTimeout(resolve, 20));

    const sandboxId = `sb_${generateMessageId()}`;
    return {
      success: true,
      providerMessageId: sandboxId,
      metadata: {
        sandbox: true,
        dispatchedAt: new Date().toISOString(),
        recipient: options.recipient,
      },
    };
  }
}

export const sandboxAdapter = new SandboxAdapter();
