import type {
  BravoAnalyticsInterval,
  BravoAnalyticsPoint,
  BravoAnalyticsUsage,
} from '@/services/api';

export type BravoAnalyticsPreset = '24h' | '7d' | '30d' | '90d' | 'custom';

export interface BravoAnalyticsRange {
  from: string;
  to: string;
  interval: BravoAnalyticsInterval;
  previousFrom: string;
  previousTo: string;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const resolveBravoAnalyticsRange = (
  preset: Exclude<BravoAnalyticsPreset, 'custom'>,
  now = new Date()
): BravoAnalyticsRange => {
  const durations: Record<Exclude<BravoAnalyticsPreset, 'custom'>, number> = {
    '24h': DAY_MS,
    '7d': 7 * DAY_MS,
    '30d': 30 * DAY_MS,
    '90d': 90 * DAY_MS,
  };
  const duration = durations[preset];
  const toMs = now.getTime();
  const fromMs = toMs - duration;
  return {
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs).toISOString(),
    interval: preset === '24h' ? 'hour' : 'day',
    previousFrom: new Date(fromMs - duration).toISOString(),
    previousTo: new Date(fromMs).toISOString(),
  };
};

export const resolveBravoCustomRange = (
  fromDate: string,
  toDate: string,
  now = new Date()
): BravoAnalyticsRange | null => {
  const fromMs = new Date(`${fromDate}T00:00:00.000Z`).getTime();
  const requestedToMs = new Date(`${toDate}T23:59:59.999Z`).getTime();
  const toMs = Math.min(requestedToMs, now.getTime());
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs > toMs) return null;
  const duration = toMs - fromMs + 1;
  return {
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs).toISOString(),
    interval: duration <= 2 * DAY_MS ? 'hour' : 'day',
    previousFrom: new Date(fromMs - duration).toISOString(),
    previousTo: new Date(fromMs - 1).toISOString(),
  };
};

export const analyticsDeltaPercent = (current: number, previous: number): number | null => {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
};

const csvCell = (value: string | number): string => {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const analyticsSeriesToCSV = (series: BravoAnalyticsPoint[]): string => {
  const header = [
    'start',
    'end',
    'requests',
    'failures',
    'input_tokens',
    'output_tokens',
    'reasoning_tokens',
    'cache_read_tokens',
    'cache_creation_tokens',
    'total_tokens',
    'average_latency_ms',
  ];
  const rows = series.map(({ start, end, usage }) => [
    start,
    end,
    usage.requests,
    usage.failures,
    usage.inputTokens,
    usage.outputTokens,
    usage.reasoningTokens,
    usage.cacheReadTokens,
    usage.cacheCreationTokens,
    usage.totalTokens,
    usage.averageLatencyMs,
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
};

export const analyticsUsageIsEmpty = (usage: BravoAnalyticsUsage): boolean =>
  usage.requests === 0 && usage.totalTokens === 0 && usage.failures === 0 && usage.latencyMs === 0;
