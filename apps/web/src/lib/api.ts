import type {
  Channel,
  DlqReplayRequest,
  DlqReplayResult,
  LiveTelemetrySnapshot,
  MessageDetailDto,
  MessageStatus,
  MessageSummaryDto,
  PolicyDto,
  ProviderHealthDto,
  SuppressionDto,
  SuppressionReason,
} from '@convey/shared';

const API_BASE = '/v1/admin';

export const api = {
  async getOverview() {
    const res = await fetch(`${API_BASE}/overview`);
    if (!res.ok) throw new Error(`Overview fetch failed: ${res.statusText}`);
    return res.json();
  },

  async getLiveTelemetry(): Promise<LiveTelemetrySnapshot> {
    const res = await fetch(`${API_BASE}/telemetry/live`);
    if (!res.ok) throw new Error(`Telemetry fetch failed: ${res.statusText}`);
    return res.json();
  },

  async getMessages(params?: {
    page?: number;
    limit?: number;
    teamId?: string;
    channel?: Channel;
    status?: MessageStatus;
    search?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ messages: MessageSummaryDto[]; total: number; page: number; limit: number }> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.teamId) query.set('teamId', params.teamId);
    if (params?.channel) query.set('channel', params.channel);
    if (params?.status) query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);

    const res = await fetch(`${API_BASE}/messages?${query.toString()}`);
    if (!res.ok) throw new Error(`Messages fetch failed: ${res.statusText}`);
    return res.json();
  },

  async getMessageDetails(id: string): Promise<MessageDetailDto> {
    const res = await fetch(`${API_BASE}/messages/${id}`);
    if (!res.ok) throw new Error(`Message ${id} not found`);
    return res.json();
  },

  async getProviders(): Promise<ProviderHealthDto[]> {
    const res = await fetch(`${API_BASE}/providers`);
    if (!res.ok) throw new Error(`Providers fetch failed: ${res.statusText}`);
    return res.json();
  },

  async setProviderCircuit(
    providerId: string,
    action: 'CLOSE' | 'FORCE_OPEN' | 'FORCE_HALF_OPEN',
    rampPercentage = 20,
  ) {
    const res = await fetch(`${API_BASE}/providers/${providerId}/circuit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, rampPercentage }),
    });
    if (!res.ok) throw new Error(`Circuit override failed: ${res.statusText}`);
    return res.json();
  },

  async triggerCanary(providerId: string) {
    const res = await fetch(`${API_BASE}/providers/${providerId}/canary`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Canary trigger failed: ${res.statusText}`);
    return res.json();
  },

  async replayDlq(request: DlqReplayRequest): Promise<DlqReplayResult> {
    const res = await fetch(`${API_BASE}/dlq/replay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    if (!res.ok) throw new Error(`DLQ replay failed: ${res.statusText}`);
    return res.json();
  },

  async getSuppressions(search?: string): Promise<SuppressionDto[]> {
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await fetch(`${API_BASE}/suppressions${query}`);
    if (!res.ok) throw new Error(`Suppressions fetch failed: ${res.statusText}`);
    return res.json();
  },

  async addSuppression(data: { teamId?: string; recipient: string; channel: Channel; reason: SuppressionReason }) {
    const res = await fetch(`${API_BASE}/suppressions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Add suppression failed: ${res.statusText}`);
    return res.json();
  },

  async removeSuppression(id: string) {
    const res = await fetch(`${API_BASE}/suppressions/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Remove suppression failed: ${res.statusText}`);
    return res.json();
  },

  async getPolicies(): Promise<PolicyDto[]> {
    const res = await fetch(`${API_BASE}/policies`);
    if (!res.ok) throw new Error(`Policies fetch failed: ${res.statusText}`);
    return res.json();
  },

  async sendTestMessage(data: {
    channel: Channel;
    recipient: string;
    payload: Record<string, unknown>;
    teamId?: string;
  }) {
    const res = await fetch(`${API_BASE}/composer/send-test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Send test message failed: ${res.statusText}`);
    return res.json();
  },
};
