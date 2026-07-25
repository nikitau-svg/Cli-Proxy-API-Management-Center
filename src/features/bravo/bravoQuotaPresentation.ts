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

export type BravoQuotaRoutingState = 'ready' | 'protected' | 'unknown';

export interface BravoIndependentQuotaDomain {
  session?: BravoQuotaWindow;
  weekly?: BravoQuotaWindow;
}

const quotaDomainRoutingState = (
  confidence: string,
  session?: BravoQuotaWindow,
  weekly?: BravoQuotaWindow
): BravoQuotaRoutingState => {
  if (
    confidence !== 'confirmed' ||
    !session ||
    !weekly ||
    session.remainingPercent === null ||
    weekly.remainingPercent === null ||
    session.eligible === null ||
    weekly.eligible === null
  ) {
    return 'unknown';
  }
  return session.eligible === true && weekly.eligible === true ? 'ready' : 'protected';
};

// One credential can have several independently routable quota domains. In
// particular, OpenAI may protect the standard Codex week while the independent
// Spark session/week remains usable. Account-level summary cards must therefore
// report "ready" when any domain is ready, "unknown" when none are ready but at
// least one domain is not confirmed, and "protected" only when every known
// domain is protected.
export const summarizeBravoQuotaRouting = (
  confidence: string,
  standardSession: BravoQuotaWindow,
  standardWeekly: BravoQuotaWindow,
  independentDomains: BravoIndependentQuotaDomain[]
): BravoQuotaRoutingState => {
  const states = [
    quotaDomainRoutingState(confidence, standardSession, standardWeekly),
    ...independentDomains.map((domain) =>
      quotaDomainRoutingState(confidence, domain.session, domain.weekly)
    ),
  ];
  if (states.includes('ready')) return 'ready';
  if (states.includes('unknown')) return 'unknown';
  return 'protected';
};

export const effectiveBravoSubscriptionHealth = (
  health: string,
  confidence: string,
  independentDomains: BravoIndependentQuotaDomain[]
): string => {
  const independentReady = independentDomains.some(
    (domain) => quotaDomainRoutingState(confidence, domain.session, domain.weekly) === 'ready'
  );
  return health === 'cooldown' && independentReady ? 'partial' : health;
};
