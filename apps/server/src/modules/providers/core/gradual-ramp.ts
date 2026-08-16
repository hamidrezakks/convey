import { logger } from '../../../utils/logger';

export interface RampStatus {
  providerId: string;
  step: number;
  admitPercentage: number;
}

/**
 * Half-Open Circuit Traffic Ramp Controller.
 *
 * Manages stepped traffic recovery (5% ➔ 20% ➔ 50% ➔ 100%) when circuit breakers transition
 * from OPEN to HALF_OPEN, preventing immediate re-tripping from traffic floods.
 */
export class GradualRampController {
  private ramps = new Map<string, { step: number; admitRatio: number }>();
  private rampSteps = [0.05, 0.2, 0.5, 1.0];

  /**
   * Evaluates whether an incoming request should be admitted to a HALF_OPEN provider.
   * @param providerId Target provider identifier.
   */
  shouldAdmitTraffic(providerId: string): boolean {
    let state = this.ramps.get(providerId);
    if (!state) {
      state = { step: 0, admitRatio: this.rampSteps[0] };
      this.ramps.set(providerId, state);
    }

    const roll = Math.random();
    const admitted = roll <= state.admitRatio;

    if (!admitted) {
      logger.debug(
        'GradualRamp',
        `Throttled probe request for provider '${providerId}' during HALF_OPEN ramp step ${state.step} (${(state.admitRatio * 100).toFixed(0)}%)`,
      );
    }

    return admitted;
  }

  /**
   * Advances the traffic ramp to the next step upon successful probe completions.
   * @param providerId Provider identifier to advance.
   */
  advanceRamp(providerId: string): RampStatus {
    let state = this.ramps.get(providerId);
    if (!state) {
      state = { step: 1, admitRatio: this.rampSteps[1] };
      this.ramps.set(providerId, state);
    } else if (state.step < this.rampSteps.length - 1) {
      state.step += 1;
      state.admitRatio = this.rampSteps[state.step];
    }
    logger.info(
      'GradualRamp',
      `Advanced traffic ramp for provider '${providerId}' to step ${state.step} (${(state.admitRatio * 100).toFixed(0)}%)`,
    );

    return {
      providerId,
      step: state.step,
      admitPercentage: Math.round(state.admitRatio * 100),
    };
  }

  /**
   * Resets the traffic ramp state for a provider back to baseline.
   * @param providerId Target provider identifier.
   */
  resetRamp(providerId: string): void {
    this.ramps.delete(providerId);
  }
}

/** Singleton instance of GradualRampController */
export const gradualRampController = new GradualRampController();
