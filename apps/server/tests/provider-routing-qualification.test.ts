import { expect, spyOn, test } from 'bun:test';
import { Channel } from '../src/modules/messaging/messaging.types';
import { ProviderRegistry } from '../src/modules/providers/core/provider-registry';
import { SmartProviderRouter } from '../src/modules/providers/core/smart-router';

test('routing retains validated database configuration for adapters without lifecycle hooks', async () => {
  const id = `mock-route-${crypto.randomUUID()}`;
  let enabled = true;
  ProviderRegistry.registerModule({
    id,
    channel: Channel.SMS,
    capabilities: {
      supportsBulk: false,
      supportsDeliveryReceipts: false,
      supportsReadReceipts: false,
      supportsAttachments: false,
      supportsTemplates: false,
      supportsMedia: false,
    },
    adapter: {
      id,
      channel: Channel.SMS,
      capabilities: {
        supportsBulk: false,
        supportsDeliveryReceipts: false,
        supportsReadReceipts: false,
        supportsAttachments: false,
        supportsTemplates: false,
        supportsMedia: false,
      },
      hasSetup: (config) => enabled && config?.apiKey === 'mock',
      send: async () => ({ success: true, providerMessageId: 'mock' }),
      transformRequest: (options) => options,
      transformResponse: () => ({ success: true, providerMessageId: 'mock' }),
    },
  });
  try {
    await ProviderRegistry.initializeProvider(id, { apiKey: 'mock' }, Channel.SMS);
    expect(ProviderRegistry.getConfiguredAdaptersByChannel(Channel.SMS).some((adapter) => adapter.id === id)).toBe(
      true,
    );
    expect(ProviderRegistry.getConfiguredAdaptersByChannel(Channel.SMS, {}).some((adapter) => adapter.id === id)).toBe(
      false,
    );
    expect(ProviderRegistry.hasSetup(id, {}, Channel.SMS)).toBe(false);
  } finally {
    enabled = false;
  }
});
test('an empty SMS routing pool never falls back to an email provider', () => {
  const configured = spyOn(ProviderRegistry, 'getConfiguredAdaptersByChannel').mockReturnValue([]);
  const all = spyOn(ProviderRegistry, 'getByChannel').mockReturnValue([]);
  try {
    const router = new SmartProviderRouter();
    expect(router.selectOptimalProvider(Channel.SMS)).toBe('twilio');
    expect(router.getDecisionTrace(Channel.SMS).selected).toBe('twilio');
  } finally {
    configured.mockRestore();
    all.mockRestore();
  }
});
