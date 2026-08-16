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
  }) => [...messageKeys.all, 'list', filters] as const,
  detail: (id: string) => [...messageKeys.all, 'detail', id] as const,
};

export const providerKeys = {
  all: ['providers'] as const,
  list: () => [...providerKeys.all, 'list'] as const,
};

export const suppressionKeys = {
  all: ['suppressions'] as const,
  list: (search?: string) => [...suppressionKeys.all, 'list', { search }] as const,
};

export const policyKeys = {
  all: ['policies'] as const,
  list: () => [...policyKeys.all, 'list'] as const,
};
