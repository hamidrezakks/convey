import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number | null | undefined): string {
  if (num === undefined || num === null || Number.isNaN(num)) {
    return 'Unavailable';
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}k`;
  }
  return num.toLocaleString();
}

export function formatDurationMs(ms: number | null | undefined): string {
  if (ms === undefined || ms === null || Number.isNaN(ms)) {
    return 'Unavailable';
  }
  if (ms < 0.001) {
    return '0ms';
  }
  if (ms < 1) {
    return `${(ms * 1000).toFixed(0)}µs`;
  }
  if (ms < 1000) {
    return `${ms.toFixed(1)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

export function formatTimeAgo(isoString: string): string {
  if (!isoString) return '-';
  const parsedTime = new Date(isoString).getTime();
  if (Number.isNaN(parsedTime)) return '-';

  const seconds = Math.floor((Date.now() - parsedTime) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
