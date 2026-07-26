export function getUtcHourBoundary(date: Date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), 0, 0));
}

export function getUtcMonthBoundary(date: Date = new Date()): { startDate: Date; endDate: Date } {
  const startDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const endDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
  return { startDate, endDate };
}

export function getUtcMonthString(date: Date = new Date()): string {
  return date.toISOString().substring(0, 7);
}
