import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { SelectionCheckbox } from '@/components/ui/SelectionCheckbox';
import { Select } from '@/components/ui/Select';
import { Sheet } from '@/components/ui/Sheet';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import {
  IconAlertTriangle,
  IconCheckCircle2,
  IconCopy,
  IconExternalLink,
  IconKey,
  IconPencil,
  IconPlus,
  IconRefreshCw,
  IconRotateCw,
  IconSearch,
  IconTrash2,
} from '@/components/ui/icons';
import { useHeaderRefresh } from '@/hooks/useHeaderRefresh';
import {
  bravoApi,
  type BravoAnthropicCacheTTL,
  type BravoProject,
  type BravoProjectsResponse,
  type BravoQuotaWindow,
  type BravoSubscription,
  type BravoTariff,
} from '@/services/api';
import { useAuthStore, useNotificationStore } from '@/stores';
import { copyToClipboard } from '@/utils/clipboard';
import { getErrorMessage } from '@/utils/helpers';
import { formatBravoQuotaReset } from './bravoQuotaPresentation';
import { BravoCompatibilityPanel } from './BravoCompatibilityPanel';
import { BravoProjectAnalytics } from './BravoProjectAnalytics';
import { BravoRouteEditor } from './BravoRouteEditor';
import { bravoProviderLabel, formatBravoSubscriptionRecord } from './bravoSubscriptionPresentation';
import styles from './BravoAdminPage.module.scss';

type EditorState = { mode: 'create'; project: null } | { mode: 'edit'; project: BravoProject };

interface ProjectDraft {
  name: string;
  enabled: boolean;
  allModels: boolean;
  selectedModels: string[];
  allSubscriptions: boolean;
  allowedAuthIds: string[];
  primaryAuthIds: string[];
  anthropicCacheTtl: BravoAnthropicCacheTTL;
}

interface IssuedKey {
  projectName: string;
  plaintext: string;
}

interface TariffDraft {
  sessionFloor: string;
  weeklyFloor: string;
}

interface PrimaryGroup {
  id: string;
  label: string;
  subscriptions: BravoSubscription[];
}

interface BravoAdminPageProps {
  dashboardURL?: string;
}

const emptyData = (): BravoProjectsResponse => ({
  projects: [],
  models: [],
  subscriptions: [],
  tariffs: [],
});

const emptyDraft = (): ProjectDraft => ({
  name: '',
  enabled: true,
  allModels: true,
  selectedModels: [],
  allSubscriptions: true,
  allowedAuthIds: [],
  primaryAuthIds: [],
  anthropicCacheTtl: '5m',
});

const shellQuote = (value: string): string => `'${value.replace(/'/g, `'"'"'`)}'`;

const draftFromProject = (project: BravoProject): ProjectDraft => {
  const allModels = project.models.length === 0 || project.models.includes('*');
  const allSubscriptions = project.allowedAuthIds.length === 0;
  return {
    name: project.name,
    enabled: project.enabled,
    allModels,
    selectedModels: allModels ? [] : [...project.models],
    allSubscriptions,
    allowedAuthIds: [...project.allowedAuthIds],
    primaryAuthIds: [...project.primaryAuthIds],
    anthropicCacheTtl: project.promptCache.anthropicTtl,
  };
};

const subscriptionReference = (subscription: BravoSubscription): string =>
  subscription.authIndex || subscription.authId;

const clampPercent = (value: number): number => Math.max(0, Math.min(100, value));

const compactNumber = (value: number, locale: string): string =>
  new Intl.NumberFormat(locale, {
    notation: value >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);

const formatAge = (value: string, t: TFunction): string => {
  if (!value) return '';
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return t('bravo.quota.age_now');
  if (minutes < 60) return t('bravo.quota.age_minutes', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return t('bravo.quota.age_hours', { count: hours });
  return t('bravo.quota.age_days', { count: Math.floor(hours / 24) });
};

const quotaReason = (window: BravoQuotaWindow, t: TFunction): string => {
  if (window.eligible === true) return t('bravo.quota.eligible');
  if (window.eligible === null) return t('bravo.quota.eligibility_unknown');
  if (!window.reason) return t('bravo.quota.protected_by_floor');
  return t(`bravo.quota.reasons.${window.reason}`, {
    defaultValue: window.reason.replace(/_/g, ' '),
  });
};

interface QuotaMeterProps {
  label: string;
  window: BravoQuotaWindow;
  confirmed: boolean;
  floor: number | null;
  locale: string;
  t: TFunction;
}

function QuotaMeter({ label, window, confirmed, floor, locale, t }: QuotaMeterProps) {
  const known = confirmed && window.remainingPercent !== null;
  const remaining = known ? clampPercent(window.remainingPercent as number) : null;
  const resetText = formatBravoQuotaReset(window, locale, {
    scheduled: (time) => t('bravo.quota.reset', { time }),
    inactive: t('bravo.quota.reset_inactive'),
    notApplicable: t('bravo.quota.reset_not_applicable'),
    unknown: t('bravo.quota.reset_unknown'),
  });
  const reason = quotaReason(window, t);
  return (
    <div className={styles.quotaMeter}>
      <div className={styles.quotaMeterHeading}>
        <span>{label}</span>
        <strong>
          {remaining === null
            ? t('bravo.quota.unknown')
            : t('bravo.quota.remaining', { percent: Math.round(remaining) })}
        </strong>
      </div>
      <div
        className={`${styles.quotaTrack} ${remaining === null ? styles.quotaTrackUnknown : ''}`}
        role="img"
        aria-label={
          remaining === null
            ? `${label}: ${t('bravo.quota.unknown')}`
            : `${label}: ${t('bravo.quota.remaining', { percent: Math.round(remaining) })}`
        }
      >
        {remaining !== null ? (
          <span className={styles.quotaFill} style={{ width: `${remaining}%` }} />
        ) : null}
        {floor !== null ? (
          <span
            className={styles.floorMarker}
            style={{ left: `${clampPercent(floor)}%` }}
            title={t('bravo.quota.floor', { percent: floor })}
          />
        ) : null}
      </div>
      <div className={styles.quotaMeta}>
        <span className={window.eligible === false ? styles.protectedText : ''}>{reason}</span>
        <span>{resetText}</span>
      </div>
    </div>
  );
}

export function BravoAdminPage({ dashboardURL = '' }: BravoAdminPageProps) {
  const { t, i18n } = useTranslation();
  const connectionStatus = useAuthStore((state) => state.connectionStatus);
  const apiBase = useAuthStore((state) => state.apiBase);
  const showNotification = useNotificationStore((state) => state.showNotification);
  const showConfirmation = useNotificationStore((state) => state.showConfirmation);

  const [data, setData] = useState<BravoProjectsResponse>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quotaRefreshing, setQuotaRefreshing] = useState(false);
  const [quotaError, setQuotaError] = useState('');
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [draft, setDraft] = useState<ProjectDraft>(emptyDraft);
  const [modelFilter, setModelFilter] = useState('');
  const [allowedFilter, setAllowedFilter] = useState('');
  const [primaryFilter, setPrimaryFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [mutatingID, setMutatingID] = useState('');
  const [mutatingSubscription, setMutatingSubscription] = useState('');
  const [mutatingTariff, setMutatingTariff] = useState('');
  const [tariffDrafts, setTariffDrafts] = useState<Record<string, TariffDraft>>({});
  const [issuedKey, setIssuedKey] = useState<IssuedKey | null>(null);

  const connected = connectionStatus === 'connected';
  const locale = i18n.resolvedLanguage || i18n.language || 'en';
  const serverBase = apiBase.replace(/\/+$/, '');

  const claudeSetup = useMemo(() => {
    if (!issuedKey) return '';
    return [
      `export ANTHROPIC_BASE_URL=${shellQuote(serverBase)}`,
      `export ANTHROPIC_AUTH_TOKEN=${shellQuote(issuedKey.plaintext)}`,
      `export ANTHROPIC_DEFAULT_OPUS_MODEL='bravo/opus'`,
      `export ANTHROPIC_DEFAULT_SONNET_MODEL='bravo/sonnet'`,
      `export ANTHROPIC_DEFAULT_HAIKU_MODEL='bravo/haiku'`,
      `claude --model opus --effort xhigh`,
    ].join('\n');
  }, [issuedKey, serverBase]);

  const openAISetup = useMemo(() => {
    if (!issuedKey) return '';
    return [
      `export OPENAI_BASE_URL=${shellQuote(`${serverBase}/v1`)}`,
      `export OPENAI_API_KEY=${shellQuote(issuedKey.plaintext)}`,
      `curl "$OPENAI_BASE_URL/responses" \\`,
      `  -H "Authorization: Bearer $OPENAI_API_KEY" \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -d '{"model":"bravo/sol","input":"Hello"}'`,
    ].join('\n');
  }, [issuedKey, serverBase]);

  const loadOverview = useCallback(async () => {
    if (!connected) {
      setLoading(false);
      setError(t('notification.connection_required'));
      return;
    }

    setLoading(true);
    setError('');
    try {
      setData(await bravoApi.listOverview());
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('bravo.projects.load_failed')));
    } finally {
      setLoading(false);
    }
  }, [connected, t]);

  useHeaderRefresh(loadOverview, connected);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    setTariffDrafts(
      Object.fromEntries(
        data.tariffs.map((tariff) => [
          tariff.id,
          {
            sessionFloor: String(tariff.sessionFloorPercent),
            weeklyFloor: String(tariff.weeklyFloorPercent),
          },
        ])
      )
    );
  }, [data.tariffs]);

  const activeCount = useMemo(
    () => data.projects.filter((project) => project.enabled).length,
    [data.projects]
  );

  const connectedSubscriptions = useMemo(
    () => data.subscriptions.filter((subscription) => subscription.enabled).length,
    [data.subscriptions]
  );

  const quotaSummary = useMemo(() => {
    let protectedCount = 0;
    let unknownCount = 0;
    data.subscriptions.forEach((subscription) => {
      if (
        subscription.quota.confidence !== 'confirmed' ||
        subscription.quota.session.remainingPercent === null ||
        subscription.quota.weekly.remainingPercent === null
      ) {
        unknownCount += 1;
      } else if (
        subscription.quota.session.eligible === false ||
        subscription.quota.weekly.eligible === false
      ) {
        protectedCount += 1;
      }
    });
    return { protectedCount, unknownCount };
  }, [data.subscriptions]);

  const tariffByID = useMemo(
    () => new Map(data.tariffs.map((tariff) => [tariff.id, tariff])),
    [data.tariffs]
  );

  const subscriptionByReference = useMemo(() => {
    const result = new Map<string, BravoSubscription>();
    data.subscriptions.forEach((subscription) => {
      result.set(subscription.authIndex, subscription);
      if (subscription.authId) result.set(subscription.authId, subscription);
    });
    return result;
  }, [data.subscriptions]);

  const projectByID = useMemo(
    () => new Map(data.projects.map((project) => [project.id, project])),
    [data.projects]
  );

  const visibleModels = useMemo(() => {
    const query = modelFilter.trim().toLowerCase();
    if (!query) return data.models;
    return data.models.filter((model) =>
      [model.id, model.requestModel, model.displayName, model.description].some((value) =>
        value.toLowerCase().includes(query)
      )
    );
  }, [data.models, modelFilter]);

  const allowedGroups = useMemo<PrimaryGroup[]>(() => {
    const query = allowedFilter.trim().toLowerCase();
    const groups = new Map<string, PrimaryGroup>();
    data.subscriptions.forEach((subscription) => {
      const identity = formatBravoSubscriptionRecord(subscription);
      if (query && !identity.searchText.includes(query)) return;
      const id = subscription.provider || 'unknown';
      const group = groups.get(id) ?? {
        id,
        label: bravoProviderLabel(subscription.provider),
        subscriptions: [],
      };
      group.subscriptions.push(subscription);
      groups.set(id, group);
    });
    return [...groups.values()]
      .map((group) => ({
        ...group,
        subscriptions: [...group.subscriptions].sort((left, right) =>
          formatBravoSubscriptionRecord(left).title.localeCompare(
            formatBravoSubscriptionRecord(right).title
          )
        ),
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [allowedFilter, data.subscriptions]);

  const primaryGroups = useMemo<PrimaryGroup[]>(() => {
    const query = primaryFilter.trim().toLowerCase();
    const groups = new Map<string, PrimaryGroup>();
    data.subscriptions.forEach((subscription) => {
      const reference = subscriptionReference(subscription);
      if (!draft.allSubscriptions && !draft.allowedAuthIds.includes(reference)) return;
      const identity = formatBravoSubscriptionRecord(subscription);
      if (query && !identity.searchText.includes(query)) return;
      const id = subscription.provider || 'unknown';
      const group = groups.get(id) ?? {
        id,
        label: bravoProviderLabel(subscription.provider),
        subscriptions: [],
      };
      group.subscriptions.push(subscription);
      groups.set(id, group);
    });
    return [...groups.values()]
      .map((group) => ({
        ...group,
        subscriptions: [...group.subscriptions].sort((left, right) =>
          formatBravoSubscriptionRecord(left).title.localeCompare(
            formatBravoSubscriptionRecord(right).title
          )
        ),
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [data.subscriptions, draft.allSubscriptions, draft.allowedAuthIds, primaryFilter]);

  const openCreate = () => {
    setDraft(emptyDraft());
    setModelFilter('');
    setAllowedFilter('');
    setPrimaryFilter('');
    setEditor({ mode: 'create', project: null });
  };

  const openEdit = (project: BravoProject) => {
    setDraft(draftFromProject(project));
    setModelFilter('');
    setAllowedFilter('');
    setPrimaryFilter('');
    setEditor({ mode: 'edit', project });
  };

  const closeEditor = () => {
    if (saving) return;
    setEditor(null);
    setDraft(emptyDraft());
    setModelFilter('');
    setAllowedFilter('');
    setPrimaryFilter('');
  };

  const toggleModel = (model: string, checked: boolean) => {
    setDraft((current) => ({
      ...current,
      selectedModels: checked
        ? [...new Set([...current.selectedModels, model])]
        : current.selectedModels.filter((item) => item !== model),
    }));
  };

  const setAllSubscriptions = (allSubscriptions: boolean) => {
    setDraft((current) => ({
      ...current,
      allSubscriptions,
      allowedAuthIds: allSubscriptions ? [] : data.subscriptions.map(subscriptionReference),
    }));
  };

  const toggleAllowed = (reference: string, checked: boolean) => {
    setDraft((current) => ({
      ...current,
      allowedAuthIds: checked
        ? [...new Set([...current.allowedAuthIds, reference])]
        : current.allowedAuthIds.filter((item) => item !== reference),
      primaryAuthIds: checked
        ? current.primaryAuthIds
        : current.primaryAuthIds.filter((item) => item !== reference),
    }));
  };

  const togglePrimary = (reference: string, checked: boolean) => {
    setDraft((current) => ({
      ...current,
      primaryAuthIds: checked
        ? [...new Set([...current.primaryAuthIds, reference])]
        : current.primaryAuthIds.filter((item) => item !== reference),
    }));
  };

  const subscriptionOwnerIDs = (subscription: BravoSubscription): string[] => {
    const reference = subscriptionReference(subscription);
    const inferred = data.projects
      .filter((project) => project.primaryAuthIds.includes(reference))
      .map((project) => project.id);
    return [...new Set([...subscription.primaryProjectIds, ...inferred])];
  };

  const saveProject = async () => {
    if (!editor) return;
    const name = draft.name.trim();
    if (!name) {
      showNotification(t('bravo.projects.validation.name'), 'warning');
      return;
    }
    if (!draft.allModels && draft.selectedModels.length === 0) {
      showNotification(t('bravo.projects.validation.models'), 'warning');
      return;
    }
    if (!draft.allSubscriptions && draft.allowedAuthIds.length === 0) {
      showNotification(t('bravo.projects.validation.subscriptions'), 'warning');
      return;
    }
    if (
      !draft.allSubscriptions &&
      draft.primaryAuthIds.some((reference) => !draft.allowedAuthIds.includes(reference))
    ) {
      showNotification(t('bravo.projects.validation.primary_subset'), 'warning');
      return;
    }

    setSaving(true);
    try {
      const input = {
        id: editor.project?.id,
        name,
        enabled: draft.enabled,
        models: draft.allModels ? ['*'] : draft.selectedModels,
        allowedAuthIds: draft.allSubscriptions ? [] : draft.allowedAuthIds,
        primaryAuthIds: draft.primaryAuthIds,
        promptCache: {
          anthropicTtl: draft.anthropicCacheTtl,
        },
      };
      if (editor.mode === 'create') {
        const result = await bravoApi.createProject(input);
        if (!result.plaintextKey) throw new Error(t('bravo.projects.key_missing'));
        setIssuedKey({ projectName: result.project.name || name, plaintext: result.plaintextKey });
        showNotification(t('bravo.projects.created'), 'success');
      } else {
        await bravoApi.updateProject(input);
        showNotification(t('bravo.projects.updated'), 'success');
      }
      setEditor(null);
      await loadOverview();
    } catch (err: unknown) {
      showNotification(getErrorMessage(err, t('bravo.projects.save_failed')), 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateEnabled = async (project: BravoProject, enabled: boolean) => {
    setMutatingID(project.id);
    try {
      await bravoApi.updateProject({
        id: project.id,
        name: project.name,
        enabled,
        models: project.models,
        allowedAuthIds: project.allowedAuthIds,
        primaryAuthIds: project.primaryAuthIds,
        promptCache: {
          anthropicTtl: project.promptCache.anthropicTtl,
        },
      });
      await loadOverview();
      showNotification(
        enabled ? t('bravo.projects.enabled') : t('bravo.projects.disabled'),
        'success'
      );
    } catch (err: unknown) {
      showNotification(getErrorMessage(err, t('bravo.projects.save_failed')), 'error');
    } finally {
      setMutatingID('');
    }
  };

  const rotateKey = (project: BravoProject) => {
    showConfirmation({
      title: t('bravo.projects.rotate_title'),
      message: t('bravo.projects.rotate_confirm', { name: project.name }),
      confirmText: t('bravo.projects.rotate'),
      variant: 'primary',
      onConfirm: async () => {
        setMutatingID(project.id);
        try {
          const result = await bravoApi.rotateProjectKey(project.id);
          if (!result.plaintextKey) throw new Error(t('bravo.projects.key_missing'));
          setIssuedKey({
            projectName: result.project.name || project.name,
            plaintext: result.plaintextKey,
          });
          await loadOverview();
        } catch (err: unknown) {
          showNotification(getErrorMessage(err, t('bravo.projects.rotate_failed')), 'error');
        } finally {
          setMutatingID('');
        }
      },
    });
  };

  const deleteProject = (project: BravoProject) => {
    showConfirmation({
      title: t('bravo.projects.delete_title'),
      message: t('bravo.projects.delete_confirm', { name: project.name }),
      confirmText: t('common.delete'),
      variant: 'danger',
      onConfirm: async () => {
        setMutatingID(project.id);
        try {
          await bravoApi.deleteProject(project.id);
          await loadOverview();
          showNotification(t('bravo.projects.deleted'), 'success');
        } catch (err: unknown) {
          showNotification(getErrorMessage(err, t('bravo.projects.delete_failed')), 'error');
        } finally {
          setMutatingID('');
        }
      },
    });
  };

  const refreshQuotas = async () => {
    setQuotaRefreshing(true);
    setQuotaError('');
    try {
      await bravoApi.refreshQuotas();
      await loadOverview();
      showNotification(t('bravo.quota.refresh_success'), 'success');
    } catch (err: unknown) {
      setQuotaError(getErrorMessage(err, t('bravo.quota.refresh_failed')));
    } finally {
      setQuotaRefreshing(false);
    }
  };

  const updateSubscription = async (
    subscription: BravoSubscription,
    patch: { tariff?: string; enabled?: boolean }
  ) => {
    setMutatingSubscription(subscription.authIndex);
    try {
      await bravoApi.updateSubscription({
        authIndex: subscription.authIndex,
        tariff: patch.tariff ?? subscription.tariff,
        enabled: patch.enabled ?? subscription.enabled,
      });
      await loadOverview();
      showNotification(t('bravo.subscriptions.updated'), 'success');
    } catch (err: unknown) {
      showNotification(getErrorMessage(err, t('bravo.subscriptions.update_failed')), 'error');
    } finally {
      setMutatingSubscription('');
    }
  };

  const saveTariff = async (tariff: BravoTariff) => {
    const draftValue = tariffDrafts[tariff.id];
    const sessionFloor = Number(draftValue?.sessionFloor);
    const weeklyFloor = Number(draftValue?.weeklyFloor);
    if (
      !Number.isFinite(sessionFloor) ||
      !Number.isFinite(weeklyFloor) ||
      sessionFloor < 0 ||
      sessionFloor >= 100 ||
      weeklyFloor < 0 ||
      weeklyFloor >= 100
    ) {
      showNotification(t('bravo.tariffs.validation'), 'warning');
      return;
    }
    setMutatingTariff(tariff.id);
    try {
      await bravoApi.updateTariff({
        ...tariff,
        sessionFloorPercent: sessionFloor,
        weeklyFloorPercent: weeklyFloor,
      });
      await loadOverview();
      showNotification(t('bravo.tariffs.updated'), 'success');
    } catch (err: unknown) {
      showNotification(getErrorMessage(err, t('bravo.tariffs.update_failed')), 'error');
    } finally {
      setMutatingTariff('');
    }
  };

  const copyText = async (value: string, successKey: string) => {
    const copied = await copyToClipboard(value);
    showNotification(
      copied ? t(successKey) : t('bravo.key.copy_failed'),
      copied ? 'success' : 'error'
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Bravo</div>
          <h1>{t('bravo.title')}</h1>
          <p>{t('bravo.description')}</p>
        </div>
        <div className={styles.headerActions}>
          {dashboardURL ? (
            <Button
              variant="ghost"
              onClick={() => window.open(dashboardURL, '_blank', 'noopener,noreferrer')}
            >
              <IconExternalLink size={17} />
              {t('bravo.diagnostics')}
            </Button>
          ) : null}
          <Button
            variant="secondary"
            onClick={() => void loadOverview()}
            disabled={loading}
            aria-label={t('common.refresh')}
          >
            <IconRefreshCw size={17} />
            {t('common.refresh')}
          </Button>
          <Button onClick={openCreate} disabled={!connected}>
            <IconPlus size={17} />
            {t('bravo.projects.create')}
          </Button>
        </div>
      </div>

      <div className={styles.stats} aria-label={t('bravo.summary')}>
        <div className={styles.stat}>
          <span>{t('bravo.projects.total')}</span>
          <strong>{data.projects.length}</strong>
        </div>
        <div className={styles.stat}>
          <span>{t('bravo.projects.active')}</span>
          <strong>{activeCount}</strong>
        </div>
        <div className={styles.stat}>
          <span>{t('bravo.subscriptions.connected')}</span>
          <strong>{connectedSubscriptions}</strong>
        </div>
        <div className={styles.stat}>
          <span>{t('bravo.quota.protected_unknown')}</span>
          <strong>
            {quotaSummary.protectedCount} / {quotaSummary.unknownCount}
          </strong>
        </div>
      </div>

      <div className={styles.effortNote}>
        <strong>{t('bravo.effort.title')}</strong>
        <span>{t('bravo.effort.description')}</span>
        <code>/effort xhigh</code>
      </div>

      <BravoCompatibilityPanel />

      {error ? (
        <div className={styles.error} role="alert">
          {error}
        </div>
      ) : null}
      {quotaError ? (
        <div className={styles.error} role="alert">
          {quotaError}
        </div>
      ) : null}

      <details className={styles.sectionDisclosure}>
        <summary>
          <span className={styles.sectionTitle}>{t('bravo.subscriptions.pool')}</span>
          <span className={styles.sectionMeta}>
            {t('bravo.subscriptions.count', { count: data.subscriptions.length })}
          </span>
          <span className={styles.chevron} aria-hidden="true">
            ›
          </span>
        </summary>
        <div className={styles.sectionBody}>
          <div className={styles.poolToolbar}>
            <div>
              <strong>{t('bravo.subscriptions.pool_title')}</strong>
              <span>{t('bravo.subscriptions.pool_hint')}</span>
            </div>
            <Button
              variant="secondary"
              onClick={() => void refreshQuotas()}
              loading={quotaRefreshing}
              disabled={!connected}
            >
              <IconRefreshCw size={17} />
              {t('bravo.quota.refresh')}
            </Button>
          </div>
          <div className={styles.liveRegion} role="status" aria-live="polite">
            {quotaRefreshing ? t('bravo.quota.refreshing') : ''}
          </div>

          {data.subscriptions.length === 0 ? (
            <div className={styles.inlineEmpty}>{t('bravo.subscriptions.empty')}</div>
          ) : (
            <div className={styles.subscriptionList}>
              {data.subscriptions.map((subscription) => {
                const tariff =
                  tariffByID.get(subscription.effectiveTariff) ??
                  tariffByID.get(subscription.tariff);
                const confirmed = subscription.quota.confidence === 'confirmed';
                const age = formatAge(subscription.quota.observedAt, t);
                const owners = subscriptionOwnerIDs(subscription)
                  .map((id) => projectByID.get(id)?.name)
                  .filter((name): name is string => Boolean(name));
                const busy = mutatingSubscription === subscription.authIndex;
                const identity = formatBravoSubscriptionRecord(subscription);
                return (
                  <details className={styles.subscription} key={subscription.authIndex}>
                    <summary>
                      <span className={styles.subscriptionIdentity}>
                        <strong title={identity.title}>{identity.title}</strong>
                        <span title={identity.subtitle}>
                          {identity.subtitle || t('bravo.subscriptions.details_unknown')}
                        </span>
                      </span>
                      <span className={styles.subscriptionBadges}>
                        <span className={styles.tariffBadge}>
                          {subscription.effectiveTariff || subscription.tariff}
                        </span>
                        <span
                          className={`${styles.healthBadge} ${
                            subscription.health === 'ready' ? styles.healthReady : ''
                          }`}
                        >
                          {t(`bravo.subscriptions.health.${subscription.health}`, {
                            defaultValue: subscription.health,
                          })}
                        </span>
                      </span>
                      <span className={styles.ownerSummary}>
                        {owners.length
                          ? t('bravo.subscriptions.owned_by', { names: owners.join(', ') })
                          : t('bravo.subscriptions.shared')}
                      </span>
                      <span className={styles.compactQuotas}>
                        <span>
                          {t('bravo.quota.session_short')}:{' '}
                          {confirmed && subscription.quota.session.remainingPercent !== null
                            ? `${Math.round(subscription.quota.session.remainingPercent)}%`
                            : t('bravo.quota.unknown')}
                        </span>
                        <span>
                          {t('bravo.quota.weekly_short')}:{' '}
                          {confirmed && subscription.quota.weekly.remainingPercent !== null
                            ? `${Math.round(subscription.quota.weekly.remainingPercent)}%`
                            : t('bravo.quota.unknown')}
                        </span>
                      </span>
                      <span className={styles.chevron} aria-hidden="true">
                        ›
                      </span>
                    </summary>
                    <div className={styles.subscriptionBody}>
                      <div className={styles.confirmationRow}>
                        <span className={confirmed ? styles.confirmedBadge : styles.unknownBadge}>
                          {confirmed ? (
                            <IconCheckCircle2 size={15} />
                          ) : (
                            <IconAlertTriangle size={15} />
                          )}
                          {confirmed
                            ? t('bravo.quota.confirmed_age', {
                                age: age || t('bravo.quota.age_unknown'),
                              })
                            : t('bravo.quota.not_confirmed')}
                        </span>
                        {subscription.quota.error ? (
                          <span className={styles.quotaErrorText}>{subscription.quota.error}</span>
                        ) : null}
                      </div>

                      <div className={styles.quotaGrid}>
                        <QuotaMeter
                          label={t('bravo.quota.session')}
                          window={subscription.quota.session}
                          confirmed={confirmed}
                          floor={tariff?.sessionFloorPercent ?? null}
                          locale={locale}
                          t={t}
                        />
                        <QuotaMeter
                          label={t('bravo.quota.weekly')}
                          window={subscription.quota.weekly}
                          confirmed={confirmed}
                          floor={tariff?.weeklyFloorPercent ?? null}
                          locale={locale}
                          t={t}
                        />
                      </div>

                      <div className={styles.accountControls}>
                        <div className={styles.controlIntro}>
                          <strong>{t('bravo.subscriptions.account_policy')}</strong>
                          <span>{t('bravo.subscriptions.account_policy_hint')}</span>
                        </div>
                        <div className={styles.controlGrid}>
                          <div>
                            <label id={`tariff-${subscription.authIndex}`}>
                              {t('bravo.subscriptions.tariff')}
                            </label>
                            <Select
                              value={subscription.tariff}
                              options={[
                                { value: 'auto', label: t('bravo.subscriptions.tariff_auto') },
                                ...data.tariffs.map((item) => ({
                                  value: item.id,
                                  label: `${item.id} · ×${item.multiplier}`,
                                })),
                              ]}
                              onChange={(tariffID) =>
                                void updateSubscription(subscription, { tariff: tariffID })
                              }
                              ariaLabelledBy={`tariff-${subscription.authIndex}`}
                              disabled={busy}
                            />
                          </div>
                          <ToggleSwitch
                            checked={subscription.enabled}
                            onChange={(enabled) =>
                              void updateSubscription(subscription, { enabled })
                            }
                            label={t('bravo.subscriptions.enabled')}
                            disabled={busy}
                          />
                        </div>
                      </div>

                      <details className={styles.technicalDetails}>
                        <summary>
                          <span>{t('bravo.technical_details')}</span>
                          <span className={styles.chevron} aria-hidden="true">
                            ›
                          </span>
                        </summary>
                        <dl>
                          <div>
                            <dt>auth_index</dt>
                            <dd>{subscription.authIndex}</dd>
                          </div>
                          <div>
                            <dt>auth_id</dt>
                            <dd>{subscription.authId || '—'}</dd>
                          </div>
                          <div>
                            <dt>{t('bravo.usage.session')}</dt>
                            <dd>{compactNumber(subscription.usage.session.totalTokens, locale)}</dd>
                          </div>
                          <div>
                            <dt>{t('bravo.usage.weekly')}</dt>
                            <dd>{compactNumber(subscription.usage.weekly.totalTokens, locale)}</dd>
                          </div>
                        </dl>
                      </details>
                    </div>
                  </details>
                );
              })}
            </div>
          )}

          <details className={styles.tariffPolicy}>
            <summary>
              <span>{t('bravo.tariffs.title')}</span>
              <span className={styles.sectionMeta}>{t('bravo.tariffs.advanced')}</span>
              <span className={styles.chevron} aria-hidden="true">
                ›
              </span>
            </summary>
            <div className={styles.tariffBody}>
              <div className={styles.policyExplanation}>
                <strong>{t('bravo.tariffs.how_it_works')}</strong>
                <span>{t('bravo.tariffs.explanation')}</span>
              </div>
              <div className={styles.tariffGrid}>
                {data.tariffs.map((tariff) => (
                  <div className={styles.tariffCard} key={tariff.id}>
                    <div className={styles.tariffHeading}>
                      <strong>{tariff.id}</strong>
                      <span>×{tariff.multiplier}</span>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={99}
                      step={1}
                      label={t('bravo.tariffs.session_floor')}
                      value={tariffDrafts[tariff.id]?.sessionFloor ?? ''}
                      onChange={(event) =>
                        setTariffDrafts((current) => ({
                          ...current,
                          [tariff.id]: {
                            sessionFloor: event.target.value,
                            weeklyFloor: current[tariff.id]?.weeklyFloor ?? '',
                          },
                        }))
                      }
                      disabled={mutatingTariff === tariff.id}
                    />
                    <Input
                      type="number"
                      min={0}
                      max={99}
                      step={1}
                      label={t('bravo.tariffs.weekly_floor')}
                      value={tariffDrafts[tariff.id]?.weeklyFloor ?? ''}
                      onChange={(event) =>
                        setTariffDrafts((current) => ({
                          ...current,
                          [tariff.id]: {
                            sessionFloor: current[tariff.id]?.sessionFloor ?? '',
                            weeklyFloor: event.target.value,
                          },
                        }))
                      }
                      disabled={mutatingTariff === tariff.id}
                    />
                    <span className={styles.reservationNote}>
                      {t('bravo.tariffs.reservation', {
                        percent: tariff.reservationPercent,
                      })}
                    </span>
                    <Button
                      variant="secondary"
                      onClick={() => void saveTariff(tariff)}
                      loading={mutatingTariff === tariff.id}
                    >
                      {t('common.save')}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </details>
        </div>
      </details>

      <BravoRouteEditor />

      <div className={styles.projectsHeading}>
        <div>
          <h2>{t('bravo.projects.list_title')}</h2>
          <span>{t('bravo.projects.list_hint')}</span>
        </div>
      </div>

      {loading && data.projects.length === 0 ? (
        <div className={styles.loading}>{t('common.loading')}</div>
      ) : data.projects.length === 0 ? (
        <EmptyState
          title={t('bravo.projects.empty_title')}
          description={t('bravo.projects.empty_description')}
          action={
            <Button onClick={openCreate}>
              <IconPlus size={17} />
              {t('bravo.projects.create')}
            </Button>
          }
        />
      ) : (
        <div className={styles.projects}>
          {data.projects.map((project) => {
            const busy = mutatingID === project.id;
            const revoked = project.status === 'revoked';
            const allModels = project.models.length === 0 || project.models.includes('*');
            const allSubscriptions = project.allowedAuthIds.length === 0;
            const allowedSubscriptionLabels = project.allowedAuthIds
              .map((reference) => {
                const subscription = subscriptionByReference.get(reference);
                return subscription
                  ? {
                      reference,
                      title: formatBravoSubscriptionRecord(subscription).title,
                    }
                  : null;
              })
              .filter((item): item is { reference: string; title: string } => Boolean(item));
            const primarySubscriptionLabels = project.primaryAuthIds
              .map((reference) => {
                const subscription = subscriptionByReference.get(reference);
                return subscription
                  ? {
                      reference,
                      title: formatBravoSubscriptionRecord(subscription).title,
                    }
                  : null;
              })
              .filter((item): item is { reference: string; title: string } => Boolean(item));
            const allowedLabels = allowedSubscriptionLabels.map((item) => item.title);
            const primaryLabels = primarySubscriptionLabels.map((item) => item.title);
            const allowedSummary = allSubscriptions
              ? t('bravo.subscriptions.card_pool_all')
              : t('bravo.subscriptions.card_pool_selected', {
                  names: allowedLabels.join(', ') || project.allowedAuthIds.join(', '),
                });
            return (
              <details className={styles.project} key={project.id}>
                <summary>
                  <span className={styles.projectIdentity}>
                    <span className={styles.projectName}>{project.name}</span>
                    <span className={styles.projectPrimary}>
                      {allowedSummary} ·{' '}
                      {primaryLabels.length
                        ? t('bravo.subscriptions.card_primary', {
                            names: primaryLabels.join(', '),
                          })
                        : t('bravo.subscriptions.shared_only')}
                    </span>
                  </span>
                  <span
                    className={
                      revoked
                        ? styles.revokedBadge
                        : project.enabled
                          ? styles.activeBadge
                          : styles.disabledBadge
                    }
                  >
                    {revoked
                      ? t('bravo.projects.status_revoked')
                      : project.enabled
                        ? t('bravo.projects.status_active')
                        : t('bravo.projects.status_disabled')}
                  </span>
                  <span className={styles.usageSummary}>
                    {t('bravo.usage.compact', {
                      session: compactNumber(project.usage.session.totalTokens, locale),
                      weekly: compactNumber(project.usage.weekly.totalTokens, locale),
                    })}
                  </span>
                  <span className={styles.chevron} aria-hidden="true">
                    ›
                  </span>
                </summary>
                <div className={styles.projectBody}>
                  <div className={styles.projectSection}>
                    <h3>{t('bravo.subscriptions.allowed_pool')}</h3>
                    {allSubscriptions ? (
                      <p>{t('bravo.subscriptions.all_allowed')}</p>
                    ) : allowedLabels.length ? (
                      <div className={styles.tags}>
                        {allowedSubscriptionLabels.map(({ reference, title }) => (
                          <span key={reference}>
                            <strong>{title}</strong>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p>{t('bravo.subscriptions.allowed_ids_unavailable')}</p>
                    )}
                  </div>
                  <div className={styles.projectSection}>
                    <h3>{t('bravo.subscriptions.primary')}</h3>
                    {primaryLabels.length ? (
                      <div className={styles.tags}>
                        {primarySubscriptionLabels.map(({ reference, title }) => (
                          <span key={reference}>
                            <strong>{title}</strong>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p>{t('bravo.subscriptions.not_assigned')}</p>
                    )}
                  </div>
                  <div className={styles.projectSection}>
                    <h3>{t('bravo.models.access')}</h3>
                    <p>
                      {allModels
                        ? t('bravo.models.all')
                        : t('bravo.models.count', { count: project.models.length })}
                    </p>
                  </div>
                  <div className={styles.projectSection}>
                    <h3>{t('bravo.prompt_cache.title')}</h3>
                    <p>
                      {t('bravo.prompt_cache.card_summary', {
                        claude: t(
                          `bravo.prompt_cache.anthropic_ttl_short.${project.promptCache.anthropicTtl}`
                        ),
                      })}
                    </p>
                  </div>
                  <BravoProjectAnalytics project={project} subscriptions={data.subscriptions} />
                  <details className={styles.technicalDetails}>
                    <summary>
                      <span>{t('bravo.technical_details')}</span>
                      <span className={styles.chevron} aria-hidden="true">
                        ›
                      </span>
                    </summary>
                    <dl>
                      <div>
                        <dt>project_id</dt>
                        <dd>{project.id}</dd>
                      </div>
                      <div>
                        <dt>allowed_auth_ids</dt>
                        <dd>{allSubscriptions ? '*' : project.allowedAuthIds.join(', ')}</dd>
                      </div>
                      <div>
                        <dt>primary_auth_ids</dt>
                        <dd>{project.primaryAuthIds.join(', ') || '—'}</dd>
                      </div>
                      <div>
                        <dt>{t('bravo.models.access')}</dt>
                        <dd>{allModels ? '*' : project.models.join(', ')}</dd>
                      </div>
                    </dl>
                  </details>
                  <div className={styles.projectActions}>
                    <ToggleSwitch
                      checked={project.enabled}
                      onChange={(enabled) => void updateEnabled(project, enabled)}
                      label={
                        revoked
                          ? t('bravo.projects.status_revoked')
                          : project.enabled
                            ? t('bravo.projects.enabled_label')
                            : t('bravo.projects.disabled_label')
                      }
                      disabled={busy || revoked}
                    />
                    <div className={styles.actionButtons}>
                      <Button variant="secondary" size="sm" onClick={() => openEdit(project)}>
                        <IconPencil size={15} />
                        {t('common.edit')}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => rotateKey(project)}
                        disabled={busy || revoked}
                      >
                        <IconRotateCw size={15} />
                        {t('bravo.projects.rotate')}
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => deleteProject(project)}
                        disabled={busy}
                      >
                        <IconTrash2 size={15} />
                        {t('common.delete')}
                      </Button>
                    </div>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}

      <Sheet
        open={Boolean(editor)}
        onClose={closeEditor}
        closeDisabled={saving}
        size="lg"
        eyebrow={
          editor?.mode === 'create'
            ? t('bravo.projects.create_eyebrow')
            : t('bravo.projects.edit_eyebrow')
        }
        title={
          editor?.mode === 'create'
            ? t('bravo.projects.create_title')
            : t('bravo.projects.edit_title')
        }
        description={t('bravo.projects.form_description')}
        footer={
          <>
            <Button variant="secondary" onClick={closeEditor} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => void saveProject()} loading={saving}>
              {editor?.mode === 'create' ? t('bravo.projects.issue_key') : t('common.save')}
            </Button>
          </>
        }
      >
        <div className={styles.form}>
          <Input
            label={t('bravo.projects.name')}
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            placeholder={t('bravo.projects.name_placeholder')}
            autoComplete="off"
            disabled={saving}
          />
          {editor?.mode === 'edit' ? (
            <ToggleSwitch
              checked={draft.enabled}
              onChange={(enabled) => setDraft((current) => ({ ...current, enabled }))}
              label={t('bravo.projects.enabled_label')}
              disabled={saving}
            />
          ) : null}

          <fieldset className={styles.primaryPicker}>
            <legend>{t('bravo.subscriptions.allowed_pool')}</legend>
            <p>{t('bravo.subscriptions.allowed_pool_hint')}</p>
            <SelectionCheckbox
              checked={draft.allSubscriptions}
              onChange={setAllSubscriptions}
              label={
                <span className={styles.checkboxDescription}>
                  <strong>{t('bravo.subscriptions.allow_all')}</strong>
                  <small>{t('bravo.subscriptions.allow_all_hint')}</small>
                </span>
              }
              disabled={saving}
            />
            {!draft.allSubscriptions ? (
              <>
                <Input
                  value={allowedFilter}
                  onChange={(event) => setAllowedFilter(event.target.value)}
                  placeholder={t('bravo.subscriptions.search')}
                  rightElement={<IconSearch size={16} />}
                  aria-label={t('bravo.subscriptions.search_allowed')}
                  disabled={saving}
                />
                <div className={styles.primaryList}>
                  {allowedGroups.map((group) => (
                    <section className={styles.primaryGroup} key={group.id}>
                      <h3>{group.label}</h3>
                      {group.subscriptions.map((subscription) => {
                        const reference = subscriptionReference(subscription);
                        const identity = formatBravoSubscriptionRecord(subscription);
                        return (
                          <SelectionCheckbox
                            key={subscription.authIndex}
                            checked={draft.allowedAuthIds.includes(reference)}
                            onChange={(checked) => toggleAllowed(reference, checked)}
                            disabled={saving}
                            label={
                              <span className={styles.primaryOption}>
                                <strong>{identity.title}</strong>
                                <span>{identity.subtitle}</span>
                              </span>
                            }
                          />
                        );
                      })}
                    </section>
                  ))}
                  {allowedGroups.length === 0 ? (
                    <div className={styles.noModels}>{t('bravo.subscriptions.not_found')}</div>
                  ) : null}
                </div>
              </>
            ) : null}
            <div className={styles.poolSafetyHint}>
              <IconAlertTriangle size={15} />
              <span>{t('bravo.subscriptions.allowed_fail_closed')}</span>
            </div>
            <div className={styles.sharedOnlyHint}>
              {draft.allSubscriptions
                ? t('bravo.subscriptions.all_allowed')
                : t('bravo.subscriptions.allowed_selected', {
                    count: draft.allowedAuthIds.length,
                  })}
            </div>
          </fieldset>

          <fieldset className={styles.primaryPicker}>
            <legend>{t('bravo.subscriptions.primary')}</legend>
            <p>{t('bravo.subscriptions.primary_hint')}</p>
            <Input
              value={primaryFilter}
              onChange={(event) => setPrimaryFilter(event.target.value)}
              placeholder={t('bravo.subscriptions.search')}
              rightElement={<IconSearch size={16} />}
              aria-label={t('bravo.subscriptions.search')}
              disabled={saving}
            />
            <div className={styles.primaryList}>
              {primaryGroups.map((group) => (
                <section className={styles.primaryGroup} key={group.id}>
                  <h3>{group.label}</h3>
                  {group.subscriptions.map((subscription) => {
                    const reference = subscriptionReference(subscription);
                    const identity = formatBravoSubscriptionRecord(subscription);
                    const otherOwnerIDs = subscriptionOwnerIDs(subscription).filter(
                      (id) => id !== editor?.project?.id
                    );
                    const otherOwners = otherOwnerIDs
                      .map((id) => projectByID.get(id)?.name)
                      .filter((name): name is string => Boolean(name));
                    const unavailable = otherOwnerIDs.length > 0;
                    return (
                      <SelectionCheckbox
                        key={subscription.authIndex}
                        checked={draft.primaryAuthIds.includes(reference)}
                        onChange={(checked) => togglePrimary(reference, checked)}
                        disabled={saving || unavailable}
                        title={
                          unavailable
                            ? t('bravo.subscriptions.already_owned', {
                                names:
                                  otherOwners.join(', ') ||
                                  t('bravo.subscriptions.another_project'),
                              })
                            : undefined
                        }
                        label={
                          <span className={styles.primaryOption}>
                            <strong>{identity.title}</strong>
                            <span>{identity.subtitle}</span>
                            {unavailable ? (
                              <small>
                                {t('bravo.subscriptions.already_owned', {
                                  names:
                                    otherOwners.join(', ') ||
                                    t('bravo.subscriptions.another_project'),
                                })}
                              </small>
                            ) : null}
                          </span>
                        }
                      />
                    );
                  })}
                </section>
              ))}
              {primaryGroups.length === 0 ? (
                <div className={styles.noModels}>{t('bravo.subscriptions.not_found')}</div>
              ) : null}
            </div>
            <div className={styles.sharedOnlyHint}>
              {draft.primaryAuthIds.length === 0
                ? t('bravo.subscriptions.no_primary_selected')
                : t('bravo.subscriptions.selected', { count: draft.primaryAuthIds.length })}
            </div>
          </fieldset>

          <details className={styles.editorDisclosure}>
            <summary>
              <span>{t('bravo.models.access')}</span>
              <span className={styles.sectionMeta}>
                {draft.allModels
                  ? t('bravo.models.all')
                  : t('bravo.models.count', { count: draft.selectedModels.length })}
              </span>
              <span className={styles.chevron} aria-hidden="true">
                ›
              </span>
            </summary>
            <div className={styles.editorDisclosureBody}>
              <SelectionCheckbox
                checked={draft.allModels}
                onChange={(allModels) => setDraft((current) => ({ ...current, allModels }))}
                label={
                  <span className={styles.checkboxDescription}>
                    <strong>{t('bravo.models.all')}</strong>
                    <small>{t('bravo.models.all_hint')}</small>
                  </span>
                }
                disabled={saving}
              />
              {!draft.allModels ? (
                <div className={styles.modelSelection}>
                  <Input
                    value={modelFilter}
                    onChange={(event) => setModelFilter(event.target.value)}
                    placeholder={t('bravo.models.search')}
                    rightElement={<IconSearch size={16} />}
                    aria-label={t('bravo.models.search')}
                  />
                  <div className={styles.modelList} data-testid="bravo-model-list">
                    {visibleModels.map((model) => (
                      <SelectionCheckbox
                        key={model.id}
                        checked={draft.selectedModels.includes(model.id)}
                        onChange={(checked) => toggleModel(model.id, checked)}
                        className={styles.modelListItem}
                        labelClassName={styles.modelListItemLabel}
                        label={
                          <span className={styles.modelOption}>
                            <strong>{model.displayName}</strong>
                            <code>{model.requestModel}</code>
                            {model.description ? <small>{model.description}</small> : null}
                          </span>
                        }
                        disabled={saving}
                      />
                    ))}
                    {visibleModels.length === 0 ? (
                      <div className={styles.noModels}>{t('bravo.models.not_found')}</div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </details>

          <details className={styles.editorDisclosure}>
            <summary>
              <span>{t('bravo.prompt_cache.title')}</span>
              <span className={styles.sectionMeta}>
                {t(`bravo.prompt_cache.anthropic_ttl_short.${draft.anthropicCacheTtl}`)}
              </span>
              <span className={styles.chevron} aria-hidden="true">
                ›
              </span>
            </summary>
            <div className={styles.editorDisclosureBody}>
              <div className={styles.cacheControl}>
                <label id="bravo-anthropic-cache-ttl">
                  {t('bravo.prompt_cache.anthropic_ttl')}
                </label>
                <Select
                  value={draft.anthropicCacheTtl}
                  options={[
                    {
                      value: '5m',
                      label: t('bravo.prompt_cache.anthropic_ttl_options.5m'),
                    },
                    {
                      value: '1h',
                      label: t('bravo.prompt_cache.anthropic_ttl_options.1h'),
                    },
                    {
                      value: 'auto',
                      label: t('bravo.prompt_cache.anthropic_ttl_options.auto'),
                    },
                  ]}
                  onChange={(anthropicCacheTtl) =>
                    setDraft((current) => ({
                      ...current,
                      anthropicCacheTtl: anthropicCacheTtl as BravoAnthropicCacheTTL,
                    }))
                  }
                  ariaLabelledBy="bravo-anthropic-cache-ttl"
                  ariaDescribedBy="bravo-anthropic-cache-ttl-help"
                  disabled={saving}
                />
                <span id="bravo-anthropic-cache-ttl-help">
                  {t('bravo.prompt_cache.anthropic_help')}
                </span>
              </div>
              <div className={styles.providerManagedNote}>
                <strong>{t('bravo.prompt_cache.openai_title')}</strong>
                <span>{t('bravo.prompt_cache.openai_help')}</span>
              </div>
              <p className={styles.cacheFallbackNote}>{t('bravo.prompt_cache.fallback_help')}</p>
            </div>
          </details>
        </div>
      </Sheet>

      <Modal
        open={Boolean(issuedKey)}
        onClose={() => setIssuedKey(null)}
        title={t('bravo.key.title')}
        closeDisabled
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => void copyText(issuedKey?.plaintext ?? '', 'bravo.key.copied')}
            >
              <IconCopy size={16} />
              {t('common.copy')}
            </Button>
            <Button onClick={() => setIssuedKey(null)}>{t('bravo.key.saved')}</Button>
          </>
        }
      >
        <div className={styles.keyDialog}>
          <div className={styles.keyWarning}>
            <IconKey size={20} />
            <span>{t('bravo.key.warning', { name: issuedKey?.projectName ?? '' })}</span>
          </div>
          <code className={styles.plaintextKey}>{issuedKey?.plaintext}</code>
          <div className={styles.keyHelp}>
            <strong>{t('bravo.key.how_to_use')}</strong>
            <span>{t('bravo.key.use_hint')}</span>
          </div>
          <div className={styles.setupGrid}>
            <div className={styles.clientSetup}>
              <div className={styles.setupHeading}>
                <div>
                  <strong>{t('bravo.key.claude_setup')}</strong>
                  <span>{t('bravo.key.effort_hint')}</span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void copyText(claudeSetup, 'bravo.key.claude_setup_copied')}
                >
                  <IconCopy size={15} />
                  {t('bravo.key.copy_setup')}
                </Button>
              </div>
              <pre>
                <code>{claudeSetup}</code>
              </pre>
            </div>
            <div className={styles.clientSetup}>
              <div className={styles.setupHeading}>
                <div>
                  <strong>{t('bravo.key.openai_setup')}</strong>
                  <span>{t('bravo.key.openai_hint')}</span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void copyText(openAISetup, 'bravo.key.openai_setup_copied')}
                >
                  <IconCopy size={15} />
                  {t('bravo.key.copy_setup')}
                </Button>
              </div>
              <pre>
                <code>{openAISetup}</code>
              </pre>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
