import { describe, expect, it } from 'bun:test';
import { StatisticalAnomalyDetector } from '../src/utils/anomaly-detector';

describe('Statistical Z-Score Anomaly Detector', () => {
  it('detects latency spikes with Z-Score > 3.0', () => {
    const detector = new StatisticalAnomalyDetector();
    const providerId = 'test_provider_stat';

    // Populate steady latencies (~50ms with minor variance)
    for (let i = 0; i < 20; i++) {
      detector.recordLatency(providerId, 50 + (i % 3));
    }

    // Normal latency should not be anomalous
    const normalReport = detector.analyze(providerId, 52);
    expect(normalReport.isAnomalous).toBe(false);
    expect(normalReport.zScore).toBeLessThan(3.0);

    // Severe spike (e.g. 500ms when mean is ~51ms) should trigger Z-Score > 3.0
    const spikeReport = detector.analyze(providerId, 500);
    expect(spikeReport.isAnomalous).toBe(true);
    expect(spikeReport.zScore).toBeGreaterThan(3.0);
  });
});
