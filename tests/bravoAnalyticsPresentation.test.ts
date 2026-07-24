import { describe, expect, test } from 'bun:test';
import {
  analyticsDeltaPercent,
  analyticsSeriesToCSV,
  resolveBravoAnalyticsRange,
  resolveBravoCustomRange,
} from '../src/features/bravo/bravoAnalyticsPresentation';

describe('Bravo analytics presentation', () => {
  test('builds equal current and previous preset periods', () => {
    const range = resolveBravoAnalyticsRange('7d', new Date('2026-07-24T12:00:00Z'));
    expect(range.interval).toBe('day');
    expect(range.from).toBe('2026-07-17T12:00:00.000Z');
    expect(range.previousFrom).toBe('2026-07-10T12:00:00.000Z');
    expect(new Date(range.to).getTime() - new Date(range.from).getTime()).toBe(
      new Date(range.previousTo).getTime() - new Date(range.previousFrom).getTime()
    );
  });

  test('rejects reversed custom dates and uses hourly buckets for a single day', () => {
    expect(resolveBravoCustomRange('2026-07-25', '2026-07-24')).toBeNull();
    const range = resolveBravoCustomRange(
      '2026-07-24',
      '2026-07-24',
      new Date('2026-07-25T12:00:00Z')
    );
    expect(range?.interval).toBe('hour');
    expect(range?.from).toBe('2026-07-24T00:00:00.000Z');
    expect(range?.to).toBe('2026-07-24T23:59:59.999Z');
  });

  test('clamps a custom end date to now and keeps an equal previous duration', () => {
    const now = new Date('2026-07-24T09:15:00.000Z');
    const range = resolveBravoCustomRange('2026-07-24', '2026-07-24', now);
    expect(range?.to).toBe(now.toISOString());
    expect(new Date(range?.to ?? 0).getTime() - new Date(range?.from ?? 0).getTime()).toBe(
      new Date(range?.previousTo ?? 0).getTime() - new Date(range?.previousFrom ?? 0).getTime()
    );
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
    expect(csv).toContain('start,end,requests,failures');
    expect(csv).toContain('2026-07-24T00:00:00Z');
    expect(csv).toContain(',18,50');
  });
});
