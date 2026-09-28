import { ProviderRegistry } from '../../apps/server/src/modules/providers/core/provider-registry';
import { COMPLETE_88_PROVIDER_CATALOG } from '../../packages/shared/src/provider-catalog';
import { isNativeProviderIncomplete } from '../../packages/shared/src/provider-readiness';

const rows = COMPLETE_88_PROVIDER_CATALOG.map((provider) => {
  const adapter = ProviderRegistry.getModule(provider.id)?.adapter;
  if (!adapter) throw new Error(`Missing adapter: ${provider.id}`);
  const c = adapter.capabilities;
  return `| ${provider.id} | ${provider.channel} | ${isNativeProviderIncomplete(provider.id) ? 'disabled / incomplete' : 'implemented / unverified'} | ${c.supportsBulk} | ${c.supportsDeliveryReceipts} | ${c.supportsAttachments} | ${c.supportsTemplates} |`;
});
const content = `# Provider capability inventory\n\nGenerated from the catalog and adapter declarations. Declarations describe implementation intent, not certification. All live certification remains unverified; the owner requested mock-only qualification. No provider is declared v1-supported by this inventory.\n\n| Provider | Channel | Status | Bulk | Delivery receipts | Attachments | Templates |\n| --- | --- | --- | --- | --- | --- | --- |\n${rows.join('\n')}\n\nAPI versions, inbound support, regions and price models require provider-specific evidence; they are not inferred from names or credentials. Sandbox acceptance does not verify these capabilities. Production pricing must be explicitly configured.\n\nMock qualification references: provider-delivery-contracts, provider-configuration-contracts, provider-resilience-corner-cases, provider-certification, webhook-signatures, and budget-service tests under apps/server/tests. Passing generic contracts does not certify every declared capability.\n\nInitial focused mock shortlist: Resend email and Twilio SMS, with existing SMTP, SES, SNS, Outlook, APNs, FCM and Azure contract coverage retained. Additional advertised providers remain subject to per-capability verification before first release.\n`;
const path = new URL('../../docs/operations/provider-capability-matrix.md', import.meta.url);
if (process.argv.includes('--check')) {
  if ((await Bun.file(path).text()) !== content)
    throw new Error('Provider inventory drift: run qualification:inventory');
} else await Bun.write(path, content);
console.log(`Verified ${rows.length} catalog adapters; live certification is not claimed`);
