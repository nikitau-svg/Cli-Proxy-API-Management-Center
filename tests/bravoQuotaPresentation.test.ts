import { describe, expect, test } from 'bun:test';
import en from '../src/i18n/locales/en.json';
import ru from '../src/i18n/locales/ru.json';
import {
  effectiveBravoSubscriptionHealth,
  formatBravoQuotaReset,
  summarizeBravoQuotaRouting,
  type BravoQuotaResetCopy,
} from '../src/features/bravo/bravoQuotaPresentation';
import type { BravoQuotaWindow } from '../src/services/api/bravo';

const windowWith = (
  resetMode: BravoQuotaWindow['resetMode'],
  resetAt: string | null = null
): BravoQuotaWindow => ({
  usedPercent: null,
  remainingPercent: null,
  resetAt,
  resetMode,
  eligible: null,
  reason: '',
  independent: false,
});

const copyFrom = (quota: typeof en.bravo.quota): BravoQuotaResetCopy => ({
  scheduled: (time) => quota.reset.replace('{{time}}', time),
  inactive: quota.reset_inactive,
  notApplicable: quota.reset_not_applicable,
  unknown: quota.reset_unknown,
});

describe('Bravo quota reset presentation', () => {
  test('explains an inactive session in English and Russian', () => {
    const window = windowWith('inactive');

    expect(formatBravoQuotaReset(window, 'en', copyFrom(en.bravo.quota))).toBe(
      'Session not started · reset timer starts on first use'
    );
    expect(formatBravoQuotaReset(window, 'ru', copyFrom(ru.bravo.quota))).toBe(
      'Сессия не началась · таймер сброса запустится при первом использовании'
    );
  });

  test('explains a provider window that does not apply in English and Russian', () => {
    const window = windowWith('not_applicable');

    expect(formatBravoQuotaReset(window, 'en', copyFrom(en.bravo.quota))).toBe(
      'This provider has no such quota window'
    );
    expect(formatBravoQuotaReset(window, 'ru', copyFrom(ru.bravo.quota))).toBe(
      'У провайдера нет такого окна лимита'
    );
  });

  test('never formats year 0001 and keeps a missing scheduled reset unknown', () => {
    const copy = copyFrom(en.bravo.quota);
    const sentinel = formatBravoQuotaReset(
      windowWith('scheduled', '0001-01-01T00:00:00Z'),
      'en',
      copy
    );
    const missing = formatBravoQuotaReset(windowWith('scheduled'), 'en', copy);

    expect(sentinel).toBe(en.bravo.quota.reset_unknown);
    expect(sentinel).not.toContain('0001');
    expect(missing).toBe(en.bravo.quota.reset_unknown);
  });
});



describe('Bravo quota routing summary', () => {
  const routingWindow = (remainingPercent: number | null, eligible: boolean | null): BravoQuotaWindow => ({
    usedPercent: remainingPercent === null ? null : 100 - remainingPercent,
    remainingPercent,
    resetAt: '2026-07-30T08:00:00Z',
    resetMode: 'scheduled',
    eligible,
    reason: eligible === false ? 'reserve_floor' : 'ready',
    independent: false,
  });

  test('keeps the account routable when standard Codex is protected but Spark is ready', () => {
    expect(
      summarizeBravoQuotaRouting(
        'confirmed',
        routingWindow(100, true),
        routingWindow(0, false),
        [{ session: routingWindow(100, true), weekly: routingWindow(72, true) }]
      )
    ).toBe('ready');
  });

  test('reports unknown when no domain is ready and an independent bucket is incomplete', () => {
    expect(
      summarizeBravoQuotaRouting(
        'confirmed',
        routingWindow(100, true),
        routingWindow(0, false),
        [{ session: routingWindow(null, null) }]
      )
    ).toBe('unknown');
  });

  test('reports protected only when every available domain is confirmed and protected', () => {
    expect(
      summarizeBravoQuotaRouting(
        'confirmed',
        routingWindow(100, true),
        routingWindow(0, false),
        [{ session: routingWindow(0, false), weekly: routingWindow(0, false) }]
      )
    ).toBe('protected');
  });

  test('marks an account partially available when standard cooldown coexists with live Spark', () => {
    expect(
      effectiveBravoSubscriptionHealth('cooldown', 'confirmed', [
        { session: routingWindow(100, true), weekly: routingWindow(72, true) },
      ])
    ).toBe('partial');
    expect(
      effectiveBravoSubscriptionHealth('unavailable', 'confirmed', [
        { session: routingWindow(100, true), weekly: routingWindow(72, true) },
      ])
    ).toBe('unavailable');
  });
});
