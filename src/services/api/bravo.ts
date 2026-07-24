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

export interface BravoProject {
  id: string;
  name: string;
  enabled: boolean;
  status: string;
  models: string[];
  allowedAuthIds: string[];
  primaryAuthIds: string[];
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
  session: BravoQuotaWindow;
  weekly: BravoQuotaWindow;
  modelWeekly: BravoModelQuotaWindow[];
}

export interface BravoSubscription {
  authIndex: string;
  authId: string;
  analyticsId: string;
  provider: string;
  label: string;
  email: string;
  workspace: string;
  plan: string;
  tariff: string;
  effectiveTariff: string;
  enabled: boolean;
  health: string;
  primaryProjectIds: string[];
  quota: BravoQuota;
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
}

export interface BravoProjectInput {
  id?: string;
  name: string;
  enabled?: boolean;
  models: string[];
  allowedAuthIds?: string[];
  primaryAuthIds?: string[];
}

export interface BravoKeyIssueResponse {
  project: BravoProject;
  plaintextKey: string;
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
  label: string;
  provider: string;
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

const normalizeProject = (value: unknown): BravoProject => {
  const source = isRecord(value) ? value : {};
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

const normalizeSubscription = (value: unknown): BravoSubscription | null => {
  const source = isRecord(value) ? value : {};
  const authIndex = asString(source.auth_index ?? source.authIndex).trim();
  if (!authIndex) return null;
  return {
    authIndex,
    authId: asString(source.auth_id ?? source.authId).trim(),
    analyticsId: asString(source.analytics_id ?? source.analyticsId).trim(),
    provider: asString(source.provider).trim().toLowerCase() || 'unknown',
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
    primaryProjectIds: asStringArray(source.primary_project_ids ?? source.primaryProjectIds),
    quota: normalizeQuota(source.quota),
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

const usageFromBreakdown = (source: Record<string, unknown>): BravoAnalyticsUsage =>
  normalizeBravoAnalyticsUsage(source.usage ?? source);

const normalizeAnalyticsInterval = (value: unknown): BravoAnalyticsInterval =>
  asString(value).trim().toLowerCase() === 'hour' ? 'hour' : 'day';

export const normalizeBravoAnalyticsResponse = (value: unknown): BravoAnalyticsResponse => {
  const source = isRecord(value) ? value : {};
  const filters = isRecord(source.filters) ? source.filters : {};
  const retention = isRecord(source.retention) ? source.retention : {};
  const breakdown = isRecord(source.breakdown) ? source.breakdown : {};
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
          label: asString(entry.label).trim(),
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
});

const normalizeKeyIssueResponse = (value: unknown): BravoKeyIssueResponse => {
  const source = isRecord(value) ? value : {};
  return {
    project: normalizeProject(source.project),
    plaintextKey: asString(source.plaintext_key ?? source.plaintextKey ?? source.key).trim(),
  };
};

export const serializeBravoProject = (input: BravoProjectInput) => ({
  ...(input.id ? { id: input.id } : {}),
  name: input.name.trim(),
  enabled: input.enabled ?? true,
  models: input.models,
  allowed_auth_ids: input.allowedAuthIds ?? [],
  primary_auth_ids: input.primaryAuthIds ?? [],
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
    return normalizeKeyIssueResponse(
      await apiClient.post('/bravo/projects', serializeBravoProject(input))
    );
  },

  async updateProject(input: BravoProjectInput): Promise<BravoProject> {
    const value = await apiClient.patch('/bravo/projects', serializeBravoProject(input));
    const source = isRecord(value) && 'project' in value ? value.project : value;
    return normalizeProject(source);
  },

  async rotateProjectKey(id: string): Promise<BravoKeyIssueResponse> {
    return normalizeKeyIssueResponse(await apiClient.post('/bravo/projects/rotate', { id }));
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

  async getRoutes(): Promise<BravoRoutesResponse> {
    return normalizeBravoRoutesResponse(await apiClient.get('/bravo/routes'));
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
