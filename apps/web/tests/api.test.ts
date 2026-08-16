import './setup';
import { describe, expect, it } from 'bun:test';
import { api, httpClient } from '../src/lib/api';

describe('Ky HTTP Client & API Module Test Suite', () => {
  it('instantiates configured Ky client instance', () => {
    expect(httpClient).toBeDefined();
    expect(typeof httpClient.get).toBe('function');
    expect(typeof httpClient.post).toBe('function');
    expect(typeof httpClient.delete).toBe('function');
  });

  it('exposes all typed admin methods on api object', () => {
    expect(typeof api.getOverview).toBe('function');
    expect(typeof api.getLiveTelemetry).toBe('function');
    expect(typeof api.getMessages).toBe('function');
    expect(typeof api.getMessageDetails).toBe('function');
    expect(typeof api.getProviders).toBe('function');
    expect(typeof api.setProviderCircuit).toBe('function');
    expect(typeof api.triggerCanary).toBe('function');
    expect(typeof api.replayDlq).toBe('function');
    expect(typeof api.getSuppressions).toBe('function');
    expect(typeof api.addSuppression).toBe('function');
    expect(typeof api.removeSuppression).toBe('function');
    expect(typeof api.getPolicies).toBe('function');
    expect(typeof api.sendTestMessage).toBe('function');
  });
});
