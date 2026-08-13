import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { IconAlertTriangle, IconInfo, IconRefreshCw } from '@/components/ui/icons';
import {
  bravoApi,
  type BravoAnalyticsResponse,
  type BravoProject,
  type BravoQuotaConsumptionProject,
  type BravoQuotaConsumptionWindow,
} from '@/services/api';
import { getErrorMessage } from '@/utils/helpers';
import {
  resolveBravoAnalyticsRange,
  type BravoAnalyticsPreset,
  type BravoAnalyticsRange,
} from './bravoAnalyticsPresentation';
import {
  bravoQuotaCapacityStatus,
  bravoQuotaComposition,
  bravoQuotaConsumptionWindowKey,
  bravoQuotaTopPlan,
  sortBravoQuotaConsumptionWindows,
} from './bravoQuotaConsumptionPresentation';
import styles from './BravoQuotaConsumptionPanel.module.scss';

interface BravoQuotaConsumptionPanelProps {
  connected: boolean;
  projects: BravoProject[];
}

const presets: Exclude<BravoAnalyticsPreset, 'custom'>[] = ['24h', '7d', '30d', '90d'];

const formatNumber = (value: number, locale: string, digits = 1): string =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value);

const formatPercent = (value: number, locale: string): string => `${formatNumber(value, locale)}%`;

const formatWindowKind = (
  window: BravoQuotaConsumptionWindow,
  t: ReturnType<typeof useTranslation>['t']
): string => {
  const provider = window.provider.charAt(0).toUpperCase() + window.provider.slice(1);
  if (window.kind === 'model_weekly') {
    return t('bravo.quota_consumption.window_model', {
      provider,
      model: window.quotaModel || t('bravo.quota_consumption.unknown_model'),
    });
  }
  return t(`bravo.quota_consumption.window_${window.kind}`, {
    provider,
    defaultValue: `${provider} · ${window.kind}`,
  });
};

export function BravoQuotaConsumptionPanel({
  connected,
  projects,
}: BravoQuotaConsumptionPanelProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language || 'en';
  const [preset, setPreset] = useState<Exclude<BravoAnalyticsPreset, 'custom'>>('30d');
  const [range, setRange] = useState<BravoAnalyticsRange>(() => resolveBravoAnalyticsRange('30d'));
  const [analytics, setAnalytics] = useState<BravoAnalyticsResponse | null>(null);
  const [selectedWindowKey, setSelectedWindowKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);

  const load = useCallback(
    async (nextRange: BravoAnalyticsRange) => {
      if (!connected) return;
      const sequence = requestSequence.current + 1;
      requestSequence.current = sequence;
      setLoading(true);
      setError('');
      try {
        const response = await bravoApi.getAnalytics({
          from: nextRange.from,
          to: nextRange.to,
          interval: nextRange.interval,
        });
        if (requestSequence.current === sequence) setAnalytics(response);
      } catch (loadError: unknown) {
        if (requestSequence.current === sequence) {
          setError(getErrorMessage(loadError, t('bravo.quota_consumption.load_failed')));
        }
      } finally {
        if (requestSequence.current === sequence) setLoading(false);
      }
    },
    [connected, t]
  );

  useEffect(() => {
    if (connected) void load(range);
    // The range changes through selectPreset, which performs its own request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, load]);

  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  );
  const windows = useMemo(
    () => sortBravoQuotaConsumptionWindows(analytics?.quotaConsumption.windows ?? []),
    [analytics]
  );
  const selectedWindow = useMemo(
    () =>
      windows.find((window) => bravoQuotaConsumptionWindowKey(window) === selectedWindowKey) ??
      windows[0] ??
      null,
    [selectedWindowKey, windows]
  );
  const composition = useMemo(
    () => bravoQuotaComposition(selectedWindow?.sharedPool ?? null, selectedWindow?.projects ?? []),
    [selectedWindow]
  );

  const selectPreset = (nextPreset: Exclude<BravoAnalyticsPreset, 'custom'>) => {
    const nextRange = resolveBravoAnalyticsRange(nextPreset);
    setPreset(nextPreset);
    setRange(nextRange);
    void load(nextRange);
  };

  const projectName = (projectId: string): string => projectById.get(projectId)?.name || projectId;

  const capacityLabel = (
    project: BravoQuotaConsumptionProject,
    window: BravoQuotaConsumptionWindow
  ): string => {
    const plan = bravoQuotaTopPlan(project);
    const status = bravoQuotaCapacityStatus(window.confidence, plan);
    if (!plan) return t('bravo.quota_consumption.capacity.collecting');
    return t(`bravo.quota_consumption.capacity.${status}`, {
      count: formatNumber(
        status === 'add'
          ? plan.estimatedAdditionalAtPeakPace
          : status === 'spare'
            ? plan.estimatedSpareAtPeakPace
            : plan.currentSubscriptions,
        locale
      ),
      tariff: plan.tariffId || `x${formatNumber(plan.multiplier, locale)}`,
    });
  };

  const pool = selectedWindow?.sharedPool ?? null;
  const empty = !loading && (!analytics || analytics.quotaConsumption.status !== 'available');

  return (
    <section className={styles.panel} aria-labelledby="bravo-quota-consumption-title">
      <header className={styles.header}>
        <div>
          <div className={styles.titleLine}>
            <h2 id="bravo-quota-consumption-title">{t('bravo.quota_consumption.title')}</h2>
            {selectedWindow ? (
              <span className={`${styles.confidence} ${styles[selectedWindow.confidence] ?? ''}`}>
                {t(`bravo.quota_consumption.confidence.${selectedWindow.confidence}`, {
                  defaultValue: selectedWindow.confidence,
                })}
              </span>
            ) : null}
          </div>
          <p>{t('bravo.quota_consumption.subtitle')}</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => void load(range)}
          loading={loading}
          disabled={!connected}
        >
          <IconRefreshCw size={15} />
          {t('common.refresh')}
        </Button>
      </header>

      <div className={styles.controls}>
        <div className={styles.presets} aria-label={t('bravo.quota_consumption.period')}>
          {presets.map((item) => (
            <button
              type="button"
              key={item}
              className={preset === item ? styles.active : ''}
              aria-pressed={preset === item}
              onClick={() => selectPreset(item)}
            >
              {t(`bravo.analytics.presets.${item}`)}
            </button>
          ))}
        </div>
        {windows.length > 0 ? (
          <div className={styles.windows} aria-label={t('bravo.quota_consumption.window')}>
            {windows.map((window) => {
              const key = bravoQuotaConsumptionWindowKey(window);
              const selected = selectedWindow === window;
              return (
                <button
                  type="button"
                  key={key}
                  className={selected ? styles.active : ''}
                  aria-pressed={selected}
                  onClick={() => setSelectedWindowKey(key)}
                >
                  {formatWindowKind(window, t)}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {error ? (
        <div className={styles.error} role="alert">
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={() => void load(range)}>
            {t('bravo.quota_consumption.retry')}
          </Button>
        </div>
      ) : null}

      {loading && !analytics ? (
        <div className={styles.empty} role="status">
          {t('bravo.quota_consumption.loading')}
        </div>
      ) : null}

      {empty && !error ? (
        <div className={styles.empty}>
          <IconInfo size={18} />
          <span>{t('bravo.quota_consumption.collecting')}</span>
        </div>
      ) : null}

      {selectedWindow ? (
        <div className={styles.content}>
          <div className={styles.kpis}>
            <div>
              <span>{t('bravo.quota_consumption.observed')}</span>
              <strong>{pool ? formatPercent(pool.observedDropPercent, locale) : '—'}</strong>
              <small>{t('bravo.quota_consumption.observed_hint')}</small>
            </div>
            <div>
              <span>{t('bravo.quota_consumption.projects_share')}</span>
              <strong>{pool ? formatPercent(pool.attributedProjectPercent, locale) : '—'}</strong>
              <small>
                {t('bravo.quota_consumption.projects_count', {
                  count: selectedWindow.projects.length,
                })}
              </small>
            </div>
            <div>
              <span>{t('bravo.quota_consumption.external')}</span>
              <strong>
                {pool ? formatPercent(pool.externalOrEstimatorGapPercent, locale) : '—'}
              </strong>
              <small>{t('bravo.quota_consumption.external_hint')}</small>
            </div>
            <div>
              <span>{t('bravo.quota_consumption.pace')}</span>
              <strong>
                {pool
                  ? t('bravo.quota_consumption.pp_per_hour', {
                      value: formatNumber(pool.averageObservedPPPerSubscriptionHour, locale, 2),
                    })
                  : '—'}
              </strong>
              <small>{t('bravo.quota_consumption.samples', { count: pool?.samples ?? 0 })}</small>
            </div>
          </div>

          {composition.length > 0 ? (
            <div className={styles.composition}>
              <div className={styles.compositionHeading}>
                <strong>{t('bravo.quota_consumption.pool_composition')}</strong>
                <span>{t('bravo.quota_consumption.windows_independent')}</span>
              </div>
              <div
                className={styles.compositionTrack}
                role="img"
                aria-label={t('bravo.quota_consumption.pool_composition')}
              >
                {composition.map((segment, index) => (
                  <span
                    key={`${segment.kind}:${segment.projectId}:${index}`}
                    className={
                      segment.kind === 'project'
                        ? styles[`projectColor${index % 6}`]
                        : segment.kind === 'external'
                          ? styles.externalColor
                          : styles.unassignedColor
                    }
                    style={{ width: `${segment.widthPercent}%` }}
                    title={`${
                      segment.kind === 'project'
                        ? projectName(segment.projectId)
                        : t(`bravo.quota_consumption.${segment.kind}`)
                    }: ${formatPercent(segment.percentagePoints, locale)}`}
                  />
                ))}
              </div>
              <div className={styles.legend}>
                {composition.map((segment, index) => (
                  <span key={`${segment.kind}:${segment.projectId}:${index}`}>
                    <i
                      className={
                        segment.kind === 'project'
                          ? styles[`projectColor${index % 6}`]
                          : segment.kind === 'external'
                            ? styles.externalColor
                            : styles.unassignedColor
                      }
                    />
                    {segment.kind === 'project'
                      ? projectName(segment.projectId)
                      : t(`bravo.quota_consumption.${segment.kind}`)}
                    <strong>{formatPercent(segment.percentagePoints, locale)}</strong>
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className={styles.ranking}>
            <div className={styles.rankingHeading}>
              <div>
                <h3>{t('bravo.quota_consumption.ranking')}</h3>
                <p>{t('bravo.quota_consumption.ranking_hint')}</p>
              </div>
              <span>{formatWindowKind(selectedWindow, t)}</span>
            </div>

            {selectedWindow.projects.length === 0 ? (
              <div className={styles.empty}>{t('bravo.quota_consumption.no_projects')}</div>
            ) : (
              <div className={styles.projectList}>
                {selectedWindow.projects.map((project) => {
                  const topPlan = bravoQuotaTopPlan(project);
                  const capacityStatus = bravoQuotaCapacityStatus(
                    selectedWindow.confidence,
                    topPlan
                  );
                  return (
                    <details className={styles.project} key={project.projectId}>
                      <summary>
                        <span className={styles.rank}>{project.rank}</span>
                        <span className={styles.projectIdentity}>
                          <strong>{projectName(project.projectId)}</strong>
                          <small>{project.projectId}</small>
                        </span>
                        <span className={styles.share}>
                          <strong>
                            {formatPercent(project.shareOfAttributedPoolPercent, locale)}
                          </strong>
                          <i>
                            <b
                              style={{
                                width: `${Math.max(
                                  0,
                                  Math.min(100, project.shareOfAttributedPoolPercent)
                                )}%`,
                              }}
                            />
                          </i>
                        </span>
                        <span className={styles.rate}>
                          <small>{t('bravo.quota_consumption.average_peak')}</small>
                          <strong>
                            {formatNumber(project.averagePPPerHour, locale, 2)} /{' '}
                            {formatNumber(project.peakHourlyPP, locale, 2)}
                          </strong>
                        </span>
                        <span className={`${styles.capacity} ${styles[capacityStatus]}`}>
                          {capacityLabel(project, selectedWindow)}
                        </span>
                        <span className={styles.chevron} aria-hidden="true">
                          ›
                        </span>
                      </summary>
                      <div className={styles.projectBody}>
                        <div className={styles.projectFacts}>
                          <span>
                            {t('bravo.quota_consumption.consumed_windows')}
                            <strong>
                              {formatNumber(project.subscriptionWindowsConsumed, locale, 2)}
                            </strong>
                          </span>
                          <span>
                            {t('bravo.quota_consumption.x1_windows')}
                            <strong>
                              {formatNumber(project.baseX1EquivalentWindows, locale, 2)}
                            </strong>
                          </span>
                          <span>
                            {t('bravo.quota_consumption.commitments')}
                            <strong>{formatNumber(project.commitments, locale, 0)}</strong>
                          </span>
                        </div>

                        {project.models.length > 0 ? (
                          <div className={styles.models}>
                            <h4>{t('bravo.quota_consumption.models')}</h4>
                            {project.models.map((model, index) => (
                              <div
                                className={styles.modelRow}
                                key={`${model.provider}:${model.model}:${model.logicalModel}:${model.effort}:${index}`}
                              >
                                <span>
                                  <strong>{model.model || model.logicalModel}</strong>
                                  <small>
                                    {[model.logicalModel, model.effort, model.tariffId]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </small>
                                </span>
                                <i>
                                  <b
                                    style={{
                                      width: `${Math.max(
                                        0,
                                        Math.min(100, model.shareOfProjectPercent)
                                      )}%`,
                                    }}
                                  />
                                </i>
                                <strong>
                                  {formatPercent(model.shareOfProjectPercent, locale)}
                                </strong>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {project.plans.length > 0 ? (
                          <div className={styles.plans}>
                            <h4>{t('bravo.quota_consumption.capacity_title')}</h4>
                            {project.plans.map((plan) => (
                              <div
                                className={styles.planRow}
                                key={`${plan.tariffId}:${plan.multiplier}`}
                              >
                                <span>
                                  <strong>{plan.tariffId || `x${plan.multiplier}`}</strong>
                                  <small>
                                    {t('bravo.quota_consumption.current_capacity', {
                                      count: formatNumber(plan.currentSubscriptions, locale),
                                    })}
                                  </small>
                                </span>
                                <span>
                                  {t('bravo.quota_consumption.estimated_average')}
                                  <strong>
                                    {formatNumber(
                                      plan.estimatedSubscriptionsAtAveragePace,
                                      locale,
                                      2
                                    )}
                                  </strong>
                                </span>
                                <span>
                                  {t('bravo.quota_consumption.estimated_peak')}
                                  <strong>
                                    {formatNumber(plan.estimatedSubscriptionsAtPeakPace, locale, 2)}
                                  </strong>
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        {project.signals.length > 0 ? (
                          <div className={styles.signals}>
                            <IconAlertTriangle size={16} />
                            <div>
                              {project.signals.map((signal) => (
                                <p key={signal}>{signal}</p>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </div>

          <div className={styles.footnote}>
            <IconInfo size={15} />
            <span>{t('bravo.quota_consumption.footnote')}</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
