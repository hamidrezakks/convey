import type { Channel, MessageStatus } from '@convey/shared';

export const telemetryKeys = {
  all: ['telemetry'] as const,
  overview: () => [...telemetryKeys.all, 'overview'] as const,
  live: () => [...telemetryKeys.all, 'live'] as const,
};

export const messageKeys = {
  all: ['messages'] as const,
  list: (filters: {
    page?: number;
    limit?: number;
    search?: string;
    channel?: Channel;
    status?: MessageStatus;
    teamId?: string;
    isSandbox?: boolean;
  }) => [...messageKeys.all, 'list', filters] as const,
  detail: (id: string) => [...messageKeys.all, 'detail', id] as const,
};

export const providerKeys = {
  all: ['providers'] as const,
  health: () => [...providerKeys.all, 'health'] as const,
  catalog: () => [...providerKeys.all, 'catalog'] as const,
  configured: () => [...providerKeys.all, 'configured'] as const,
  envExport: () => [...providerKeys.all, 'envExport'] as const,
};

export const suppressionKeys = {
  all: ['suppressions'] as const,
  list: (search?: string) => [...suppressionKeys.all, 'list', { search }] as const,
};

export const deliverabilityKeys = {
  all: ['deliverability'] as const,
  suppressions: (filters?: { search?: string }) => [...deliverabilityKeys.all, 'suppressions', filters] as const,
};

export const policyKeys = {
  all: ['policies'] as const,
  list: () => [...policyKeys.all, 'list'] as const,
};

export const reportKeys = {
  all: ['reports'] as const,
  overview: (filters?: Record<string, unknown>) => [...reportKeys.all, 'overview', filters] as const,
  teams: (filters?: Record<string, unknown>) => [...reportKeys.all, 'teams', filters] as const,
  categories: (filters?: Record<string, unknown>) => [...reportKeys.all, 'categories', filters] as const,
  campaigns: (filters?: Record<string, unknown>) => [...reportKeys.all, 'campaigns', filters] as const,
  campaignDetail: (id: string, filters?: Record<string, unknown>) =>
    [...reportKeys.all, 'campaignDetail', id, filters] as const,
};
