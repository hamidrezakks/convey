import { logger } from './logger';

/**
 * Diagnostic report emitted when inspecting provider latency metrics.
 */
export interface AnomalyReport {
  /** Target provider identifier */
  providerId: string;
  /** Mean execution latency in milliseconds */
  meanMs: number;
  /** Standard deviation of execution latency in milliseconds */
  stdDevMs: number;
  /** Calculated Z-Score ((currentLatency - mean) / stdDev) */
  zScore: number;
  /** True if Z-Score exceeds the 3.0 standard threshold */
  isAnomalous: boolean;
}

/**
 * Statistical Z-Score Anomaly Detector.
 *
 * Tracks rolling provider execution latencies, calculates mean (μ) and standard deviation (σ),
 * and identifies statistical anomalies (Z-Score > 3.0) before hard timeouts or circuit breaker trips occur.
 */
export class StatisticalAnomalyDetector {
  private latencies = new Map<string, number[]>();
  private maxSamples = 50;
  private zThreshold = 3.0;

  /**
   * Records a latency sample for a specific provider.
   * @param providerId Unique provider identifier.
   * @param latencyMs Measured request/send latency in milliseconds.
   */
  recordLatency(providerId: string, latencyMs: number): void {
    let samples = this.latencies.get(providerId);
    if (!samples) {
      samples = [];
      this.latencies.set(providerId, samples);
    }

    if (samples.length < this.maxSamples) {
      samples.push(latencyMs);
    } else {
      // Overwrite oldest sample without re-allocating array
      samples.copyWithin(0, 1);
      samples[this.maxSamples - 1] = latencyMs;
    }
  }

  /**
   * Evaluates the current latency against historic samples and computes Z-Score.
   * @param providerId Provider identifier to evaluate.
   * @param currentLatencyMs Latest latency measurement in milliseconds.
   */
  analyze(providerId: string, currentLatencyMs: number): AnomalyReport {
    const samples = this.latencies.get(providerId);
    if (!samples || samples.length < 5) {
      return { providerId, meanMs: currentLatencyMs, stdDevMs: 0, zScore: 0, isAnomalous: false };
    }

    const len = samples.length;
    let sum = 0;
    for (let i = 0; i < len; i++) {
      sum += samples[i];
    }
    const mean = sum / len;

    let varianceSum = 0;
    for (let i = 0; i < len; i++) {
      const diff = samples[i] - mean;
      varianceSum += diff * diff;
    }
    const variance = varianceSum / len;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) {
      return { providerId, meanMs: Math.round(mean), stdDevMs: 0, zScore: 0, isAnomalous: false };
    }

    const zScore = (currentLatencyMs - mean) / stdDev;
    const isAnomalous = zScore > this.zThreshold;

    if (isAnomalous) {
      logger.warn(
        'AnomalyDetector',
        `Statistical latency anomaly detected for provider '${providerId}': Latency ${currentLatencyMs}ms (Mean: ${Math.round(mean)}ms, StdDev: ${Math.round(stdDev)}ms, Z-Score: ${zScore.toFixed(2)})`,
      );
    }

    return {
      providerId,
      meanMs: Math.round(mean),
      stdDevMs: Math.round(stdDev),
      zScore: Number.parseFloat(zScore.toFixed(2)),
      isAnomalous,
    };
  }
}

/** Singleton instance of StatisticalAnomalyDetector */
export const statisticalAnomalyDetector = new StatisticalAnomalyDetector();
