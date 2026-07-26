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

const ceilToBucketBoundary = (value: number, bucketSize: number): number =>
  Math.ceil(value / bucketSize) * bucketSize;

export const resolveBravoAnalyticsRange = (
  preset: Exclude<BravoAnalyticsPreset, 'custom'>,
  now = new Date()
): BravoAnalyticsRange => {
  const bucketCounts: Record<Exclude<BravoAnalyticsPreset, 'custom'>, number> = {
    '24h': 24,
    '7d': 7,
    '30d': 30,
    '90d': 90,
  };
  const interval = preset === '24h' ? 'hour' : 'day';
  const bucketSize = interval === 'hour' ? HOUR_MS : DAY_MS;
  const bucketCount = bucketCounts[preset];
  const toMs = now.getTime();
  const fromMs = ceilToBucketBoundary(toMs, bucketSize) - bucketCount * bucketSize;
  const comparisonDuration = bucketCount * bucketSize;
  return {
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs).toISOString(),
    interval,
    previousFrom: new Date(fromMs - comparisonDuration).toISOString(),
    previousTo: new Date(fromMs).toISOString(),
  };
};

export const resolveBravoCustomRange = (
  fromDate: string,
  toDate: string,
  now = new Date()
): BravoAnalyticsRange | null => {
  const fromMs = new Date(`${fromDate}T00:00:00.000Z`).getTime();
  const requestedToMs = new Date(`${toDate}T00:00:00.000Z`).getTime() + DAY_MS;
  const toMs = Math.min(requestedToMs, now.getTime());
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs >= toMs) return null;
  const requestedDuration = requestedToMs - fromMs;
  const interval = requestedDuration <= 2 * DAY_MS ? 'hour' : 'day';
  const bucketSize = interval === 'hour' ? HOUR_MS : DAY_MS;
  const bucketCount = Math.ceil((toMs - fromMs) / bucketSize);
  const comparisonDuration = bucketCount * bucketSize;
  return {
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs).toISOString(),
    interval,
    previousFrom: new Date(fromMs - comparisonDuration).toISOString(),
    previousTo: new Date(fromMs).toISOString(),
  };
};

export const analyticsDeltaPercent = (current: number, previous: number): number | null => {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
};

export const formatBravoResponseTime = (milliseconds: number, locale: string): string => {
  if (!Number.isFinite(milliseconds) || milliseconds <= 0) return '—';
  const normalizedLocale = locale.toLowerCase();
  const millisecondUnit = normalizedLocale.startsWith('ru') ? 'мс' : 'ms';
  const secondUnit = normalizedLocale.startsWith('ru')
    ? 'с'
    : normalizedLocale.startsWith('zh')
      ? '秒'
      : 's';
  if (milliseconds < 1000) {
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
      milliseconds
    )} ${millisecondUnit}`;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
    milliseconds / 1000
  )} ${secondUnit}`;
};

const csvCell = (value: string | number): string => {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const analyticsSeriesToCSV = (series: BravoAnalyticsPoint[]): string => {
  const header = [
    'start',
    'end',
    'provider_attempts',
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
