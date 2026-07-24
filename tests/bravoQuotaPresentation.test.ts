import { describe, expect, test } from 'bun:test';
import en from '../src/i18n/locales/en.json';
import ru from '../src/i18n/locales/ru.json';
import {
  formatBravoQuotaReset,
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
