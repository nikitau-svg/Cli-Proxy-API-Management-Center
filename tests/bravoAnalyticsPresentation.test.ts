import { describe, expect, test } from 'bun:test';
import {
  analyticsDeltaPercent,
  analyticsSeriesToCSV,
  resolveBravoAnalyticsRange,
  resolveBravoCustomRange,
  type BravoAnalyticsRange,
} from '../src/features/bravo/bravoAnalyticsPresentation';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const bucketStarts = (range: BravoAnalyticsRange): number[] => {
  const size = range.interval === 'hour' ? HOUR_MS : DAY_MS;
  const starts: number[] = [];
  const from = new Date(range.from).getTime();
  const to = new Date(range.to).getTime();
  for (let cursor = Math.floor(from / size) * size; cursor < to; cursor += size) {
    starts.push(cursor);
  }
  return starts;
};

const previousBucketStarts = (range: BravoAnalyticsRange): number[] =>
  bucketStarts({
    ...range,
    from: range.previousFrom,
    to: range.previousTo,
  });

const expectDisjointBuckets = (range: BravoAnalyticsRange, expectedCount: number) => {
  const current = bucketStarts(range);
  const previous = previousBucketStarts(range);
  expect(current).toHaveLength(expectedCount);
  expect(previous).toHaveLength(expectedCount);
  expect(current.filter((bucket) => previous.includes(bucket))).toEqual([]);
  expect(range.previousTo).toBe(range.from);
};

describe('Bravo analytics presentation', () => {
  test.each([
    ['24h', 'hour', 24],
    ['7d', 'day', 7],
    ['30d', 'day', 30],
    ['90d', 'day', 90],
  ] as const)(
    'keeps the current partial bucket and separates %s from its previous comparison',
    (preset, interval, expectedCount) => {
      const now = new Date('2026-07-24T12:34:56.000Z');
      const range = resolveBravoAnalyticsRange(preset, now);
      expect(range.interval).toBe(interval);
      expect(range.to).toBe(now.toISOString());
      expectDisjointBuckets(range, expectedCount);
    }
  );

  test('does not add an empty partial bucket when now is exactly on a boundary', () => {
    const range = resolveBravoAnalyticsRange('24h', new Date('2026-07-24T12:00:00.000Z'));
    expect(range.from).toBe('2026-07-23T12:00:00.000Z');
    expectDisjointBuckets(range, 24);
  });

  test('rejects reversed custom dates and uses an inclusive half-open single-day range', () => {
    expect(resolveBravoCustomRange('2026-07-25', '2026-07-24')).toBeNull();
    const range = resolveBravoCustomRange(
      '2026-07-24',
      '2026-07-24',
      new Date('2026-07-25T12:00:00Z')
    );
    expect(range?.interval).toBe('hour');
    expect(range?.from).toBe('2026-07-24T00:00:00.000Z');
    expect(range?.to).toBe('2026-07-25T00:00:00.000Z');
    if (range) expectDisjointBuckets(range, 24);
  });

  test('clamps a custom end date to now and compares the same number of hourly buckets', () => {
    const now = new Date('2026-07-24T09:15:00.000Z');
    const range = resolveBravoCustomRange('2026-07-24', '2026-07-24', now);
    expect(range?.to).toBe(now.toISOString());
    if (range) expectDisjointBuckets(range, 10);
  });

  test('compares a current partial multi-day custom range with disjoint daily buckets', () => {
    const now = new Date('2026-07-24T09:15:00.000Z');
    const range = resolveBravoCustomRange('2026-07-20', '2026-07-24', now);
    expect(range?.interval).toBe('day');
    expect(range?.to).toBe(now.toISOString());
    if (range) expectDisjointBuckets(range, 5);
  });

  test('does not invent an infinite percentage when the previous period is zero', () => {
    expect(analyticsDeltaPercent(10, 0)).toBeNull();
    expect(analyticsDeltaPercent(0, 0)).toBe(0);
    expect(analyticsDeltaPercent(120, 100)).toBe(20);
  });

  test('exports machine-readable CSV and escapes fields', () => {
    const csv = analyticsSeriesToCSV([
      {
        start: '2026-07-24T00:00:00Z',
        end: '2026-07-25T00:00:00Z',
        usage: {
          requests: 2,
          failures: 1,
          inputTokens: 10,
          outputTokens: 5,
          reasoningTokens: 3,
          cachedTokens: 0,
          cacheReadTokens: 4,
          cacheCreationTokens: 2,
          totalTokens: 18,
          latencyMs: 100,
          averageLatencyMs: 50,
          failureRatePercent: 50,
        },
      },
    ]);
    expect(csv).toContain('start,end,provider_attempts,failures');
    expect(csv).toContain('2026-07-24T00:00:00Z');
    expect(csv).toContain(',18,50');
  });
});
