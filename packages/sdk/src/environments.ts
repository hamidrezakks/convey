/**
 * @convey/sdk - Environment Presets & URL Resolution
 * Strongly-typed environment definitions and URL normalization utilities.
 */

import { ConveyConfigurationError } from './errors';

export enum ConveyEnvironment {
  PRODUCTION = 'https://api.convey.dev',
  US = 'https://us.api.convey.dev',
  EU = 'https://eu.api.convey.dev',
  STAGING = 'https://staging.api.convey.dev',
  LOCAL = 'http://localhost:3000',
  SANDBOX = 'https://sandbox.api.convey.dev',
}

export type ConveyEnvironmentName =
  | 'production'
  | 'staging'
  | 'eu'
  | 'us'
  | 'local'
  | 'sandbox'
  | 'PRODUCTION'
  | 'STAGING'
  | 'EU'
  | 'US'
  | 'LOCAL'
  | 'SANDBOX';

/**
 * Map environment names or enum values to canonical endpoint URLs.
 */
export function resolveEnvironmentUrl(env: ConveyEnvironment | ConveyEnvironmentName | string): string {
  const normalized = env.toUpperCase().trim();
  switch (normalized) {
    case 'PRODUCTION':
    case 'PROD':
      return ConveyEnvironment.PRODUCTION;
    case 'US':
    case 'US_EAST':
    case 'US_WEST':
      return ConveyEnvironment.US;
    case 'EU':
    case 'EU_CENTRAL':
    case 'EU_WEST':
      return ConveyEnvironment.EU;
    case 'STAGING':
    case 'STAGE':
      return ConveyEnvironment.STAGING;
    case 'LOCAL':
    case 'DEV':
    case 'DEVELOPMENT':
      return ConveyEnvironment.LOCAL;
    case 'SANDBOX':
    case 'TEST':
      return ConveyEnvironment.SANDBOX;
    default:
      // If it's already a full URL, return it
      if (env.startsWith('http://') || env.startsWith('https://')) {
        return env;
      }
      throw new ConveyConfigurationError(
        `Unknown Convey environment preset '${env}'. Valid presets: production, us, eu, staging, local, sandbox.`,
      );
  }
}

/**
 * Normalize and validate a base URL string.
 */
export function normalizeBaseUrl(url: string): string {
  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    throw new ConveyConfigurationError('Base URL cannot be empty.');
  }

  const trimmed = url.trim().replace(/\/+$/, '');
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    throw new ConveyConfigurationError(`Invalid base URL '${url}'. Base URL must start with http:// or https://.`);
  }

  return trimmed;
}

/**
 * Resolve the effective base URL from options and environment variables.
 * Enforces MANDATORY Base URL: Throws ConveyConfigurationError if no base URL can be determined.
 */
export function resolveBaseUrl(options?: {
  baseUrl?: string;
  environment?: ConveyEnvironment | ConveyEnvironmentName | string;
}): string {
  // 1. Explicit baseUrl parameter
  if (options?.baseUrl && typeof options.baseUrl === 'string' && options.baseUrl.trim().length > 0) {
    return normalizeBaseUrl(options.baseUrl);
  }

  // 2. Environment preset parameter
  if (options?.environment) {
    return normalizeBaseUrl(resolveEnvironmentUrl(options.environment));
  }

  // 3. Process environment variable fallback
  const envVar = typeof process !== 'undefined' ? process.env?.CONVEY_BASE_URL : undefined;
  if (envVar && envVar.trim().length > 0) {
    return normalizeBaseUrl(envVar);
  }

  // 4. Strict Fail-Fast: Base URL is mandatory
  throw new ConveyConfigurationError(
    'ConveyClient requires a valid base URL. Please specify "baseUrl", select an "environment" preset, or set the "CONVEY_BASE_URL" environment variable.',
  );
}
