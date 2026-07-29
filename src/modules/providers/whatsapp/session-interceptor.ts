import type { ProviderSendOptions } from '../core/provider-types';
import { WhatsAppMetrics } from './metrics';
import { WhatsAppSessionTracker } from './session-tracker';
import { WhatsAppTemplateEngine } from './template-engine';

export interface WhatsAppSessionOptimizationConfig {
  enabled?: boolean;
  ttlSeconds?: number;
  fallbackToTemplateIfMissingText?: boolean;
  estimatedCostSavedUsd?: number; // Configurable per region/category (default: 0.005)
}

export enum WhatsAppOptimizationMetadataKey {
  SESSION_OPTIMIZATION_APPLIED = '_sessionOptimizationApplied',
  ORIGINAL_TEMPLATE_ID = '_originalTemplateId',
  COST_OPTIMIZATION_SAVED_USD = '_costOptimizationSavedUsd',
  OPTIMIZATION_TIMESTAMP = '_sessionOptimizationTimestamp',
}

export interface OptimizationResult {
  options: ProviderSendOptions;
  optimized: boolean;
  savedUsd?: number;
}

export async function applyWhatsAppSessionOptimization(
  providerId: string,
  options: ProviderSendOptions,
  providerConfig?: Record<string, unknown>,
): Promise<OptimizationResult> {
  const sessionConfig = (providerConfig?.sessionOptimization || providerConfig?.whatsappSessionOptimization) as
    | WhatsAppSessionOptimizationConfig
    | undefined;

  if (!sessionConfig?.enabled) {
    return { options, optimized: false };
  }

  const templateId = options.content.templateId as string | undefined;
  if (!templateId) {
    return { options, optimized: false };
  }

  const rawPhone = (options.recipient.phone || options.recipient.to || options.recipient.whatsapp) as
    | string
    | string[]
    | undefined;

  const phoneString = Array.isArray(rawPhone) ? rawPhone[0] : rawPhone;
  if (!phoneString) {
    return { options, optimized: false };
  }

  // Fast-path 24h window check (0.01ms L1 cache -> Redis)
  const isSessionActive = await WhatsAppSessionTracker.hasActiveSession(providerId, phoneString);
  if (!isSessionActive) {
    return { options, optimized: false };
  }

  // Resolve template body text: payload -> Redis cache
  let bodyText = options.content.templateBody as string | undefined;

  if (bodyText) {
    // Non-blocking background auto-cache of template body for future dispatches
    WhatsAppTemplateEngine.cacheTemplateBody(providerId, templateId, bodyText).catch(() => {});
  } else {
    bodyText = (await WhatsAppTemplateEngine.getTemplateBody(providerId, templateId)) || undefined;
  }

  if (!bodyText) {
    // Fall back safely to standard template message send if text body is unknown
    return { options, optimized: false };
  }

  const variables = (options.content.variables || options.content.data || {}) as Record<string, unknown>;
  const renderedText = WhatsAppTemplateEngine.render(bodyText, variables);

  const estimatedSavedUsd = sessionConfig.estimatedCostSavedUsd ?? 0.005;

  const optimizedContent = {
    ...options.content,
    text: renderedText,
    body: renderedText,
    templateId: undefined, // Stripping templateId turns this into standard text message in transformers!
    [WhatsAppOptimizationMetadataKey.ORIGINAL_TEMPLATE_ID]: templateId,
  };

  // Record Prometheus metrics asynchronously without blocking hot path
  WhatsAppMetrics.recordOptimizationApplied(providerId, estimatedSavedUsd);

  return {
    options: {
      ...options,
      content: optimizedContent,
      metadata: {
        ...options.metadata,
        [WhatsAppOptimizationMetadataKey.SESSION_OPTIMIZATION_APPLIED]: true,
        [WhatsAppOptimizationMetadataKey.ORIGINAL_TEMPLATE_ID]: templateId,
        [WhatsAppOptimizationMetadataKey.COST_OPTIMIZATION_SAVED_USD]: estimatedSavedUsd,
        [WhatsAppOptimizationMetadataKey.OPTIMIZATION_TIMESTAMP]: new Date().toISOString(),
      },
    },
    optimized: true,
    savedUsd: estimatedSavedUsd,
  };
}
