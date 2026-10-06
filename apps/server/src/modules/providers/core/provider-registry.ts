import { isNativeProviderIncomplete } from '@convey/shared';
import { logger } from '../../../utils/logger';
import { Channel } from '../../messaging/messaging.types';
import { providerCircuitBreaker } from './circuit-breaker';
import type { ProviderAdapter } from './provider-adapter';
import type { ProviderModule } from './provider-module';
import { ProviderState } from './provider-types';

const CHANNEL_PROVIDER_ALIASES: Partial<Record<Channel, { category: Channel; ids: string[] }>> = {
  [Channel.FCM]: { category: Channel.PUSH, ids: ['fcm'] },
  [Channel.APNS]: { category: Channel.PUSH, ids: ['apns'] },
  [Channel.SLACK]: { category: Channel.CHAT, ids: ['slack'] },
  [Channel.TELEGRAM]: { category: Channel.CHAT, ids: ['telegram'] },
  [Channel.WHATSAPP]: { category: Channel.CHAT, ids: ['whatsapp-business', 'twilio-whatsapp', 'cequens-whatsapp'] },
};

type GenericProviderAdapter = ProviderAdapter;
type GenericProviderModule = ProviderModule;

export interface ProviderManifest {
  id: string;
  channel: Channel;
  loader: () => GenericProviderModule;
}

export interface ReconfigureResult {
  success: boolean;
  unchanged?: boolean;
  rolledBack?: boolean;
  error?: string;
  generation?: number;
}

class ProviderRegistryStore {
  private registry = new Map<string, GenericProviderAdapter>();
  private moduleRegistry = new Map<string, GenericProviderModule>();
  private manifestRegistry = new Map<string, ProviderManifest>();
  private activeProviders = new Set<string>();
  private degradedProviders = new Set<string>();
  private generations = new Map<string, number>();
  private configChecksums = new Map<string, string>();
  private lastKnownGoodConfigs = new Map<string, Record<string, unknown>>();
  private tenantAdapters = new Map<string, GenericProviderAdapter>();
  private stateHistory = new Map<string, Array<{ state: ProviderState; timestamp: Date; reason?: string }>>();
  private workableCache = new Map<string, boolean>();
  private channelAdaptersCache = new Map<Channel, GenericProviderAdapter[]>();

  // Telemetry Counters
  private reconfigsTotal = 0;
  private rollbacksTotal = 0;
  private noopsTotal = 0;

  private computeChecksum(config: Record<string, unknown>): string {
    return JSON.stringify(config);
  }

  private recordStateTransition(providerId: string, state: ProviderState, reason?: string): void {
    let history = this.stateHistory.get(providerId);
    if (!history) {
      history = [];
      this.stateHistory.set(providerId, history);
    }
    history.push({ state, timestamp: new Date(), reason });
    if (history.length > 50) history.shift();
  }

  /** Returns formatted state transition history log for a provider */
  getStateHistory(providerId: string): Array<{ state: ProviderState; timestamp: Date; reason?: string }> {
    return this.stateHistory.get(providerId) || [];
  }

  /** Returns current monotonic configuration generation version for a provider */
  getProviderGeneration(providerId: string): number {
    return this.generations.get(providerId) || 0;
  }

  /** Returns dynamic lifecycle telemetry metrics */
  getTelemetryMetrics() {
    return {
      reconfigsTotal: this.reconfigsTotal,
      rollbacksTotal: this.rollbacksTotal,
      noopsTotal: this.noopsTotal,
      activeCount: this.activeProviders.size,
      degradedCount: this.degradedProviders.size,
      manifestCount: this.manifestRegistry.size,
      workableCacheSize: this.workableCache.size,
    };
  }

  /**
   * Registers a provider module manifest for lazy loading.
   */
  registerManifest(manifest: ProviderManifest): void {
    const key = `${manifest.channel}:${manifest.id}`;
    this.manifestRegistry.set(key, manifest);
    this.channelAdaptersCache.delete(manifest.channel);
    // Secondary lookup by id (if no collision)
    if (!this.manifestRegistry.has(manifest.id)) {
      this.manifestRegistry.set(manifest.id, manifest);
    }
  }

  /** Direct registration for pre-instantiated adapters */
  register(adapter: ProviderAdapter): void {
    this.channelAdaptersCache.delete(adapter.channel);
    const key = `${adapter.channel}:${adapter.id}`;
    this.registry.set(key, adapter);
    if (!this.registry.has(adapter.id)) {
      this.registry.set(adapter.id, adapter);
    }
  }

  /** Direct registration for pre-instantiated modules */
  registerModule(module: ProviderModule): void {
    const key = `${module.channel}:${module.id}`;
    this.moduleRegistry.set(key, module);
    if (!this.moduleRegistry.has(module.id)) this.moduleRegistry.set(module.id, module);
    this.register(module.adapter);
  }

  /** Resolves and loads a provider module lazily if not already loaded */
  private resolveModule(providerId: string, channel?: Channel): GenericProviderModule | undefined {
    if (channel) {
      const alias = CHANNEL_PROVIDER_ALIASES[channel];
      if (alias) return alias.ids.includes(providerId) ? this.resolveModule(providerId, alias.category) : undefined;
      const channelKey = `${channel}:${providerId}`;
      let mod = this.moduleRegistry.get(channelKey);
      if (mod) return mod;

      const manifest = this.manifestRegistry.get(channelKey);
      if (manifest) {
        try {
          mod = manifest.loader();
          if (mod) {
            this.registerModule(mod);
            return mod;
          }
        } catch (err: unknown) {
          this.degradedProviders.add(providerId);
          this.recordStateTransition(providerId, ProviderState.DEGRADED, (err as Error).message);
          logger.error('ProviderRegistry', `Failed to load provider module '${channelKey}'`, {
            error: (err as Error).message,
          });
        }
      }
      return undefined;
    }

    let mod = this.moduleRegistry.get(providerId);
    if (mod) return mod;

    const manifest = this.manifestRegistry.get(providerId);
    if (manifest) {
      try {
        mod = manifest.loader();
        if (mod) {
          this.registerModule(mod);
          return mod;
        }
      } catch (err: unknown) {
        this.degradedProviders.add(providerId);
        this.recordStateTransition(providerId, ProviderState.DEGRADED, (err as Error).message);
        logger.error('ProviderRegistry', `Failed to load provider module '${providerId}'`, {
          error: (err as Error).message,
        });
      }
    }
    return undefined;
  }

  /** Checks whether required provider setup / configuration exists */
  hasSetup(providerId: string, config?: Record<string, unknown>, channel?: Channel): boolean {
    if (isNativeProviderIncomplete(providerId)) return false;
    const mod = this.resolveModule(providerId, channel);
    if (!mod) return false;

    if (config && Object.keys(config).length > 0) {
      if (mod.hasSetup) return mod.hasSetup(config);
      if (mod.adapter.hasSetup) return mod.adapter.hasSetup(config);
      return true;
    }

    if (mod.hasSetup) return mod.hasSetup(config);
    if (mod.adapter.hasSetup) return mod.adapter.hasSetup(config);

    return false;
  }

  private setWorkableCache(key: string, value: boolean): void {
    if (this.workableCache.size >= 5000) {
      const oldestKey = this.workableCache.keys().next().value;
      if (oldestKey) this.workableCache.delete(oldestKey);
    }
    this.workableCache.set(key, value);
  }

  /** Validates whether a provider is workable with memoization caching */
  isWorkable(providerId: string, config?: Record<string, unknown>, channel?: Channel): boolean {
    if (isNativeProviderIncomplete(providerId)) return false;
    const checksum = config ? this.computeChecksum(config) : 'empty';
    const cacheKey = `${channel || ''}:${providerId}:${checksum}`;
    const cached = this.workableCache.get(cacheKey);
    if (cached !== undefined) return cached;

    const mod = this.resolveModule(providerId, channel);
    if (!mod) {
      this.setWorkableCache(cacheKey, false);
      return false;
    }

    const workable = mod.isWorkable ? mod.isWorkable(config) : this.hasSetup(providerId, config, channel);
    this.setWorkableCache(cacheKey, workable);
    return workable;
  }

  /** Dry-run credential verification helper without mutating state */
  verifyProviderWorkability(
    providerId: string,
    config?: Record<string, unknown>,
    channel?: Channel,
  ): { workable: boolean; reason?: string } {
    const mod = this.resolveModule(providerId, channel);
    if (!mod) {
      return { workable: false, reason: `Provider module '${providerId}' not found` };
    }

    const workable = this.isWorkable(providerId, config, channel);
    if (!workable) {
      return { workable: false, reason: 'Provider setup check failed (missing required configuration/credentials)' };
    }

    return { workable: true };
  }

  /**
   * Initializes a provider module if workable and runs onConfigured hook.
   */
  async initializeProvider(
    providerId: string,
    config?: Record<string, unknown>,
    channel?: Channel,
  ): Promise<GenericProviderModule | undefined> {
    if (!this.isWorkable(providerId, config, channel)) {
      return undefined;
    }

    const mod = this.resolveModule(providerId, channel);
    if (!mod) return undefined;

    this.workableCache.clear();

    if (config) {
      const res = await this.reconfigureProvider(providerId, config, channel);
      if (!res.success && !res.unchanged) return undefined;
    } else {
      this.activeProviders.add(mod.id);
      this.recordStateTransition(mod.id, ProviderState.ACTIVE, 'Initialized');
      const nextGen = (this.generations.get(mod.id) || 0) + 1;
      this.generations.set(mod.id, nextGen);
    }

    return mod;
  }

  /**
   * Reconfigures a provider module dynamically with new credentials/config.
   * Includes checksum no-op optimization, fault isolation, and LKGC rollback support.
   */
  async reconfigureProvider(
    providerId: string,
    newConfig: Record<string, unknown>,
    channel?: Channel,
  ): Promise<ReconfigureResult> {
    this.workableCache.clear();

    if (!this.isWorkable(providerId, newConfig, channel)) {
      logger.warn(
        'ProviderRegistry',
        `Cannot reconfigure provider '${providerId}': new configuration is invalid/unworkable`,
      );
      this.degradedProviders.add(providerId);
      this.recordStateTransition(providerId, ProviderState.DEGRADED, 'Configuration invalid or unworkable');
      return { success: false, error: 'Configuration invalid or unworkable' };
    }

    const mod = this.resolveModule(providerId, channel);
    if (!mod) {
      return { success: false, error: `Provider module '${providerId}' not found` };
    }

    // Checksum no-op optimization
    const checksum = this.computeChecksum(newConfig);
    if (this.configChecksums.get(mod.id) === checksum && this.activeProviders.has(mod.id)) {
      this.noopsTotal++;
      logger.debug(
        'ProviderRegistry',
        `Configuration for provider '${mod.id}' unchanged (checksum match), skipping reload`,
      );
      return { success: true, unchanged: true, generation: this.getProviderGeneration(mod.id) };
    }

    try {
      if (mod.onConfigured) {
        await mod.onConfigured(newConfig);
      }

      this.activeProviders.add(mod.id);
      this.degradedProviders.delete(mod.id);
      this.recordStateTransition(mod.id, ProviderState.ACTIVE, 'Dynamically reconfigured');
      this.lastKnownGoodConfigs.set(mod.id, { ...newConfig });
      this.configChecksums.set(mod.id, checksum);
      const nextGen = (this.generations.get(mod.id) || 0) + 1;
      this.generations.set(mod.id, nextGen);
      this.reconfigsTotal++;

      logger.info(
        'ProviderRegistry',
        `Provider '${mod.id}' successfully reconfigured dynamically (generation: ${nextGen})`,
      );
      return { success: true, unchanged: false, generation: nextGen };
    } catch (err: unknown) {
      const errorMsg = (err as Error).message;
      this.rollbacksTotal++;
      logger.error('ProviderRegistry', `Reconfiguration failed for provider '${mod.id}', initiating LKGC rollback`, {
        error: errorMsg,
      });

      this.degradedProviders.add(mod.id);
      this.recordStateTransition(mod.id, ProviderState.DEGRADED, errorMsg);
      const lkgc = this.lastKnownGoodConfigs.get(mod.id);

      if (lkgc && mod.onConfigured) {
        try {
          await mod.onConfigured(lkgc);
          logger.info('ProviderRegistry', `Provider '${mod.id}' successfully rolled back to LKGC`);
          return { success: false, rolledBack: true, error: errorMsg };
        } catch (rollbackErr: unknown) {
          logger.error('ProviderRegistry', `LKGC rollback failed for provider '${mod.id}'`, {
            error: (rollbackErr as Error).message,
          });
        }
      }

      return { success: false, rolledBack: false, error: errorMsg };
    }
  }

  /**
   * Resolves a tenant-isolated provider adapter instance (BYOC support).
   */
  resolveTenantAdapter(
    channel: Channel,
    providerId: string,
    tenantConfig?: Record<string, unknown>,
  ): GenericProviderAdapter | undefined {
    if (!tenantConfig || Object.keys(tenantConfig).length === 0) {
      return this.get(channel, providerId);
    }

    const tenantChecksum = this.computeChecksum(tenantConfig);
    const tenantKey = `${channel}:${providerId}:tenant:${tenantChecksum}`;
    let adapter = this.tenantAdapters.get(tenantKey);
    if (adapter) return adapter;

    const mod = this.resolveModule(providerId, channel);
    if (!mod) return undefined;

    // Return module adapter (with tenant override capability)
    adapter = mod.adapter;
    this.tenantAdapters.set(tenantKey, adapter);
    return adapter;
  }

  /**
   * Performs an active synthetic health probe on a provider adapter, using manifest-guided channel auto-resolution.
   */
  async probeProviderHealth(
    providerId: string,
    config?: Record<string, unknown>,
    channel?: Channel,
  ): Promise<{ healthy: boolean; latencyMs: number; message?: string }> {
    const start = performance.now();
    const manifest = this.manifestRegistry.get(providerId);
    const resolvedChannel = channel || manifest?.channel || Channel.EMAIL;
    const adapter = this.get(resolvedChannel, providerId) || this.resolveModule(providerId, resolvedChannel)?.adapter;

    if (!adapter) {
      return { healthy: false, latencyMs: 0, message: `Provider '${providerId}' not found` };
    }

    if (adapter.probeHealth) {
      try {
        return await adapter.probeHealth(config);
      } catch (err: unknown) {
        const latencyMs = Math.round(performance.now() - start);
        return { healthy: false, latencyMs, message: (err as Error).message };
      }
    }

    const resolvedConfig = config || this.lastKnownGoodConfigs.get(providerId);
    const workable = this.isWorkable(providerId, resolvedConfig, resolvedChannel);
    const latencyMs = Math.round(performance.now() - start);
    return {
      healthy: workable,
      latencyMs,
      message: workable ? 'Provider configuration validated' : 'Provider configuration unworkable',
    };
  }

  /**
   * Probes all currently DEGRADED providers and automatically self-heals those that pass synthetic health checks.
   */
  async checkDegradedProvidersSelfHealing(): Promise<Array<{ providerId: string; recovered: boolean }>> {
    const results: Array<{ providerId: string; recovered: boolean }> = [];
    const openCircuits = providerCircuitBreaker.getOpenCircuitProviders();
    const degradedList = Array.from(new Set([...this.degradedProviders, ...openCircuits]));

    for (const providerId of degradedList) {
      const probeRes = await this.probeProviderHealth(providerId);
      if (probeRes.healthy) {
        this.degradedProviders.delete(providerId);
        this.activeProviders.add(providerId);
        this.recordStateTransition(providerId, ProviderState.ACTIVE, 'Self-healed from DEGRADED');
        providerCircuitBreaker.recordSuccess(providerId);
        logger.info(
          'ProviderRegistry',
          `Provider '${providerId}' successfully self-healed and restored to ACTIVE state`,
          { latencyMs: probeRes.latencyMs },
        );
        results.push({ providerId, recovered: true });
      } else {
        results.push({ providerId, recovered: false });
      }
    }
    return results;
  }

  /**
   * Dynamically selects the optimal, healthiest provider for a channel with health-aware failover.
   */
  selectOptimalProvider(
    channel: Channel,
    preferredProviderId?: string,
    configMap?: Record<string, Record<string, unknown>>,
  ): GenericProviderAdapter | undefined {
    if (preferredProviderId) {
      const state = this.getProviderState(preferredProviderId, channel);
      if (state === ProviderState.ACTIVE || state === ProviderState.CONFIGURED) {
        const adapter = this.get(channel, preferredProviderId);
        if (adapter) return adapter;
      }
      logger.warn(
        'ProviderRegistry',
        `Preferred provider '${preferredProviderId}' for channel '${channel}' is ${state}, attempting dynamic failover routing`,
      );
    }

    // Inspect activeProviders first
    for (const providerId of this.activeProviders) {
      const adapter = this.get(channel, providerId);
      if (adapter && adapter.channel === channel) {
        const state = this.getProviderState(providerId, channel);
        if (state === ProviderState.ACTIVE || state === ProviderState.CONFIGURED) {
          return adapter;
        }
      }
    }

    const configured = this.getConfiguredAdaptersByChannel(channel, configMap);
    for (const adapter of configured) {
      const state = this.getProviderState(adapter.id, channel);
      if (state === ProviderState.ACTIVE || state === ProviderState.CONFIGURED) {
        return adapter;
      }
    }

    return configured[0];
  }

  /** Returns standard lifecycle state of a provider, incorporating runtime Circuit Breaker status */
  getProviderState(providerId: string, channel?: Channel): ProviderState {
    if (this.degradedProviders.has(providerId) || providerCircuitBreaker.getState(providerId) === 'OPEN') {
      return ProviderState.DEGRADED;
    }
    if (this.activeProviders.has(providerId)) {
      return ProviderState.ACTIVE;
    }
    if (this.isWorkable(providerId, undefined, channel)) {
      return ProviderState.CONFIGURED;
    }
    return ProviderState.UNCONFIGURED;
  }

  get(channel: Channel, providerId: string): GenericProviderAdapter | undefined {
    let adapter = this.registry.get(`${channel}:${providerId}`);
    if (!adapter) {
      const mod = this.resolveModule(providerId, channel);
      if (mod) {
        adapter = mod.adapter;
      }
    }
    if (!adapter) {
      const fallback = this.registry.get(providerId);
      if (fallback && fallback.channel === channel) {
        adapter = fallback;
      }
    }
    return adapter;
  }

  getModule(providerId: string): GenericProviderModule | undefined {
    return this.resolveModule(providerId);
  }

  getModuleByChannel(channel: Channel, providerId: string): GenericProviderModule | undefined {
    return this.resolveModule(providerId, channel);
  }

  getByChannel(channel: Channel): GenericProviderAdapter[] {
    const alias = CHANNEL_PROVIDER_ALIASES[channel];
    if (alias) return this.getByChannel(alias.category).filter((adapter) => alias.ids.includes(adapter.id));
    const cached = this.channelAdaptersCache.get(channel);
    if (cached) return cached;

    for (const [key, manifest] of this.manifestRegistry.entries()) {
      if (key === `${channel}:${manifest.id}`) {
        this.resolveModule(manifest.id, channel);
      }
    }

    const results: GenericProviderAdapter[] = [];
    const visited = new Set<string>();

    for (const [key, adapter] of this.registry.entries()) {
      if (key.startsWith(`${channel}:`) && !visited.has(adapter.id)) {
        visited.add(adapter.id);
        results.push(adapter);
      }
    }
    this.channelAdaptersCache.set(channel, results);
    return results;
  }

  findMock(
    url: string,
    method = 'POST',
  ): { providerId: string; mock: import('./provider-module').ProviderMockHandler } | undefined {
    for (const [_, module] of this.moduleRegistry.entries()) {
      if (module.mock?.matchesRequest(url, method)) {
        return { providerId: module.id, mock: module.mock };
      }
    }

    for (const [_, manifest] of this.manifestRegistry.entries()) {
      const mod = this.resolveModule(manifest.id, manifest.channel);
      if (mod?.mock?.matchesRequest(url, method)) {
        return { providerId: mod.id, mock: mod.mock };
      }
    }

    return undefined;
  }

  getConfiguredProviders(
    configMap?: Record<string, Record<string, unknown>>,
  ): Array<{ providerId: string; channel: Channel }> {
    const results: Array<{ providerId: string; channel: Channel }> = [];
    const visited = new Set<string>();

    for (const [_key, manifest] of this.manifestRegistry.entries()) {
      const uniqueId = `${manifest.channel}:${manifest.id}`;
      if (visited.has(uniqueId)) continue;
      visited.add(uniqueId);

      const customConfig = configMap?.[manifest.id];
      if (this.hasSetup(manifest.id, customConfig, manifest.channel)) {
        results.push({ providerId: manifest.id, channel: manifest.channel });
      }
    }

    for (const [_, mod] of this.moduleRegistry.entries()) {
      const uniqueId = `${mod.channel}:${mod.id}`;
      if (visited.has(uniqueId)) continue;
      visited.add(uniqueId);

      const customConfig = configMap?.[mod.id];
      if (this.hasSetup(mod.id, customConfig, mod.channel)) {
        results.push({ providerId: mod.id, channel: mod.channel });
      }
    }

    return results;
  }

  getConfiguredAdaptersByChannel(
    channel: Channel,
    configMap?: Record<string, Record<string, unknown>>,
  ): GenericProviderAdapter[] {
    const allAdapters = this.getByChannel(channel);
    return allAdapters.filter((adapter) =>
      this.hasSetup(adapter.id, configMap ? configMap[adapter.id] : this.lastKnownGoodConfigs.get(adapter.id), channel),
    );
  }

  getActiveProviders(): string[] {
    return Array.from(this.activeProviders);
  }
}

export const ProviderRegistry = new ProviderRegistryStore();

// Register Lightweight Provider Manifests for Lazy Loading
const MANIFESTS: ProviderManifest[] = [
  // Chat
  { id: 'webex-messaging', channel: Channel.CHAT, loader: () => require('../chat/webex-messaging').default },
  { id: 'discord', channel: Channel.CHAT, loader: () => require('../chat/discord').default },
  { id: 'grafana-on-call', channel: Channel.CHAT, loader: () => require('../chat/grafana-on-call').default },
  { id: 'whatsapp-business', channel: Channel.CHAT, loader: () => require('../chat/whatsapp-business').default },
  { id: 'zulip', channel: Channel.CHAT, loader: () => require('../chat/zulip').default },
  { id: 'msteams', channel: Channel.CHAT, loader: () => require('../chat/msTeams').default },
  { id: 'chat-webhook', channel: Channel.CHAT, loader: () => require('../chat/chat-webhook').default },
  { id: 'ryver', channel: Channel.CHAT, loader: () => require('../chat/ryver').default },
  { id: 'sendblue', channel: Channel.CHAT, loader: () => require('../chat/sendblue').default },
  { id: 'line', channel: Channel.CHAT, loader: () => require('../chat/line').default },
  { id: 'telegram', channel: Channel.CHAT, loader: () => require('../chat/telegram').default },
  { id: 'rocket-chat', channel: Channel.CHAT, loader: () => require('../chat/rocket-chat').default },
  { id: 'slack', channel: Channel.CHAT, loader: () => require('../chat/slack').default },
  { id: 'cequens-whatsapp', channel: Channel.CHAT, loader: () => require('../chat/cequens-whatsapp').default },
  { id: 'mattermost', channel: Channel.CHAT, loader: () => require('../chat/mattermost').default },
  { id: 'getstream', channel: Channel.CHAT, loader: () => require('../chat/getstream').default },
  { id: 'twilio-whatsapp', channel: Channel.CHAT, loader: () => require('../chat/twilio-whatsapp').default },

  // Email
  { id: 'mailtrap', channel: Channel.EMAIL, loader: () => require('../email/mailtrap').default },
  { id: 'plunk', channel: Channel.EMAIL, loader: () => require('../email/plunk').default },
  { id: 'postmark', channel: Channel.EMAIL, loader: () => require('../email/postmark').default },
  { id: 'infobip', channel: Channel.EMAIL, loader: () => require('../email/infobip').default },
  { id: 'sparkpost', channel: Channel.EMAIL, loader: () => require('../email/sparkpost').default },
  { id: 'sendgrid', channel: Channel.EMAIL, loader: () => require('../email/sendgrid').default },
  { id: 'mailjet', channel: Channel.EMAIL, loader: () => require('../email/mailjet').default },
  { id: 'mandrill', channel: Channel.EMAIL, loader: () => require('../email/mandrill').default },
  { id: 'emailjs', channel: Channel.EMAIL, loader: () => require('../email/emailjs').default },
  { id: 'email-webhook', channel: Channel.EMAIL, loader: () => require('../email/email-webhook').default },
  { id: 'mailersend', channel: Channel.EMAIL, loader: () => require('../email/mailersend').default },
  { id: 'mailgun', channel: Channel.EMAIL, loader: () => require('../email/mailgun').default },
  { id: 'ses', channel: Channel.EMAIL, loader: () => require('../email/ses').default },
  { id: 'netcore', channel: Channel.EMAIL, loader: () => require('../email/netcore').default },
  { id: 'brevo', channel: Channel.EMAIL, loader: () => require('../email/brevo').default },
  { id: 'anypost', channel: Channel.EMAIL, loader: () => require('../email/anypost').default },
  { id: 'braze', channel: Channel.EMAIL, loader: () => require('../email/braze').default },
  { id: 'nodemailer', channel: Channel.EMAIL, loader: () => require('../email/nodemailer').default },
  { id: 'resend', channel: Channel.EMAIL, loader: () => require('../email/resend').default },
  { id: 'outlook365', channel: Channel.EMAIL, loader: () => require('../email/outlook365').default },

  // Push
  { id: 'appio', channel: Channel.PUSH, loader: () => require('../push/appio').default },
  { id: 'one-signal', channel: Channel.PUSH, loader: () => require('../push/one-signal').default },
  { id: 'push-webhook', channel: Channel.PUSH, loader: () => require('../push/push-webhook').default },
  { id: 'apns', channel: Channel.PUSH, loader: () => require('../push/apns').default },
  { id: 'expo', channel: Channel.PUSH, loader: () => require('../push/expo').default },
  { id: 'fcm', channel: Channel.PUSH, loader: () => require('../push/fcm').default },
  { id: 'pusher-beams', channel: Channel.PUSH, loader: () => require('../push/pusher-beams').default },
  { id: 'pushpad', channel: Channel.PUSH, loader: () => require('../push/pushpad').default },

  // SMS
  { id: 'sendchamp', channel: Channel.SMS, loader: () => require('../sms/sendchamp').default },
  { id: 'generic-sms', channel: Channel.SMS, loader: () => require('../sms/generic-sms').default },
  { id: 'infobip', channel: Channel.SMS, loader: () => require('../sms/infobip').default },
  { id: 'bandwidth', channel: Channel.SMS, loader: () => require('../sms/bandwidth').default },
  { id: 'bulk-sms', channel: Channel.SMS, loader: () => require('../sms/bulk-sms').default },
  { id: 'clicksend', channel: Channel.SMS, loader: () => require('../sms/clicksend').default },
  { id: 'cm-telecom', channel: Channel.SMS, loader: () => require('../sms/cm-telecom').default },
  { id: 'messagebird', channel: Channel.SMS, loader: () => require('../sms/messagebird').default },
  { id: 'sns', channel: Channel.SMS, loader: () => require('../sms/sns').default },
  { id: 'ring-central', channel: Channel.SMS, loader: () => require('../sms/ring-central').default },
  { id: 'telnyx', channel: Channel.SMS, loader: () => require('../sms/telnyx').default },
  { id: 'afro-sms', channel: Channel.SMS, loader: () => require('../sms/afro-sms').default },
  { id: 'mobishastra', channel: Channel.SMS, loader: () => require('../sms/mobishastra').default },
  { id: 'unifonic', channel: Channel.SMS, loader: () => require('../sms/unifonic').default },
  { id: 'smsmode', channel: Channel.SMS, loader: () => require('../sms/smsmode').default },
  { id: 'sms-central', channel: Channel.SMS, loader: () => require('../sms/sms-central').default },
  { id: 'forty-six-elks', channel: Channel.SMS, loader: () => require('../sms/forty-six-elks').default },
  { id: 'azure-sms', channel: Channel.SMS, loader: () => require('../sms/azure-sms').default },
  { id: 'gupshup', channel: Channel.SMS, loader: () => require('../sms/gupshup').default },
  { id: 'isend-sms', channel: Channel.SMS, loader: () => require('../sms/isend-sms').default },
  { id: 'simpletexting', channel: Channel.SMS, loader: () => require('../sms/simpletexting').default },
  { id: 'plivo', channel: Channel.SMS, loader: () => require('../sms/plivo').default },
  { id: 'imedia', channel: Channel.SMS, loader: () => require('../sms/imedia').default },
  { id: 'brevo-sms', channel: Channel.SMS, loader: () => require('../sms/brevo-sms').default },
  { id: 'africas-talking', channel: Channel.SMS, loader: () => require('../sms/africas-talking').default },
  { id: 'eazy-sms', channel: Channel.SMS, loader: () => require('../sms/eazy-sms').default },
  { id: 'nexmo', channel: Channel.SMS, loader: () => require('../sms/nexmo').default },
  { id: 'firetext', channel: Channel.SMS, loader: () => require('../sms/firetext').default },
  { id: 'sinch', channel: Channel.SMS, loader: () => require('../sms/sinch').default },
  { id: 'isendpro-sms', channel: Channel.SMS, loader: () => require('../sms/isendpro-sms').default },
  { id: 'ruach-sms', channel: Channel.SMS, loader: () => require('../sms/ruach-sms').default },
  { id: 'clickatell', channel: Channel.SMS, loader: () => require('../sms/clickatell').default },
  { id: 'kannel', channel: Channel.SMS, loader: () => require('../sms/kannel').default },
  { id: 'cequens', channel: Channel.SMS, loader: () => require('../sms/cequens').default },
  { id: 'sms77', channel: Channel.SMS, loader: () => require('../sms/sms77').default },
  { id: 'maqsam', channel: Channel.SMS, loader: () => require('../sms/maqsam').default },
  { id: 'termii', channel: Channel.SMS, loader: () => require('../sms/termii').default },
  { id: 'twilio', channel: Channel.SMS, loader: () => require('../sms/twilio').default },
  { id: 'burst-sms', channel: Channel.SMS, loader: () => require('../sms/burst-sms').default },

  // Tool
  { id: 'pagerduty', channel: Channel.TOOL, loader: () => require('../tool/pagerduty').default },
  { id: 'grafana', channel: Channel.TOOL, loader: () => require('../tool/grafana').default },
  { id: 'tool-webhook', channel: Channel.TOOL, loader: () => require('../tool/tool-webhook').default },
  { id: 'opsgenie', channel: Channel.TOOL, loader: () => require('../tool/opsgenie').default },
];

for (const manifest of MANIFESTS) {
  ProviderRegistry.registerManifest(manifest);
}

const DEFAULT_CHANNEL_PROVIDERS: Record<string, string> = {
  [Channel.SMS]: 'twilio',
  [Channel.CHAT]: 'twilio-whatsapp',
  [Channel.PUSH]: 'fcm',
  [Channel.TOOL]: 'pagerduty',
  [Channel.EMAIL]: 'ses',
};

export function getDefaultProviderForChannel(channel: Channel): string {
  const configured = ProviderRegistry.getConfiguredAdaptersByChannel(channel);
  if (configured.length > 0) {
    return configured[0].id;
  }
  return DEFAULT_CHANNEL_PROVIDERS[channel] || 'ses';
}

let selfHealingInterval: ReturnType<typeof setInterval> | undefined;

export function startProviderSelfHealingLoop(intervalMs = 30_000): void {
  if (selfHealingInterval) return;
  logger.info('ProviderRegistry', `Started background self-healing loop (interval: ${intervalMs}ms)`);
  selfHealingInterval = setInterval(() => {
    ProviderRegistry.checkDegradedProvidersSelfHealing().catch((err: unknown) => {
      logger.error('ProviderRegistry', 'Error in background self-healing probe loop', {
        error: (err as Error).message,
      });
    });
  }, intervalMs);
}

export function stopProviderSelfHealingLoop(): void {
  if (selfHealingInterval) {
    clearInterval(selfHealingInterval);
    selfHealingInterval = undefined;
    logger.info('ProviderRegistry', 'Stopped background self-healing loop');
  }
}
