import { apiClient } from './client';
import { isRecord } from '@/utils/helpers';

export interface BravoUsageCounters {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  failures: number;
  latencyMs: number;
}

export interface BravoUsageSummary {
  session: BravoUsageCounters;
  weekly: BravoUsageCounters;
  total: BravoUsageCounters;
  averageLatencyMs: number;
}

export type BravoAnthropicCacheTTL = 'auto' | '5m' | '1h';

export interface BravoPromptCachePolicy {
  anthropicTtl: BravoAnthropicCacheTTL;
  openaiMode: 'provider_managed';
}

export interface BravoProject {
  id: string;
  name: string;
  enabled: boolean;
  status: string;
  models: string[];
  allowedAuthIds: string[];
  primaryAuthIds: string[];
  promptCache: BravoPromptCachePolicy;
  usage: BravoUsageSummary;
  createdAt: string;
  updatedAt: string;
}

export interface BravoModelOption {
  id: string;
  requestModel: string;
  displayName: string;
  description: string;
}

export type BravoQuotaResetMode = 'scheduled' | 'inactive' | 'not_applicable';

export interface BravoQuotaWindow {
  usedPercent: number | null;
  remainingPercent: number | null;
  resetAt: string | null;
  resetMode: BravoQuotaResetMode | null;
  eligible: boolean | null;
  reason: string;
}

export interface BravoModelQuotaWindow extends BravoQuotaWindow {
  model: string;
}

export interface BravoQuota {
  confidence: string;
  observedAt: string;
  error: string;
  refresh: BravoQuotaRefreshState;
  session: BravoQuotaWindow;
  weekly: BravoQuotaWindow;
  modelWeekly: BravoModelQuotaWindow[];
}

export interface BravoQuotaRefreshState {
  attemptCount: number;
  successCount: number;
  failureCount: number;
  lastAttemptAt: string;
  lastSuccessAt: string;
  lastFailureAt: string;
  nextAttemptAt: string;
}

export interface BravoQuotaRequestCounters {
  attempts: number;
  success: number;
  failure: number;
}

export interface BravoQuotaPolling {
  usageIntervalSeconds: number;
  minimumIntervalSeconds: number;
  maximumIntervalSeconds: number;
  profileIntervalSeconds: number;
  usageRequests: BravoQuotaRequestCounters;
  profileRequests: BravoQuotaRequestCounters;
}

export interface BravoModelIssue {
  model: string;
  providerErrorCode: 'credits_required';
  providerModel: string;
  providerModelDisplayName: string;
  providerNoticeTitle: string;
  providerNoticeText: string;
  providerDisabledReason: string;
  providerErrorReason: string;
  scope: 'model';
  retryAt: string;
  observedAt: string;
}

export interface BravoSubscription {
  authIndex: string;
  authId: string;
  analyticsId: string;
  provider: string;
  note: string;
  displayName: string;
  label: string;
  email: string;
  workspace: string;
  plan: string;
  tariff: string;
  effectiveTariff: string;
  enabled: boolean;
  health: string;
  modelIssues: BravoModelIssue[];
  primaryProjectIds: string[];
  quota: BravoQuota;
  profileRefresh: BravoQuotaRefreshState;
  usage: BravoUsageSummary;
}

export interface BravoTariff {
  id: string;
  multiplier: number;
  sessionFloorPercent: number;
  weeklyFloorPercent: number;
  reservationPercent: number;
}

export interface BravoProjectsResponse {
  projects: BravoProject[];
  models: BravoModelOption[];
  subscriptions: BravoSubscription[];
  tariffs: BravoTariff[];
  quotaPolling: BravoQuotaPolling;
}

export interface BravoProjectInput {
  id?: string;
  name: string;
  enabled?: boolean;
  models: string[];
  allowedAuthIds?: string[];
  primaryAuthIds?: string[];
  promptCache: Pick<BravoPromptCachePolicy, 'anthropicTtl'>;
}

export interface BravoKeyIssueResponse {
  project: BravoProject;
  plaintextKey: string;
  projectApi: {
    limitsEndpoint: string;
    routesEndpoint: string;
  };
}

export interface BravoSubscriptionPatch {
  authIndex: string;
  tariff: string;
  enabled: boolean;
}

export type BravoAnalyticsInterval = 'hour' | 'day';

export interface BravoAnalyticsUsage {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  totalTokens: number;
  failures: number;
  latencyMs: number;
  averageLatencyMs: number;
  averageTtftMs?: number;
  failureRatePercent: number;
}

export interface BravoAnalyticsPoint {
  start: string;
  end: string;
  usage: BravoAnalyticsUsage;
}

export interface BravoAnalyticsProjectBreakdown {
  projectId: string;
  name: string;
  usage: BravoAnalyticsUsage;
}

export interface BravoAnalyticsSubscriptionBreakdown {
  subscriptionId: string;
  authIndex: string;
  note: string;
  displayName: string;
  label: string;
  email: string;
  workspace: string;
  provider: string;
  usage: BravoAnalyticsUsage;
}

export interface BravoAnalyticsSubscriptionTimelinePoint {
  start: string;
  end: string;
  subscriptionId: string;
  authIndex: string;
  provider: string;
  note: string;
  displayName: string;
  label: string;
  email: string;
  workspace: string;
  usage: BravoAnalyticsUsage;
}

export interface BravoAnalyticsProviderBreakdown {
  provider: string;
  usage: BravoAnalyticsUsage;
}

export interface BravoAnalyticsModelBreakdown {
  provider: string;
  model: string;
  usage: BravoAnalyticsUsage;
}

export interface BravoAnalyticsProjectSubscriptionModelBreakdown {
  projectId: string;
  subscriptionId: string;
  provider: string;
  logicalModel: string;
  model: string;
  usage: BravoAnalyticsUsage;
}

export interface BravoAnalyticsResponse {
  schemaVersion: number;
  from: string;
  to: string;
  interval: BravoAnalyticsInterval;
  filters: {
    projectId: string;
    subscriptionId: string;
    provider: string;
    model: string;
  };
  retention: {
    hourlyDays: number;
    dailyDays: number;
  };
  coverageFrom: string;
  breakdownCoverageFrom: string;
  summary: BravoAnalyticsUsage;
  series: BravoAnalyticsPoint[];
  subscriptionTimeline: BravoAnalyticsSubscriptionTimelinePoint[];
  breakdown: {
    projects: BravoAnalyticsProjectBreakdown[];
    subscriptions: BravoAnalyticsSubscriptionBreakdown[];
    providers: BravoAnalyticsProviderBreakdown[];
    models: BravoAnalyticsModelBreakdown[];
    projectSubscriptionModels: BravoAnalyticsProjectSubscriptionModelBreakdown[];
  };
  generatedAt: string;
}

export interface BravoAnalyticsQuery {
  projectId: string;
  from: string;
  to: string;
  interval: BravoAnalyticsInterval;
  subscriptionId?: string;
  provider?: string;
  model?: string;
}

export interface BravoTraceAttempt {
  ordinal: number;
  at: string;
  provider: string;
  model: string;
  subscriptionId: string;
  subscriptionLabel: string;
  status: number;
  success: boolean;
  outcome: string;
  decision: string;
  committed: boolean;
  requestedEffort: string;
  effectiveEffort: string;
  latencyMs: number | null;
  ttfbMs: number | null;
  firstContentMs: number | null;
  errorCode: string;
  errorMessage: string;
  failureClass: string;
  retryAfter: string;
  requiredInputTokens: number | null;
  supportedInputTokens: number | null;
}

export interface BravoTrace {
  traceId: string;
  startedAt: string;
  projectId: string;
  logicalModel: string;
  status: number;
  success: boolean;
  outcome: string;
  finalCode: string;
  finalMessage: string;
  clientAction: string;
  totalLatencyMs: number | null;
  attempts: BravoTraceAttempt[];
}

export interface BravoTracesResponse {
  schemaVersion: number;
  retentionDays: number;
  warning: string;
  traces: BravoTrace[];
}

export interface BravoTracesQuery {
  projectId?: string;
  errorsOnly?: boolean;
  limit?: number;
}

export interface BravoRouteCandidate {
  id: string;
  provider: string;
  model: string;
  effort: string;
  priority: number;
  enabled: boolean;
  capabilities: string[];
}

export interface BravoRoute {
  id: string;
  requestModel: string;
  displayName: string;
  description: string;
  overridden: boolean;
  candidates: BravoRouteCandidate[];
  defaultCandidates: BravoRouteCandidate[];
}

export interface BravoRouteProvider {
  id: string;
  label: string;
  models: string[];
}

export interface BravoRoutesResponse {
  routes: BravoRoute[];
  providers: BravoRouteProvider[];
  efforts: string[];
  view: string;
  preview: unknown;
}

export type BravoCompatibilityFixKind = 'code' | 'yaml' | 'route';

export type BravoCompatibilityClassification =
  'supported' | 'code_fix' | 'yaml_fix' | 'route_fix' | 'unknown';

export interface BravoCompatibilityReason {
  code: string;
  message: string;
}

export interface BravoCompatibilityTarget {
  kind: BravoCompatibilityFixKind;
  path: string;
  selector: string;
}

export interface BravoCompatibilityFix {
  code: string;
  kind: BravoCompatibilityFixKind;
  title: string;
  reason: string;
  reasonCodes?: string[];
  target: string;
  targets?: string[];
  format: string;
  snippet: string;
  safeToApplyAutomatically: boolean;
}

export interface BravoCompatibilityModel {
  provider: string;
  model: string;
  displayName: string;
  classification: BravoCompatibilityClassification;
  baseModel: string;
  routeIds: string[];
  availableAccounts: number | null;
  catalog: boolean | null;
  available: boolean | null;
  detected: Record<string, boolean>;
  reasons: BravoCompatibilityReason[];
  targets: BravoCompatibilityTarget[];
  requiredFixes: string[];
  fixes: BravoCompatibilityFix[];
}

export interface BravoCompatibilitySummary {
  total: number;
  supported: number;
  codeFix: number;
  yamlFix: number;
  routeFix: number;
  actionRequired: number;
}

export interface BravoCompatibilityResponse {
  schemaVersion: number;
  generatedAt: string;
  failClosed: boolean | null;
  summary: BravoCompatibilitySummary;
  models: BravoCompatibilityModel[];
}

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

const decodeDisplayText = (value: unknown): string =>
  asString(value)
    .replace(/&#x([0-9a-f]+);/gi, (match, encoded: string) => {
      const codePoint = Number.parseInt(encoded, 16);
      return Number.isSafeInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match;
    })
    .replace(/&#([0-9]+);/g, (match, encoded: string) => {
      const codePoint = Number.parseInt(encoded, 10);
      return Number.isSafeInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : match;
    })
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

const asFiniteNumber = (value: unknown, fallback = 0): number => {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asOptionalFiniteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = asFiniteNumber(value, NaN);
  return Number.isFinite(parsed) ? parsed : null;
};

const asNullablePercent = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = asFiniteNumber(value, NaN);
  return Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : null;
};

const asNullableBoolean = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return null;
};

const asQuotaResetMode = (value: unknown): BravoQuotaResetMode | null => {
  const normalized = asString(value).trim().toLowerCase();
  if (normalized === 'scheduled' || normalized === 'inactive' || normalized === 'not_applicable') {
    return normalized;
  }
  return null;
};

const asSafeResetAt = (value: unknown, mode: BravoQuotaResetMode | null): string | null => {
  if (mode === 'inactive' || mode === 'not_applicable') return null;
  const normalized = asString(value).trim();
  if (!normalized) return null;
  const date = new Date(normalized);
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() <= 1) return null;
  return normalized;
};

const emptyUsageCounters = (): BravoUsageCounters => ({
  requests: 0,
  inputTokens: 0,
  outputTokens: 0,
  totalTokens: 0,
  failures: 0,
  latencyMs: 0,
});

const normalizeUsageCounters = (value: unknown): BravoUsageCounters => {
  const source = isRecord(value) ? value : {};
  return {
    requests: asFiniteNumber(source.requests),
    inputTokens: asFiniteNumber(source.input_tokens ?? source.inputTokens),
    outputTokens: asFiniteNumber(source.output_tokens ?? source.outputTokens),
    totalTokens: asFiniteNumber(source.total_tokens ?? source.totalTokens),
    failures: asFiniteNumber(source.failures),
    latencyMs: asFiniteNumber(source.latency_ms ?? source.latencyMs),
  };
};

const normalizeUsageSummary = (value: unknown): BravoUsageSummary => {
  const source = isRecord(value) ? value : {};
  return {
    session: source.session ? normalizeUsageCounters(source.session) : emptyUsageCounters(),
    weekly: source.weekly ? normalizeUsageCounters(source.weekly) : emptyUsageCounters(),
    total: source.total ? normalizeUsageCounters(source.total) : emptyUsageCounters(),
    averageLatencyMs: asFiniteNumber(source.average_latency_ms ?? source.averageLatencyMs),
  };
};

const emptyAnalyticsUsage = (): BravoAnalyticsUsage => ({
  requests: 0,
  inputTokens: 0,
  outputTokens: 0,
  reasoningTokens: 0,
  cachedTokens: 0,
  cacheReadTokens: 0,
  cacheCreationTokens: 0,
  totalTokens: 0,
  failures: 0,
  latencyMs: 0,
  averageLatencyMs: 0,
  failureRatePercent: 0,
});

export const normalizeBravoAnalyticsUsage = (value: unknown): BravoAnalyticsUsage => {
  const source = isRecord(value) ? value : {};
  const requests = asFiniteNumber(source.requests);
  const failures = asFiniteNumber(source.failures);
  const inputTokens = asFiniteNumber(source.input_tokens ?? source.inputTokens);
  const outputTokens = asFiniteNumber(source.output_tokens ?? source.outputTokens);
  const reasoningTokens = asFiniteNumber(source.reasoning_tokens ?? source.reasoningTokens);
  const cachedTokens = asFiniteNumber(source.cached_tokens ?? source.cachedTokens);
  const cacheReadTokens = asFiniteNumber(source.cache_read_tokens ?? source.cacheReadTokens);
  const cacheCreationTokens = asFiniteNumber(
    source.cache_creation_tokens ?? source.cacheCreationTokens
  );
  const totalTokens = asFiniteNumber(
    source.total_tokens ?? source.totalTokens,
    inputTokens + outputTokens + reasoningTokens
  );
  const latencyMs = asFiniteNumber(source.latency_ms ?? source.latencyMs);
  const averageTtftMs = asOptionalFiniteNumber(source.average_ttft_ms ?? source.averageTtftMs);
  return {
    requests,
    inputTokens,
    outputTokens,
    reasoningTokens,
    cachedTokens,
    cacheReadTokens,
    cacheCreationTokens,
    totalTokens,
    failures,
    latencyMs,
    averageLatencyMs: asFiniteNumber(
      source.average_latency_ms ?? source.averageLatencyMs,
      requests > 0 ? latencyMs / requests : 0
    ),
    ...(averageTtftMs === null ? {} : { averageTtftMs }),
    failureRatePercent: asFiniteNumber(
      source.failure_rate_percent ?? source.failureRatePercent,
      requests > 0 ? (failures / requests) * 100 : 0
    ),
  };
};

const normalizeQuotaWindow = (value: unknown): BravoQuotaWindow => {
  const source = isRecord(value) ? value : {};
  const resetMode = asQuotaResetMode(source.reset_mode ?? source.resetMode);
  return {
    usedPercent: asNullablePercent(source.used_percent ?? source.usedPercent),
    remainingPercent: asNullablePercent(source.remaining_percent ?? source.remainingPercent),
    resetAt: asSafeResetAt(source.reset_at ?? source.resetAt, resetMode),
    resetMode,
    eligible: asNullableBoolean(source.eligible),
    reason: asString(source.reason).trim(),
  };
};

const normalizeQuota = (value: unknown): BravoQuota => {
  const source = isRecord(value) ? value : {};
  const rawModelWeekly = source.model_weekly ?? source.modelWeekly;
  return {
    confidence:
      asString(source.confidence ?? source.status)
        .trim()
        .toLowerCase() || 'unknown',
    observedAt: asString(
      source.observed_at ?? source.observedAt ?? source.refreshed_at ?? source.refreshedAt
    ).trim(),
    error: asString(source.error).trim(),
    refresh: normalizeQuotaRefreshState(source.refresh),
    session: normalizeQuotaWindow(source.session),
    weekly: normalizeQuotaWindow(source.weekly),
    modelWeekly: Array.isArray(rawModelWeekly)
      ? rawModelWeekly.map((entry) => {
          const item = isRecord(entry) ? entry : {};
          return {
            model: asString(item.model).trim(),
            ...normalizeQuotaWindow(item),
          };
        })
      : [],
  };
};

const normalizeQuotaRefreshState = (value: unknown): BravoQuotaRefreshState => {
  const source = isRecord(value) ? value : {};
  return {
    attemptCount: asFiniteNumber(source.attempt_count ?? source.attemptCount),
    successCount: asFiniteNumber(source.success_count ?? source.successCount),
    failureCount: asFiniteNumber(source.failure_count ?? source.failureCount),
    lastAttemptAt: safeTimestamp(source.last_attempt_at ?? source.lastAttemptAt),
    lastSuccessAt: safeTimestamp(source.last_success_at ?? source.lastSuccessAt),
    lastFailureAt: safeTimestamp(source.last_failure_at ?? source.lastFailureAt),
    nextAttemptAt: safeTimestamp(source.next_attempt_at ?? source.nextAttemptAt),
  };
};

const normalizeQuotaRequestCounters = (value: unknown): BravoQuotaRequestCounters => {
  const source = isRecord(value) ? value : {};
  return {
    attempts: asFiniteNumber(source.attempts),
    success: asFiniteNumber(source.success),
    failure: asFiniteNumber(source.failure),
  };
};

const normalizeQuotaPolling = (value: unknown): BravoQuotaPolling => {
  const source = isRecord(value) ? value : {};
  return {
    usageIntervalSeconds: asFiniteNumber(
      source.usage_interval_seconds ?? source.usageIntervalSeconds,
      900
    ),
    minimumIntervalSeconds: asFiniteNumber(
      source.minimum_interval_seconds ?? source.minimumIntervalSeconds,
      300
    ),
    maximumIntervalSeconds: asFiniteNumber(
      source.maximum_interval_seconds ?? source.maximumIntervalSeconds,
      86400
    ),
    profileIntervalSeconds: asFiniteNumber(
      source.profile_interval_seconds ?? source.profileIntervalSeconds,
      21600
    ),
    usageRequests: normalizeQuotaRequestCounters(source.usage_requests ?? source.usageRequests),
    profileRequests: normalizeQuotaRequestCounters(
      source.profile_requests ?? source.profileRequests
    ),
  };
};

const normalizeProject = (value: unknown): BravoProject => {
  const source = isRecord(value) ? value : {};
  const rawPromptCache = source.prompt_cache ?? source.promptCache;
  const promptCache = isRecord(rawPromptCache) ? rawPromptCache : {};
  const rawAnthropicTtl = asString(promptCache.anthropic_ttl ?? promptCache.anthropicTtl).trim();
  const anthropicTtl: BravoAnthropicCacheTTL =
    rawAnthropicTtl === '5m' || rawAnthropicTtl === '1h' ? rawAnthropicTtl : 'auto';
  return {
    id: asString(source.id).trim(),
    name: asString(source.name).trim(),
    enabled: source.enabled !== false,
    status:
      asString(source.status).trim().toLowerCase() ||
      (source.enabled === false ? 'disabled' : 'active'),
    models: asStringArray(source.models),
    allowedAuthIds: asStringArray(source.allowed_auth_ids ?? source.allowedAuthIds),
    primaryAuthIds: asStringArray(source.primary_auth_ids ?? source.primaryAuthIds),
    promptCache: {
      anthropicTtl,
      openaiMode: 'provider_managed',
    },
    usage: normalizeUsageSummary(source.usage),
    createdAt: asString(source.created_at ?? source.createdAt).trim(),
    updatedAt: asString(source.updated_at ?? source.updatedAt).trim(),
  };
};

const normalizeModelOption = (value: unknown): BravoModelOption | null => {
  if (typeof value === 'string') {
    const id = value.trim();
    return id ? { id, requestModel: id, displayName: id, description: '' } : null;
  }
  const source = isRecord(value) ? value : {};
  const requestModel = asString(source.request_model ?? source.requestModel ?? source.id).trim();
  const id = asString(source.id).trim();
  if (!id) return null;
  return {
    id,
    requestModel: requestModel || id,
    displayName: asString(source.display_name ?? source.displayName).trim() || requestModel || id,
    description: asString(source.description).trim(),
  };
};

const safeMachineValue = (value: unknown, maxLength = 128): string => {
  const normalized = asString(value).trim();
  if (!normalized || normalized.length > maxLength || !/^[a-zA-Z0-9_.:/-]+$/.test(normalized)) {
    return '';
  }
  return normalized;
};

const unsafeProviderTextPattern =
  /(?:request[_\s-]?id|authorization|bearer\s|api[_\s-]?key|access[_\s-]?token|refresh[_\s-]?token|session[_\s-]?(?:key|token)|client[_\s-]?secret|password|passphrase|private[_\s-]?key|payment[_\s-]?method)/i;

const safeProviderText = (value: unknown, maxLength: number): string => {
  const normalized = decodeDisplayText(value).trim();
  if (!normalized || unsafeProviderTextPattern.test(normalized)) return '';
  if (normalized.startsWith('{') || normalized.startsWith('[')) return '';
  return normalized.slice(0, maxLength);
};

const safeTimestamp = (value: unknown): string => {
  const normalized = asString(value).trim();
  if (!normalized || normalized.length > 64 || !Number.isFinite(Date.parse(normalized))) {
    return '';
  }
  return normalized;
};

const normalizeModelIssue = (value: unknown): BravoModelIssue | null => {
  const source = isRecord(value) ? value : {};
  const model = safeMachineValue(source.model, 256);
  const providerErrorCode = safeMachineValue(
    source.provider_error_code ?? source.providerErrorCode
  );
  const scope = safeMachineValue(source.scope, 32);
  if (!model || providerErrorCode !== 'credits_required' || scope !== 'model') return null;
  return {
    model,
    providerErrorCode,
    providerModel: safeMachineValue(source.provider_model ?? source.providerModel, 256) || model,
    providerModelDisplayName: safeProviderText(
      source.provider_model_display_name ?? source.providerModelDisplayName,
      160
    ),
    providerNoticeTitle: safeProviderText(
      source.provider_notice_title ?? source.providerNoticeTitle,
      240
    ),
    providerNoticeText: safeProviderText(
      source.provider_notice_text ?? source.providerNoticeText,
      600
    ),
    providerDisabledReason: safeMachineValue(
      source.provider_disabled_reason ?? source.providerDisabledReason
    ),
    providerErrorReason: safeMachineValue(
      source.provider_error_reason ?? source.providerErrorReason
    ),
    scope,
    retryAt: safeTimestamp(source.retry_at ?? source.retryAt),
    observedAt: safeTimestamp(source.observed_at ?? source.observedAt),
  };
};

const normalizeSubscription = (value: unknown): BravoSubscription | null => {
  const source = isRecord(value) ? value : {};
  const authIndex = asString(source.auth_index ?? source.authIndex).trim();
  const rawModelIssues = source.model_issues ?? source.modelIssues;
  if (!authIndex) return null;
  return {
    authIndex,
    authId: asString(source.auth_id ?? source.authId).trim(),
    analyticsId: asString(source.analytics_id ?? source.analyticsId).trim(),
    provider: asString(source.provider).trim().toLowerCase() || 'unknown',
    note: decodeDisplayText(source.note).trim(),
    displayName: decodeDisplayText(source.display_name ?? source.displayName).trim(),
    label: decodeDisplayText(source.label ?? source.name).trim(),
    email: decodeDisplayText(source.email).trim(),
    workspace: decodeDisplayText(source.workspace ?? source.organization ?? source.org).trim(),
    plan: decodeDisplayText(source.plan ?? source.plan_type ?? source.planType).trim(),
    tariff: asString(source.tariff).trim().toLowerCase() || 'auto',
    effectiveTariff:
      asString(source.effective_tariff ?? source.effectiveTariff)
        .trim()
        .toLowerCase() ||
      asString(source.tariff).trim().toLowerCase() ||
      'x1',
    enabled: source.enabled !== false,
    health:
      asString(source.health ?? source.status)
        .trim()
        .toLowerCase() || 'unknown',
    modelIssues: Array.isArray(rawModelIssues)
      ? rawModelIssues
          .map(normalizeModelIssue)
          .filter((item): item is BravoModelIssue => item !== null)
      : [],
    primaryProjectIds: asStringArray(source.primary_project_ids ?? source.primaryProjectIds),
    quota: normalizeQuota(source.quota),
    profileRefresh: normalizeQuotaRefreshState(source.profile_refresh ?? source.profileRefresh),
    usage: normalizeUsageSummary(source.usage),
  };
};

const normalizeTariff = (value: unknown): BravoTariff | null => {
  const source = isRecord(value) ? value : {};
  const id = asString(source.id).trim().toLowerCase();
  if (!id) return null;
  return {
    id,
    multiplier: asFiniteNumber(source.multiplier, 1),
    sessionFloorPercent: asFiniteNumber(source.session_floor_percent ?? source.sessionFloorPercent),
    weeklyFloorPercent: asFiniteNumber(source.weekly_floor_percent ?? source.weeklyFloorPercent),
    reservationPercent: asFiniteNumber(source.reservation_percent ?? source.reservationPercent),
  };
};

const normalizeAnalyticsPoint = (value: unknown): BravoAnalyticsPoint | null => {
  const source = isRecord(value) ? value : {};
  const start = asString(source.start ?? source.timestamp).trim();
  if (!start) return null;
  return {
    start,
    end: asString(source.end).trim(),
    usage: normalizeBravoAnalyticsUsage(source.usage ?? source),
  };
};

const normalizeSubscriptionTimelinePoint = (
  value: unknown
): BravoAnalyticsSubscriptionTimelinePoint | null => {
  const source = isRecord(value) ? value : {};
  const start = asString(source.start ?? source.timestamp).trim();
  const subscriptionId = asString(
    source.subscription_id ?? source.subscriptionId ?? source.auth_index ?? source.authIndex
  ).trim();
  if (!start || !subscriptionId) return null;
  return {
    start,
    end: asString(source.end).trim(),
    subscriptionId,
    authIndex: asString(source.auth_index ?? source.authIndex).trim(),
    provider: asString(source.provider).trim().toLowerCase(),
    note: decodeDisplayText(source.note).trim(),
    displayName: decodeDisplayText(source.display_name ?? source.displayName).trim(),
    label: decodeDisplayText(source.label).trim(),
    email: decodeDisplayText(source.email).trim(),
    workspace: decodeDisplayText(source.workspace ?? source.organization ?? source.org).trim(),
    usage: normalizeBravoAnalyticsUsage(source.usage ?? source),
  };
};

const usageFromBreakdown = (source: Record<string, unknown>): BravoAnalyticsUsage =>
  normalizeBravoAnalyticsUsage(source.usage ?? source);

const normalizeAnalyticsInterval = (value: unknown): BravoAnalyticsInterval =>
  asString(value).trim().toLowerCase() === 'hour' ? 'hour' : 'day';

export const normalizeBravoAnalyticsResponse = (value: unknown): BravoAnalyticsResponse => {
  const source = isRecord(value) ? value : {};
  const filters = isRecord(source.filters) ? source.filters : {};
  const retention = isRecord(source.retention) ? source.retention : {};
  const breakdown = isRecord(source.breakdown) ? source.breakdown : {};
  const rawSubscriptionTimeline = source.subscription_timeline ?? source.subscriptionTimeline;
  const normalizeList = <T>(
    candidate: unknown,
    normalizer: (entry: Record<string, unknown>) => T | null
  ): T[] =>
    Array.isArray(candidate)
      ? candidate
          .map((entry) => normalizer(isRecord(entry) ? entry : {}))
          .filter((entry): entry is T => entry !== null)
      : [];

  return {
    schemaVersion: asFiniteNumber(source.schema_version ?? source.schemaVersion, 1),
    from: asString(source.from).trim(),
    to: asString(source.to).trim(),
    interval: normalizeAnalyticsInterval(source.interval ?? source.bucket),
    filters: {
      projectId: asString(filters.project_id ?? filters.projectId).trim(),
      subscriptionId: asString(filters.subscription_id ?? filters.subscriptionId).trim(),
      provider: asString(filters.provider).trim(),
      model: asString(filters.model).trim(),
    },
    retention: {
      hourlyDays: asFiniteNumber(retention.hourly_days ?? retention.hourlyDays),
      dailyDays: asFiniteNumber(retention.daily_days ?? retention.dailyDays),
    },
    coverageFrom: asString(source.coverage_from ?? source.coverageFrom).trim(),
    breakdownCoverageFrom: asString(
      source.breakdown_coverage_from ?? source.breakdownCoverageFrom
    ).trim(),
    summary: source.summary ? normalizeBravoAnalyticsUsage(source.summary) : emptyAnalyticsUsage(),
    series: Array.isArray(source.series)
      ? source.series
          .map(normalizeAnalyticsPoint)
          .filter((point): point is BravoAnalyticsPoint => point !== null)
      : [],
    subscriptionTimeline: Array.isArray(rawSubscriptionTimeline)
      ? rawSubscriptionTimeline
          .map(normalizeSubscriptionTimelinePoint)
          .filter((point): point is BravoAnalyticsSubscriptionTimelinePoint => point !== null)
      : [],
    breakdown: {
      projects: normalizeList(breakdown.projects, (entry) => {
        const projectId = asString(entry.project_id ?? entry.projectId).trim();
        if (!projectId) return null;
        return {
          projectId,
          name: asString(entry.name ?? entry.label).trim(),
          usage: usageFromBreakdown(entry),
        };
      }),
      subscriptions: normalizeList(breakdown.subscriptions, (entry) => {
        const subscriptionId = asString(
          entry.subscription_id ?? entry.subscriptionId ?? entry.auth_index ?? entry.authIndex
        ).trim();
        if (!subscriptionId) return null;
        return {
          subscriptionId,
          authIndex: asString(entry.auth_index ?? entry.authIndex).trim(),
          note: decodeDisplayText(entry.note).trim(),
          displayName: decodeDisplayText(entry.display_name ?? entry.displayName).trim(),
          label: decodeDisplayText(entry.label).trim(),
          email: decodeDisplayText(entry.email).trim(),
          workspace: decodeDisplayText(entry.workspace ?? entry.organization ?? entry.org).trim(),
          provider: asString(entry.provider).trim().toLowerCase(),
          usage: usageFromBreakdown(entry),
        };
      }),
      providers: normalizeList(breakdown.providers, (entry) => {
        const provider = asString(entry.provider ?? entry.id)
          .trim()
          .toLowerCase();
        return provider ? { provider, usage: usageFromBreakdown(entry) } : null;
      }),
      models: normalizeList(breakdown.models, (entry) => {
        const model = asString(entry.model ?? entry.id).trim();
        if (!model) return null;
        return {
          provider: asString(entry.provider).trim().toLowerCase(),
          model,
          usage: usageFromBreakdown(entry),
        };
      }),
      projectSubscriptionModels: normalizeList(
        breakdown.project_subscription_models ?? breakdown.projectSubscriptionModels,
        (entry) => {
          const projectId = asString(entry.project_id ?? entry.projectId).trim();
          const subscriptionId = asString(
            entry.subscription_id ?? entry.subscriptionId ?? entry.auth_index ?? entry.authIndex
          ).trim();
          const model = asString(entry.model).trim();
          if (!projectId || !subscriptionId || !model) return null;
          return {
            projectId,
            subscriptionId,
            provider: asString(entry.provider).trim().toLowerCase(),
            logicalModel: asString(entry.logical_model ?? entry.logicalModel).trim(),
            model,
            usage: usageFromBreakdown(entry),
          };
        }
      ),
    },
    generatedAt: asString(source.generated_at ?? source.generatedAt).trim(),
  };
};

const normalizeBravoTraceAttempt = (value: unknown): BravoTraceAttempt | null => {
  const source = isRecord(value) ? value : {};
  const provider = asString(source.provider).trim().toLowerCase();
  const model = asString(source.model).trim();
  if (!provider && !model) return null;
  return {
    ordinal: asFiniteNumber(source.ordinal ?? source.attempt_ordinal ?? source.attemptOrdinal),
    at: asString(source.at ?? source.started_at ?? source.startedAt).trim(),
    provider,
    model,
    subscriptionId: asString(source.subscription_id ?? source.subscriptionId).trim(),
    subscriptionLabel: asString(source.subscription_label ?? source.subscriptionLabel).trim(),
    status: asFiniteNumber(source.status),
    success: source.success === true,
    outcome: asString(source.outcome).trim(),
    decision: asString(source.decision).trim(),
    committed: source.committed === true,
    requestedEffort: asString(source.requested_effort ?? source.requestedEffort).trim(),
    effectiveEffort: asString(source.effective_effort ?? source.effectiveEffort).trim(),
    latencyMs: asOptionalFiniteNumber(source.latency_ms ?? source.latencyMs),
    ttfbMs: asOptionalFiniteNumber(source.ttfb_ms ?? source.ttfbMs),
    firstContentMs: asOptionalFiniteNumber(source.first_content_ms ?? source.firstContentMs),
    errorCode: asString(source.error_code ?? source.errorCode).trim(),
    // The backend has already redacted and localized this field. Do not decode or translate it.
    errorMessage: asString(source.error_message ?? source.errorMessage),
    failureClass: asString(source.failure_class ?? source.failureClass).trim(),
    retryAfter: asString(source.retry_after ?? source.retryAfter).trim(),
    requiredInputTokens: asOptionalFiniteNumber(
      source.required_input_tokens ?? source.requiredInputTokens
    ),
    supportedInputTokens: asOptionalFiniteNumber(
      source.supported_input_tokens ?? source.supportedInputTokens
    ),
  };
};

const normalizeBravoTrace = (value: unknown): BravoTrace | null => {
  const source = isRecord(value) ? value : {};
  const traceId = asString(source.trace_id ?? source.traceId).trim();
  if (!traceId) return null;
  const rawAttempts = source.attempts;
  return {
    traceId,
    startedAt: asString(source.started_at ?? source.startedAt).trim(),
    projectId: asString(source.project_id ?? source.projectId).trim(),
    logicalModel: asString(source.logical_model ?? source.logicalModel).trim(),
    status: asFiniteNumber(source.status ?? source.final_status ?? source.finalStatus),
    success: source.success === true,
    outcome: asString(source.outcome).trim(),
    finalCode: asString(source.final_code ?? source.finalCode).trim(),
    // The final message is a reviewed, safe Russian explanation supplied by the server.
    finalMessage: asString(source.final_message ?? source.finalMessage),
    clientAction: asString(source.client_action ?? source.clientAction).trim(),
    totalLatencyMs: asOptionalFiniteNumber(
      source.total_latency_ms ?? source.totalLatencyMs ?? source.route_duration_ms
    ),
    attempts: Array.isArray(rawAttempts)
      ? rawAttempts
          .map(normalizeBravoTraceAttempt)
          .filter((attempt): attempt is BravoTraceAttempt => attempt !== null)
      : [],
  };
};

export const normalizeBravoTracesResponse = (value: unknown): BravoTracesResponse => {
  const source = isRecord(value) ? value : {};
  return {
    schemaVersion: asFiniteNumber(source.schema_version ?? source.schemaVersion, 1),
    retentionDays: asFiniteNumber(source.retention_days ?? source.retentionDays),
    warning: asString(source.warning),
    traces: Array.isArray(source.traces)
      ? source.traces
          .map(normalizeBravoTrace)
          .filter((trace): trace is BravoTrace => trace !== null)
      : [],
  };
};

const normalizeRouteCandidate = (value: unknown, index: number): BravoRouteCandidate | null => {
  const source = isRecord(value) ? value : {};
  const provider = asString(source.provider).trim().toLowerCase();
  const model = asString(source.model).trim();
  if (!provider || !model) return null;
  return {
    id: asString(source.id).trim() || `${provider}:${model}:${index}`,
    provider,
    model,
    effort: asString(source.effort).trim(),
    priority: asFiniteNumber(source.priority, 1000 - index),
    enabled: source.enabled !== false,
    capabilities: asStringArray(source.capabilities).map((capability) => capability.toLowerCase()),
  };
};

const normalizeRoute = (value: unknown): BravoRoute | null => {
  const source = isRecord(value) ? value : {};
  const id = asString(source.id).trim();
  if (!id) return null;
  const candidates = Array.isArray(source.candidates)
    ? source.candidates
        .map(normalizeRouteCandidate)
        .filter((candidate): candidate is BravoRouteCandidate => candidate !== null)
        .sort((left, right) => right.priority - left.priority)
    : [];
  const rawDefaults = source.default_candidates ?? source.defaultCandidates;
  const defaultCandidates = Array.isArray(rawDefaults)
    ? rawDefaults
        .map(normalizeRouteCandidate)
        .filter((candidate): candidate is BravoRouteCandidate => candidate !== null)
        .sort((left, right) => right.priority - left.priority)
    : [];
  return {
    id,
    requestModel: asString(source.request_model ?? source.requestModel).trim() || `bravo/${id}`,
    displayName: asString(source.display_name ?? source.displayName).trim() || id,
    description: asString(source.description).trim(),
    overridden: source.overridden === true,
    candidates,
    defaultCandidates,
  };
};

export const normalizeBravoRoutesResponse = (value: unknown): BravoRoutesResponse => {
  const source = isRecord(value) ? value : {};
  const routes = Array.isArray(source.routes)
    ? source.routes.map(normalizeRoute).filter((route): route is BravoRoute => route !== null)
    : [];
  const rawProviders = Array.isArray(source.providers) ? source.providers : [];
  const providerMap = new Map<string, BravoRouteProvider>();
  rawProviders.forEach((entry) => {
    const provider = isRecord(entry) ? entry : {};
    const id = asString(provider.id ?? provider.provider)
      .trim()
      .toLowerCase();
    if (!id) return;
    providerMap.set(id, {
      id,
      label: asString(provider.label).trim() || id,
      models: asStringArray(provider.models),
    });
  });
  routes.forEach((route) => {
    [...route.defaultCandidates, ...route.candidates].forEach((candidate) => {
      const current = providerMap.get(candidate.provider) ?? {
        id: candidate.provider,
        label: candidate.provider,
        models: [],
      };
      if (!current.models.includes(candidate.model)) current.models.push(candidate.model);
      providerMap.set(candidate.provider, current);
    });
  });
  const efforts = asStringArray(source.efforts);
  if (!efforts.includes('')) efforts.unshift('');
  return {
    routes,
    providers: [...providerMap.values()],
    efforts,
    view: asString(source.view).trim(),
    preview: source.preview ?? null,
  };
};

const normalizeCompatibilityFixKind = (value: unknown): BravoCompatibilityFixKind | null => {
  const normalized = asString(value)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (['code', 'code_fix', 'requires_code', 'needs_code', 'code_required'].includes(normalized)) {
    return 'code';
  }
  if (['yaml', 'yaml_fix', 'requires_yaml', 'needs_yaml', 'yaml_required'].includes(normalized)) {
    return 'yaml';
  }
  if (
    ['route', 'route_fix', 'requires_route', 'needs_route', 'route_required'].includes(normalized)
  ) {
    return 'route';
  }
  return null;
};

const normalizeCompatibilityClassification = (
  value: unknown,
  fallbackKind: BravoCompatibilityFixKind | null
): BravoCompatibilityClassification => {
  const normalized = asString(value)
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (['supported', 'compatible', 'ready', 'ok'].includes(normalized)) return 'supported';
  const kind = normalizeCompatibilityFixKind(normalized) ?? fallbackKind;
  return kind ? `${kind}_fix` : 'unknown';
};

const normalizeCompatibilityReason = (value: unknown): BravoCompatibilityReason | null => {
  if (typeof value === 'string') {
    const message = value.trim();
    return message ? { code: '', message } : null;
  }
  const source = isRecord(value) ? value : {};
  const message = asString(source.message ?? source.reason ?? source.description).trim();
  const code = asString(source.code ?? source.id).trim();
  if (!message && !code) return null;
  return { code, message: message || code };
};

const normalizeCompatibilityTarget = (value: unknown): BravoCompatibilityTarget | null => {
  const source = isRecord(value) ? value : {};
  const kind = normalizeCompatibilityFixKind(source.kind ?? source.type);
  if (!kind) return null;
  return {
    kind,
    path: asString(source.path ?? source.target).trim(),
    selector: asString(source.selector ?? source.key).trim(),
  };
};

const compatibilityTargetLabel = (
  source: Record<string, unknown>,
  target: BravoCompatibilityTarget | undefined
): string => {
  const direct = asString(source.target).trim();
  if (direct) return direct;
  if (!target) return '';
  if (target.path && target.selector) return `${target.path} · ${target.selector}`;
  return target.path || target.selector;
};

const normalizeCompatibilityFix = (
  value: unknown,
  fallbackKind: BravoCompatibilityFixKind,
  reasons: BravoCompatibilityReason[],
  targets: BravoCompatibilityTarget[]
): BravoCompatibilityFix | null => {
  const source = isRecord(value) ? value : {};
  const kind = normalizeCompatibilityFixKind(source.kind ?? source.type) ?? fallbackKind;
  const snippet = asString(source.snippet ?? source.patch ?? source.example).trim();
  const title = asString(source.title ?? source.name).trim();
  const reason = asString(source.reason ?? source.description).trim();
  const reasonCodes = [
    asString(source.reason_code ?? source.reasonCode).trim(),
    ...asStringArray(source.reason_codes ?? source.reasonCodes),
  ].filter((code, index, all) => code && all.indexOf(code) === index);
  const contextualReasons = reasonCodes.flatMap((code) =>
    reasons.filter((candidate) => candidate.code === code)
  );
  const explicitTargets = [
    ...(Array.isArray(source.targets)
      ? source.targets
          .map(normalizeCompatibilityTarget)
          .filter((target): target is BravoCompatibilityTarget => target !== null)
      : []),
    ...(normalizeCompatibilityTarget(source.target)
      ? [normalizeCompatibilityTarget(source.target) as BravoCompatibilityTarget]
      : []),
  ];
  const contextualTargets =
    explicitTargets.length > 0
      ? explicitTargets
      : targets.filter((candidate) => candidate.kind === kind);
  const targetLabels = contextualTargets
    .map((target) => compatibilityTargetLabel({}, target))
    .filter((label, index, all) => label && all.indexOf(label) === index);
  const directTarget = asString(source.target).trim();
  if (directTarget && !targetLabels.includes(directTarget)) targetLabels.unshift(directTarget);
  if (!title && !snippet && targetLabels.length === 0 && !reason) return null;
  return {
    code: asString(source.code ?? source.id).trim(),
    kind,
    title: title || asString(source.code).trim() || `${kind}_fix`,
    reason:
      reason ||
      contextualReasons
        .map((candidate) => candidate.message)
        .filter(Boolean)
        .join(' ') ||
      reasons[0]?.message ||
      '',
    reasonCodes,
    target: targetLabels.join('; '),
    targets: targetLabels,
    format: asString(source.format ?? source.language).trim(),
    snippet,
    safeToApplyAutomatically:
      asNullableBoolean(source.safe_to_apply_automatically ?? source.safeToApplyAutomatically) ===
      true,
  };
};

const normalizeCompatibilityDetected = (value: unknown): Record<string, boolean> => {
  if (Array.isArray(value)) {
    return Object.fromEntries(
      value
        .map((entry) => asString(entry).trim())
        .filter(Boolean)
        .map((entry) => [entry, true])
    );
  }
  if (typeof value === 'boolean') return { detected: value };
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entry]) => [key, asNullableBoolean(entry)] as const)
      .filter((entry): entry is readonly [string, boolean] => entry[1] !== null)
  );
};

const normalizeCompatibilityModel = (value: unknown): BravoCompatibilityModel | null => {
  const source = isRecord(value) ? value : {};
  const model = asString(source.model ?? source.id).trim();
  if (!model) return null;

  const reasons = Array.isArray(source.reasons)
    ? source.reasons
        .map(normalizeCompatibilityReason)
        .filter((reason): reason is BravoCompatibilityReason => reason !== null)
    : [];
  const targets = Array.isArray(source.targets)
    ? source.targets
        .map(normalizeCompatibilityTarget)
        .filter((target): target is BravoCompatibilityTarget => target !== null)
    : [];
  const rawRequiredFixes = Array.isArray(source.required_fixes ?? source.requiredFixes)
    ? ((source.required_fixes ?? source.requiredFixes) as unknown[])
    : [];
  const rawSuggestedFixes = Array.isArray(source.suggested_fixes ?? source.suggestedFixes)
    ? ((source.suggested_fixes ?? source.suggestedFixes) as unknown[])
    : [];
  const classificationKind = normalizeCompatibilityFixKind(source.classification ?? source.status);
  const requiredFixes = rawRequiredFixes
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      const fix = isRecord(entry) ? entry : {};
      return asString(fix.code ?? fix.id ?? fix.kind ?? fix.title).trim();
    })
    .filter(Boolean);
  const inferredKind =
    classificationKind ??
    rawSuggestedFixes
      .map((entry) =>
        normalizeCompatibilityFixKind(isRecord(entry) ? (entry.kind ?? entry.type) : entry)
      )
      .find((kind): kind is BravoCompatibilityFixKind => kind !== null) ??
    rawRequiredFixes
      .map((entry) =>
        normalizeCompatibilityFixKind(isRecord(entry) ? (entry.kind ?? entry.type) : entry)
      )
      .find((kind): kind is BravoCompatibilityFixKind => kind !== null) ??
    null;
  const classification = normalizeCompatibilityClassification(
    source.classification ?? source.status,
    inferredKind
  );
  const defaultKind =
    inferredKind ??
    (classification === 'supported' || classification === 'unknown'
      ? 'route'
      : (classification.replace('_fix', '') as BravoCompatibilityFixKind));
  const normalizedSuggestedFixes = rawSuggestedFixes
    .map((entry) => normalizeCompatibilityFix(entry, defaultKind, reasons, targets))
    .filter((fix): fix is BravoCompatibilityFix => fix !== null);
  const normalizedRequiredFixes = rawRequiredFixes
    .map((entry) => {
      if (!isRecord(entry)) return null;
      return normalizeCompatibilityFix(entry, defaultKind, reasons, targets);
    })
    .filter((fix): fix is BravoCompatibilityFix => fix !== null);
  const fixes = [...normalizedSuggestedFixes, ...normalizedRequiredFixes].filter(
    (fix, index, all) =>
      all.findIndex(
        (candidate) =>
          candidate.code === fix.code &&
          candidate.kind === fix.kind &&
          candidate.title === fix.title &&
          candidate.target === fix.target &&
          candidate.snippet === fix.snippet
      ) === index
  );

  const rawAccounts = source.available_accounts ?? source.availableAccounts;
  const detected = normalizeCompatibilityDetected(source.detected);
  return {
    provider:
      asString(source.provider).trim().toLowerCase() ||
      asString(source.vendor).trim().toLowerCase() ||
      'unknown',
    model,
    displayName: asString(source.display_name ?? source.displayName).trim() || model,
    classification,
    baseModel: asString(source.base_model ?? source.baseModel).trim(),
    routeIds: asStringArray(source.route_ids ?? source.routeIds ?? source.routes),
    availableAccounts:
      rawAccounts === null || rawAccounts === undefined || rawAccounts === ''
        ? null
        : Array.isArray(rawAccounts)
          ? rawAccounts.length
          : Math.max(0, asFiniteNumber(rawAccounts)),
    catalog: asNullableBoolean(source.catalog ?? detected.catalog),
    available: asNullableBoolean(source.available ?? detected.available),
    detected,
    reasons,
    targets,
    requiredFixes,
    fixes,
  };
};

export const normalizeBravoCompatibilityResponse = (value: unknown): BravoCompatibilityResponse => {
  const source = isRecord(value) ? value : {};
  const summary = isRecord(source.summary) ? source.summary : {};
  const models = Array.isArray(source.models)
    ? source.models
        .map(normalizeCompatibilityModel)
        .filter((model): model is BravoCompatibilityModel => model !== null)
    : [];
  const classifiedCount = (classification: BravoCompatibilityClassification): number =>
    models.filter((model) => model.classification === classification).length;
  const supported = asFiniteNumber(
    summary.supported ?? summary.compatible,
    classifiedCount('supported')
  );
  const total = asFiniteNumber(summary.total, models.length);
  return {
    schemaVersion: asFiniteNumber(source.schema_version ?? source.schemaVersion, 1),
    generatedAt: asString(source.generated_at ?? source.generatedAt).trim(),
    failClosed: asNullableBoolean(source.fail_closed ?? source.failClosed),
    summary: {
      total,
      supported,
      codeFix: asFiniteNumber(
        summary.code_fix ?? summary.codeFix ?? summary.needs_code ?? summary.needsCode,
        classifiedCount('code_fix')
      ),
      yamlFix: asFiniteNumber(
        summary.yaml_fix ?? summary.yamlFix ?? summary.needs_yaml ?? summary.needsYaml,
        classifiedCount('yaml_fix')
      ),
      routeFix: asFiniteNumber(
        summary.route_fix ?? summary.routeFix ?? summary.needs_route ?? summary.needsRoute,
        classifiedCount('route_fix')
      ),
      actionRequired: asFiniteNumber(
        summary.action_required ?? summary.actionRequired,
        Math.max(0, total - supported)
      ),
    },
    models,
  };
};

export const normalizeBravoProjectsResponse = (value: unknown): BravoProjectsResponse => {
  const source = isRecord(value) ? value : {};
  return {
    projects: Array.isArray(source.projects)
      ? source.projects.map(normalizeProject).filter((project) => project.id && project.name)
      : [],
    models: Array.isArray(source.models)
      ? source.models
          .map(normalizeModelOption)
          .filter((model): model is BravoModelOption => model !== null)
      : [],
    subscriptions: Array.isArray(source.subscriptions)
      ? source.subscriptions
          .map(normalizeSubscription)
          .filter((item): item is BravoSubscription => item !== null)
      : [],
    tariffs: Array.isArray(source.tariffs)
      ? source.tariffs.map(normalizeTariff).filter((item): item is BravoTariff => item !== null)
      : [],
    quotaPolling: normalizeQuotaPolling(source.quota_polling ?? source.quotaPolling),
  };
};

export const mergeBravoResponses = (
  projectsResponse: BravoProjectsResponse,
  subscriptionsResponse: BravoProjectsResponse
): BravoProjectsResponse => ({
  projects:
    projectsResponse.projects.length > 0
      ? projectsResponse.projects
      : subscriptionsResponse.projects,
  models:
    projectsResponse.models.length > 0 ? projectsResponse.models : subscriptionsResponse.models,
  subscriptions:
    subscriptionsResponse.subscriptions.length > 0
      ? subscriptionsResponse.subscriptions
      : projectsResponse.subscriptions,
  tariffs:
    subscriptionsResponse.tariffs.length > 0
      ? subscriptionsResponse.tariffs
      : projectsResponse.tariffs,
  quotaPolling: subscriptionsResponse.quotaPolling,
});

export const normalizeBravoKeyIssueResponse = (value: unknown): BravoKeyIssueResponse => {
  const source = isRecord(value) ? value : {};
  const rawProjectApi = source.project_api ?? source.projectApi;
  const projectApi = isRecord(rawProjectApi) ? rawProjectApi : {};
  const limits = isRecord(projectApi.limits) ? projectApi.limits : {};
  const routes = isRecord(projectApi.routes) ? projectApi.routes : {};
  return {
    project: normalizeProject(source.project),
    plaintextKey: asString(source.plaintext_key ?? source.plaintextKey ?? source.key).trim(),
    projectApi: {
      limitsEndpoint: asString(limits.endpoint).trim() || '/v1/bravo/limits',
      routesEndpoint: asString(routes.endpoint).trim() || '/v1/bravo/routes',
    },
  };
};

export const serializeBravoProject = (input: BravoProjectInput) => ({
  ...(input.id ? { id: input.id } : {}),
  name: input.name.trim(),
  enabled: input.enabled ?? true,
  models: input.models,
  allowed_auth_ids: input.allowedAuthIds ?? [],
  primary_auth_ids: input.primaryAuthIds ?? [],
  prompt_cache: {
    anthropic_ttl: input.promptCache.anthropicTtl,
  },
});

export const serializeBravoRoute = (route: BravoRoute, preview = false) => ({
  id: route.id,
  candidates: route.candidates
    .filter((candidate) => candidate.enabled)
    .map((candidate) => ({
      provider: candidate.provider,
      model: candidate.model,
      ...(candidate.effort ? { effort: candidate.effort } : {}),
    })),
  ...(preview ? { preview: true } : {}),
});

const waitForBravoReconfigure = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));

export const bravoApi = {
  async listProjects(): Promise<BravoProjectsResponse> {
    return normalizeBravoProjectsResponse(await apiClient.get('/bravo/projects'));
  },

  async listSubscriptions(): Promise<BravoProjectsResponse> {
    return normalizeBravoProjectsResponse(await apiClient.get('/bravo/subscriptions'));
  },

  async listOverview(): Promise<BravoProjectsResponse> {
    const [projects, subscriptions] = await Promise.all([
      this.listProjects(),
      this.listSubscriptions(),
    ]);
    return mergeBravoResponses(projects, subscriptions);
  },

  async createProject(input: BravoProjectInput): Promise<BravoKeyIssueResponse> {
    return normalizeBravoKeyIssueResponse(
      await apiClient.post('/bravo/projects', serializeBravoProject(input))
    );
  },

  async updateProject(input: BravoProjectInput): Promise<BravoProject> {
    const value = await apiClient.patch('/bravo/projects', serializeBravoProject(input));
    const source = isRecord(value) && 'project' in value ? value.project : value;
    return normalizeProject(source);
  },

  async rotateProjectKey(id: string): Promise<BravoKeyIssueResponse> {
    return normalizeBravoKeyIssueResponse(await apiClient.post('/bravo/projects/rotate', { id }));
  },

  async deleteProject(id: string): Promise<void> {
    await apiClient.delete('/bravo/projects', { data: { id } });
  },

  async updateSubscription(input: BravoSubscriptionPatch): Promise<void> {
    await apiClient.patch('/bravo/subscriptions', {
      auth_index: input.authIndex,
      tariff: input.tariff,
      enabled: input.enabled,
    });
  },

  async updateTariff(input: BravoTariff): Promise<void> {
    await apiClient.patch('/bravo/tariffs', {
      id: input.id,
      session_floor_percent: input.sessionFloorPercent,
      weekly_floor_percent: input.weeklyFloorPercent,
      reservation_percent: input.reservationPercent,
    });
  },

  async refreshQuotas(): Promise<void> {
    await apiClient.post('/bravo/quotas/refresh', {});
  },

  async updateQuotaPolling(intervalSeconds: number): Promise<boolean> {
    await apiClient.patch('/plugins/bravo/config', {
      quota_usage_refresh_seconds: intervalSeconds,
    });
    // Core persists generic plugin config before its asynchronous hot reload
    // completes. Wait for Bravo's effective runtime view so the following page
    // refresh cannot flash the previous interval back into the form.
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await waitForBravoReconfigure(100);
      const effective = normalizeBravoProjectsResponse(await apiClient.get('/bravo/subscriptions'));
      if (effective.quotaPolling.usageIntervalSeconds === intervalSeconds) return true;
    }
    return false;
  },

  async getAnalytics(query: BravoAnalyticsQuery): Promise<BravoAnalyticsResponse> {
    return normalizeBravoAnalyticsResponse(
      await apiClient.get('/bravo/analytics', {
        params: {
          project_id: query.projectId,
          from: query.from,
          to: query.to,
          interval: query.interval,
          ...(query.subscriptionId ? { subscription_id: query.subscriptionId } : {}),
          ...(query.provider ? { provider: query.provider } : {}),
          ...(query.model ? { model: query.model } : {}),
        },
      })
    );
  },

  async getTraces(query: BravoTracesQuery = {}): Promise<BravoTracesResponse> {
    return normalizeBravoTracesResponse(
      await apiClient.get('/bravo/traces', {
        params: {
          project_id: query.projectId ?? '',
          errors_only: query.errorsOnly === true,
          limit: query.limit ?? 50,
        },
      })
    );
  },

  async getRoutes(): Promise<BravoRoutesResponse> {
    return normalizeBravoRoutesResponse(await apiClient.get('/bravo/routes'));
  },

  async getCompatibility(): Promise<BravoCompatibilityResponse> {
    return normalizeBravoCompatibilityResponse(await apiClient.get('/bravo/compatibility'));
  },

  async previewRoute(route: BravoRoute): Promise<BravoRoutesResponse> {
    return normalizeBravoRoutesResponse(
      await apiClient.put('/bravo/routes', serializeBravoRoute(route, true))
    );
  },

  async updateRoute(route: BravoRoute): Promise<BravoRoutesResponse> {
    return normalizeBravoRoutesResponse(
      await apiClient.put('/bravo/routes', serializeBravoRoute(route))
    );
  },

  async resetRoute(id: string): Promise<BravoRoutesResponse> {
    return normalizeBravoRoutesResponse(await apiClient.post('/bravo/routes/reset', { id }));
  },
};
