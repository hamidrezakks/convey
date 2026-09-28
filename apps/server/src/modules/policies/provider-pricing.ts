import { isSupportedCurrency } from '@convey/shared';

export function validateProviderPrice(value: unknown): { cost: number; currency: string } {
  const price = value as { cost?: unknown; currency?: unknown } | undefined;
  if (
    !price ||
    typeof price.cost !== 'number' ||
    !Number.isFinite(price.cost) ||
    price.cost < 0 ||
    price.cost >= 100_000_000 ||
    typeof price.currency !== 'string' ||
    !isSupportedCurrency(price.currency.toUpperCase())
  ) {
    throw new Error('Provider price requires a finite nonnegative cost and supported currency');
  }
  return { cost: price.cost, currency: price.currency.toUpperCase() };
}
