import type { BravoSubscription } from '@/services/api';

export interface BravoSubscriptionIdentitySource {
  provider?: string;
  note?: string;
  displayName?: string;
  label?: string;
  workspace?: string;
  email?: string;
  plan?: string;
  tariff?: string;
  effectiveTariff?: string;
  subscriptionId?: string;
  analyticsId?: string;
  authId?: string;
  authIndex?: string;
}

export interface BravoSubscriptionIdentity {
  title: string;
  subtitle: string;
  provider: string;
  workspaceEmail: string;
  searchText: string;
}

const clean = (value: string | undefined): string => value?.trim() ?? '';

const unique = (values: Array<string | undefined>): string[] => {
  const seen = new Set<string>();
  return values.reduce<string[]>((result, value) => {
    const normalized = clean(value);
    const key = normalized.toLocaleLowerCase();
    if (!normalized || seen.has(key)) return result;
    seen.add(key);
    result.push(normalized);
    return result;
  }, []);
};

const shortenOpaqueID = (value: string): string => {
  const normalized = clean(value);
  if (normalized.length <= 16) return normalized;
  return `${normalized.slice(0, 8)}…${normalized.slice(-5)}`;
};

const safeHumanText = (
  value: string | undefined,
  source: BravoSubscriptionIdentitySource
): string => {
  const text = clean(value);
  if (!text) return '';
  const technicalValues = unique([
    source.authIndex,
    source.authId,
    source.analyticsId,
    source.subscriptionId,
    source.workspace,
    source.email,
  ]);
  if (technicalValues.some((value) => value.toLocaleLowerCase() === text.toLocaleLowerCase())) {
    return '';
  }
  if (/\.json$/i.test(text)) return '';
  return text;
};

export const bravoProviderLabel = (provider: string): string => {
  const normalized = provider.trim().toLowerCase();
  if (normalized === 'claude' || normalized === 'anthropic') return 'Claude';
  if (normalized === 'codex') return 'OpenAI Codex';
  if (normalized === 'openai') return 'OpenAI';
  return provider.trim() || 'Unknown';
};

export const formatBravoSubscription = (
  source: BravoSubscriptionIdentitySource
): BravoSubscriptionIdentity => {
  const provider = bravoProviderLabel(clean(source.provider));
  const workspaceEmailParts = unique([source.workspace, source.email]);
  const workspaceEmail = workspaceEmailParts.join(' · ');
  const displayName = safeHumanText(source.displayName, source);
  const humanLabel = safeHumanText(source.label, source);
  const opaqueID = shortenOpaqueID(
    clean(source.subscriptionId) || clean(source.analyticsId) || clean(source.authId)
  );
  const title =
    clean(source.note) ||
    displayName ||
    humanLabel ||
    workspaceEmail ||
    [provider, opaqueID].filter(Boolean).join(' · ');

  const context = title === workspaceEmail ? [] : workspaceEmailParts;
  const tariff = clean(source.effectiveTariff) || clean(source.tariff);
  const secondaryParts = unique([
    provider,
    ...context,
    source.plan,
    tariff && tariff !== 'auto' ? tariff : '',
  ]);

  return {
    title,
    subtitle: secondaryParts.join(' · '),
    provider,
    workspaceEmail,
    searchText: unique([
      title,
      ...secondaryParts,
      source.note,
      source.displayName,
      source.label,
      source.authIndex,
      source.authId,
      source.analyticsId,
      source.subscriptionId,
    ])
      .join(' ')
      .toLocaleLowerCase(),
  };
};

export const formatBravoSubscriptionRecord = (
  subscription: BravoSubscription
): BravoSubscriptionIdentity =>
  formatBravoSubscription({
    ...subscription,
    subscriptionId: subscription.analyticsId,
  });
