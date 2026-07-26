import type { BravoQuotaWindow } from '@/services/api';

export interface BravoQuotaResetCopy {
  scheduled: (time: string) => string;
  inactive: string;
  notApplicable: string;
  unknown: string;
}

export const formatSafeQuotaResetDate = (value: string | null, locale: string): string => {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() <= 1) return '';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

export const formatBravoQuotaReset = (
  window: BravoQuotaWindow,
  locale: string,
  copy: BravoQuotaResetCopy
): string => {
  if (window.resetMode === 'inactive') return copy.inactive;
  if (window.resetMode === 'not_applicable') return copy.notApplicable;
  const resetAt = formatSafeQuotaResetDate(window.resetAt, locale);
  return resetAt ? copy.scheduled(resetAt) : copy.unknown;
};
