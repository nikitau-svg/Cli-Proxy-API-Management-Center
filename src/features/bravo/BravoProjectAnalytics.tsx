import { useCallback, useMemo, useRef, useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { IconDownload, IconInfo, IconRefreshCw } from '@/components/ui/icons';
import {
  bravoApi,
  type BravoAnalyticsResponse,
  type BravoProject,
  type BravoSubscription,
} from '@/services/api';
import { getErrorMessage } from '@/utils/helpers';
import {
  analyticsDeltaPercent,
  analyticsSeriesToCSV,
  analyticsUsageIsEmpty,
  formatBravoResponseTime,
  resolveBravoAnalyticsRange,
  resolveBravoCustomRange,
  type BravoAnalyticsPreset,
  type BravoAnalyticsRange,
} from './bravoAnalyticsPresentation';
import {
  bravoProviderLabel,
  formatBravoSubscription,
  formatBravoSubscriptionRecord,
} from './bravoSubscriptionPresentation';
import styles from './BravoProjectAnalytics.module.scss';

interface BravoProjectAnalyticsProps {
  project: BravoProject;
  subscriptions: BravoSubscription[];
}

interface AnalyticsState {
  current: BravoAnalyticsResponse | null;
  previous: BravoAnalyticsResponse | null;
}

const presets: Exclude<BravoAnalyticsPreset, 'custom'>[] = ['24h', '7d', '30d', '90d'];

const toDateInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatNumber = (value: number, locale: string): string =>
  new Intl.NumberFormat(locale, {
    notation: Math.abs(value) >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);

const formatDate = (value: string, locale: string, withTime = false): string => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value || '—';
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
};

const safeFilePart = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'project';

const usageMetrics: Array<{
  key: 'requests' | 'totalTokens' | 'failures' | 'averageLatencyMs';
  label: string;
  inverse?: boolean;
}> = [
  { key: 'requests', label: 'requests' },
  { key: 'totalTokens', label: 'tokens' },
  { key: 'failures', label: 'failures', inverse: true },
  { key: 'averageLatencyMs', label: 'response_time', inverse: true },
];

const formatTimelineRange = (
  startValue: string,
  endValue: string,
  locale: string,
  interval: 'hour' | 'day'
): string => {
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (!Number.isFinite(start.getTime())) return startValue || '—';
  const startLabel = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    ...(interval === 'hour' ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(start);
  if (interval !== 'hour' || !Number.isFinite(end.getTime())) return startLabel;
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  const endLabel = new Intl.DateTimeFormat(locale, {
    ...(sameDay ? {} : { month: 'short', day: 'numeric' }),
    hour: '2-digit',
    minute: '2-digit',
  }).format(end);
  return `${startLabel}–${endLabel}`;
};

function Delta({
  current,
  previous,
  inverse = false,
  locale,
  unavailable,
}: {
  current: number;
  previous: number;
  inverse?: boolean;
  locale: string;
  unavailable: string;
}) {
  const delta = analyticsDeltaPercent(current, previous);
  if (delta === null) return <span className={styles.deltaNeutral}>{unavailable}</span>;
  const improved = inverse ? delta < 0 : delta > 0;
  const worsened = inverse ? delta > 0 : delta < 0;
  return (
    <span
      className={improved ? styles.deltaGood : worsened ? styles.deltaBad : styles.deltaNeutral}
    >
      {delta > 0 ? '+' : ''}
      {new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(delta)}%
    </span>
  );
}

function ResponseTimeLabel({ label, help }: { label: string; help: string }) {
  return (
    <span className={styles.metricWithHelp}>
      <span>{label}</span>
      <span
        className={styles.metricHelpControl}
        role="note"
        tabIndex={0}
        aria-label={help}
        title={help}
      >
        <IconInfo size={13} aria-hidden="true" />
      </span>
    </span>
  );
}

function UsageChart({
  analytics,
  locale,
  label,
}: {
  analytics: BravoAnalyticsResponse;
  locale: string;
  label: string;
}) {
  const width = 760;
  const height = 220;
  const padding = { top: 20, right: 20, bottom: 34, left: 54 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maximum = Math.max(1, ...analytics.series.map((point) => point.usage.totalTokens));
  const points = analytics.series.map((point, index) => {
    const x =
      padding.left +
      (analytics.series.length === 1
        ? plotWidth / 2
        : (index / (analytics.series.length - 1)) * plotWidth);
    const y = padding.top + plotHeight - (point.usage.totalTokens / maximum) * plotHeight;
    return { ...point, x, y };
  });

  return (
    <div className={styles.chartWrap}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
        <title>{label}</title>
        {[0, 0.5, 1].map((ratio) => {
          const y = padding.top + plotHeight - plotHeight * ratio;
          return (
            <g key={ratio}>
              <line
                className={styles.chartGrid}
                x1={padding.left}
                x2={width - padding.right}
                y1={y}
                y2={y}
              />
              <text className={styles.chartLabel} x={padding.left - 9} y={y + 4} textAnchor="end">
                {formatNumber(maximum * ratio, locale)}
              </text>
            </g>
          );
        })}
        {points.length > 1 ? (
          <polyline
            className={styles.chartLine}
            points={points.map((point) => `${point.x},${point.y}`).join(' ')}
          />
        ) : null}
        {points.map((point) => (
          <circle className={styles.chartPoint} key={point.start} cx={point.x} cy={point.y} r={4}>
            <title>
              {formatDate(point.start, locale, analytics.interval === 'hour')} ·{' '}
              {formatNumber(point.usage.totalTokens, locale)}
            </title>
          </circle>
        ))}
        {points.length ? (
          <>
            <text className={styles.chartLabel} x={padding.left} y={height - 8}>
              {formatDate(points[0].start, locale, analytics.interval === 'hour')}
            </text>
            <text
              className={styles.chartLabel}
              x={width - padding.right}
              y={height - 8}
              textAnchor="end"
            >
              {formatDate(points[points.length - 1].start, locale, analytics.interval === 'hour')}
            </text>
          </>
        ) : null}
      </svg>
    </div>
  );
}

export function BravoProjectAnalytics({ project, subscriptions }: BravoProjectAnalyticsProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language || 'en';
  const initialTo = useMemo(() => new Date(), []);
  const initialFrom = useMemo(
    () => new Date(initialTo.getTime() - 6 * 24 * 60 * 60 * 1000),
    [initialTo]
  );
  const [opened, setOpened] = useState(false);
  const [preset, setPreset] = useState<BravoAnalyticsPreset>('7d');
  const [customFrom, setCustomFrom] = useState(toDateInput(initialFrom));
  const [customTo, setCustomTo] = useState(toDateInput(initialTo));
  const [range, setRange] = useState<BravoAnalyticsRange>(() => resolveBravoAnalyticsRange('7d'));
  const [state, setState] = useState<AnalyticsState>({ current: null, previous: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const requestSequence = useRef(0);

  const load = useCallback(
    async (nextRange: BravoAnalyticsRange) => {
      const sequence = requestSequence.current + 1;
      requestSequence.current = sequence;
      setLoading(true);
      setError('');
      try {
        const [current, previous] = await Promise.all([
          bravoApi.getAnalytics({
            projectId: project.id,
            from: nextRange.from,
            to: nextRange.to,
            interval: nextRange.interval,
          }),
          bravoApi
            .getAnalytics({
              projectId: project.id,
              from: nextRange.previousFrom,
              to: nextRange.previousTo,
              interval: nextRange.interval,
            })
            .catch(() => null),
        ]);
        if (sequence !== requestSequence.current) return;
        setState({ current, previous });
      } catch (err: unknown) {
        if (sequence !== requestSequence.current) return;
        setError(getErrorMessage(err, t('bravo.analytics.load_failed')));
      } finally {
        if (sequence === requestSequence.current) setLoading(false);
      }
    },
    [project.id, t]
  );

  const handleToggle = (event: SyntheticEvent<HTMLDetailsElement>) => {
    const isOpen = event.currentTarget.open;
    setOpened(isOpen);
    if (isOpen && !state.current && !loading) void load(range);
  };

  const selectPreset = (nextPreset: Exclude<BravoAnalyticsPreset, 'custom'>) => {
    const nextRange = resolveBravoAnalyticsRange(nextPreset);
    setPreset(nextPreset);
    setRange(nextRange);
    if (opened) void load(nextRange);
  };

  const applyCustom = () => {
    const nextRange = resolveBravoCustomRange(customFrom, customTo);
    if (!nextRange) {
      setError(t('bravo.analytics.invalid_range'));
      return;
    }
    setPreset('custom');
    setRange(nextRange);
    if (opened) void load(nextRange);
  };

  const downloadCSV = () => {
    if (!state.current) return;
    const blob = new Blob([analyticsSeriesToCSV(state.current.series)], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `bravo-${safeFilePart(project.name)}-${preset}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const subscriptionByReference = useMemo(() => {
    const result = new Map<string, BravoSubscription>();
    subscriptions.forEach((subscription) => {
      [subscription.analyticsId, subscription.authIndex, subscription.authId]
        .filter(Boolean)
        .forEach((reference) => result.set(reference, subscription));
    });
    return result;
  }, [subscriptions]);

  const currentAnalytics = state.current;
  const breakdownGroups = useMemo(() => {
    if (!currentAnalytics) return [];
    const models = currentAnalytics.breakdown.projectSubscriptionModels.filter(
      (row) => row.projectId === project.id
    );
    const rowsBySubscription = new Map<string, typeof models>();
    models.forEach((row) => {
      const rows = rowsBySubscription.get(row.subscriptionId) ?? [];
      rows.push(row);
      rowsBySubscription.set(row.subscriptionId, rows);
    });
    return currentAnalytics.breakdown.subscriptions.map((row) => ({
      ...row,
      subscription:
        subscriptionByReference.get(row.subscriptionId) ??
        subscriptionByReference.get(row.authIndex),
      models: rowsBySubscription.get(row.subscriptionId) ?? [],
    }));
  }, [currentAnalytics, project.id, subscriptionByReference]);

  const timelineGroups = useMemo(() => {
    if (!currentAnalytics) return [];
    const groups = new Map<
      string,
      {
        start: string;
        end: string;
        rows: Array<
          BravoAnalyticsResponse['subscriptionTimeline'][number] & {
            identity: ReturnType<typeof formatBravoSubscription>;
          }
        >;
      }
    >();
    [...currentAnalytics.subscriptionTimeline]
      .sort((left, right) => new Date(right.start).getTime() - new Date(left.start).getTime())
      .forEach((row) => {
        const subscription =
          subscriptionByReference.get(row.subscriptionId) ??
          subscriptionByReference.get(row.authIndex);
        const identity = formatBravoSubscription({
          ...(subscription ?? {}),
          provider: subscription?.provider || row.provider,
          note: subscription?.note || row.note,
          displayName: subscription?.displayName || row.displayName,
          label: subscription?.label || row.label,
          email: subscription?.email || row.email,
          workspace: subscription?.workspace || row.workspace,
          subscriptionId: row.subscriptionId,
          authIndex: subscription?.authIndex || row.authIndex,
        });
        const key = `${row.start}\u0000${row.end}`;
        const group = groups.get(key) ?? { start: row.start, end: row.end, rows: [] };
        group.rows.push({ ...row, identity });
        groups.set(key, group);
      });
    return [...groups.values()].map((group) => ({
      ...group,
      rows: [...group.rows].sort((left, right) => right.usage.totalTokens - left.usage.totalTokens),
    }));
  }, [currentAnalytics, subscriptionByReference]);

  const breakdownPartial =
    Boolean(state.current?.breakdownCoverageFrom) &&
    new Date(range.from).getTime() < new Date(state.current?.breakdownCoverageFrom ?? '').getTime();
  const summaryPartial =
    Boolean(state.current?.coverageFrom) &&
    new Date(range.from).getTime() < new Date(state.current?.coverageFrom ?? '').getTime();
  const empty = state.current ? analyticsUsageIsEmpty(state.current.summary) : false;
  const visibleTimelineGroups = timelineGroups.slice(0, 8);
  const olderTimelineGroups = timelineGroups.slice(8);

  const renderTimelineGroups = (groups: typeof timelineGroups) =>
    groups.map((group) => (
      <section className={styles.timelineBucket} key={`${group.start}:${group.end}`}>
        <header>
          <time dateTime={group.start}>
            {formatTimelineRange(group.start, group.end, locale, state.current?.interval ?? 'day')}
          </time>
          <span>
            {t('bravo.analytics.timeline_accounts', {
              count: group.rows.length,
            })}
          </span>
        </header>
        <div>
          {group.rows.map((row) => {
            const cacheTokens =
              row.usage.cacheReadTokens + row.usage.cacheCreationTokens || row.usage.cachedTokens;
            return (
              <div
                className={styles.timelineRow}
                key={`${row.start}:${row.subscriptionId}:${row.provider}`}
              >
                <span className={styles.timelineIdentity}>
                  <strong title={row.identity.title}>{row.identity.title}</strong>
                  <small title={row.identity.subtitle}>{row.identity.subtitle}</small>
                </span>
                <span className={styles.timelineMetric}>
                  <small>{t('bravo.analytics.metrics.requests')}</small>
                  <strong>{formatNumber(row.usage.requests, locale)}</strong>
                </span>
                <span className={styles.timelineMetric}>
                  <small>{t('bravo.analytics.metrics.tokens')}</small>
                  <strong>{formatNumber(row.usage.totalTokens, locale)}</strong>
                </span>
                <span className={styles.timelineMetric}>
                  <small>{t('bravo.analytics.metrics.cache_tokens')}</small>
                  <strong>{formatNumber(cacheTokens, locale)}</strong>
                </span>
                <span
                  className={`${styles.timelineMetric} ${
                    row.usage.failures > 0 ? styles.timelineFailures : ''
                  }`}
                >
                  <small>{t('bravo.analytics.metrics.failures')}</small>
                  <strong>{formatNumber(row.usage.failures, locale)}</strong>
                </span>
              </div>
            );
          })}
        </div>
      </section>
    ));

  return (
    <details className={styles.analytics} onToggle={handleToggle}>
      <summary>
        <span>
          <strong>{t('bravo.analytics.title')}</strong>
          <small>{t('bravo.analytics.subtitle')}</small>
        </span>
        <span className={styles.summaryValue}>
          {state.current
            ? t('bravo.analytics.summary_tokens', {
                count: formatNumber(state.current.summary.totalTokens, locale),
              })
            : t('bravo.analytics.open')}
        </span>
        <span className={styles.chevron} aria-hidden="true">
          ›
        </span>
      </summary>
      {opened ? (
        <div className={styles.body}>
          <div className={styles.periodToolbar}>
            <div className={styles.presets} aria-label={t('bravo.analytics.period')}>
              {presets.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={preset === item ? styles.presetActive : ''}
                  aria-pressed={preset === item}
                  onClick={() => selectPreset(item)}
                >
                  {t(`bravo.analytics.presets.${item}`)}
                </button>
              ))}
              <button
                type="button"
                className={preset === 'custom' ? styles.presetActive : ''}
                aria-pressed={preset === 'custom'}
                onClick={() => setPreset('custom')}
              >
                {t('bravo.analytics.presets.custom')}
              </button>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void load(range)}
              loading={loading}
            >
              <IconRefreshCw size={15} />
              {t('common.refresh')}
            </Button>
          </div>

          {preset === 'custom' ? (
            <div className={styles.customRange}>
              <Input
                type="date"
                label={t('bravo.analytics.from')}
                value={customFrom}
                max={customTo}
                onChange={(event) => setCustomFrom(event.target.value)}
              />
              <Input
                type="date"
                label={t('bravo.analytics.to')}
                value={customTo}
                min={customFrom}
                max={toDateInput(new Date())}
                onChange={(event) => setCustomTo(event.target.value)}
              />
              <Button variant="secondary" onClick={applyCustom}>
                {t('bravo.analytics.apply')}
              </Button>
            </div>
          ) : null}

          {error ? (
            <div className={styles.error} role="alert">
              <span>{error}</span>
              <Button variant="secondary" size="sm" onClick={() => void load(range)}>
                {t('bravo.analytics.retry')}
              </Button>
            </div>
          ) : null}
          {loading && !state.current ? (
            <div className={styles.loading} role="status">
              {t('bravo.analytics.loading')}
            </div>
          ) : null}

          {state.current ? (
            <>
              <div className={styles.kpis}>
                {usageMetrics.map((metric) => (
                  <div className={styles.kpi} key={metric.key}>
                    {metric.key === 'averageLatencyMs' ? (
                      <ResponseTimeLabel
                        label={t('bravo.analytics.metrics.response_time')}
                        help={t('bravo.analytics.response_time_help')}
                      />
                    ) : (
                      <span>{t(`bravo.analytics.metrics.${metric.label}`)}</span>
                    )}
                    <strong>
                      {metric.key === 'averageLatencyMs'
                        ? formatBravoResponseTime(
                            state.current?.summary.averageLatencyMs ?? 0,
                            locale
                          )
                        : formatNumber(state.current?.summary[metric.key] ?? 0, locale)}
                    </strong>
                    {state.previous ? (
                      <small>
                        <Delta
                          current={state.current?.summary[metric.key] ?? 0}
                          previous={state.previous.summary[metric.key]}
                          inverse={metric.inverse}
                          locale={locale}
                          unavailable={t('bravo.analytics.no_baseline')}
                        />{' '}
                        {t('bravo.analytics.vs_previous')}
                      </small>
                    ) : (
                      <small>{t('bravo.analytics.comparison_unavailable')}</small>
                    )}
                  </div>
                ))}
              </div>

              <div className={styles.tokenLegend} aria-label={t('bravo.analytics.token_mix')}>
                <span>
                  <i className={styles.inputDot} /> {t('bravo.analytics.metrics.input_tokens')}{' '}
                  <strong>{formatNumber(state.current.summary.inputTokens, locale)}</strong>
                </span>
                <span>
                  <i className={styles.outputDot} /> {t('bravo.analytics.metrics.output_tokens')}{' '}
                  <strong>{formatNumber(state.current.summary.outputTokens, locale)}</strong>
                </span>
                <span>
                  <i className={styles.reasoningDot} />{' '}
                  {t('bravo.analytics.metrics.reasoning_tokens')}{' '}
                  <strong>{formatNumber(state.current.summary.reasoningTokens, locale)}</strong>
                </span>
                <span>
                  <i className={styles.cacheDot} /> {t('bravo.analytics.metrics.cache_tokens')}{' '}
                  <strong>
                    {formatNumber(
                      state.current.summary.cacheReadTokens +
                        state.current.summary.cacheCreationTokens,
                      locale
                    )}
                  </strong>
                </span>
              </div>

              {summaryPartial ? (
                <div className={styles.coverageNote}>
                  <IconInfo size={16} />
                  <span>
                    {t('bravo.analytics.summary_coverage', {
                      date: formatDate(state.current.coverageFrom, locale),
                    })}
                  </span>
                </div>
              ) : null}

              {breakdownPartial ? (
                <div className={styles.coverageNote}>
                  <IconInfo size={16} />
                  <span>
                    {t('bravo.analytics.breakdown_coverage', {
                      date: formatDate(state.current.breakdownCoverageFrom, locale),
                    })}
                  </span>
                </div>
              ) : null}

              {visibleTimelineGroups.length ? (
                <div className={styles.timeline}>
                  <div className={styles.timelineHeading}>
                    <div>
                      <h4>{t('bravo.analytics.timeline_title')}</h4>
                      <p>{t('bravo.analytics.timeline_hint')}</p>
                    </div>
                    <span>{t(`bravo.analytics.interval.${state.current.interval}`)}</span>
                  </div>
                  <div className={styles.timelineList}>
                    {renderTimelineGroups(visibleTimelineGroups)}
                    {olderTimelineGroups.length ? (
                      <details className={styles.timelineOlder}>
                        <summary>
                          <span>
                            {t('bravo.analytics.timeline_older', {
                              count: olderTimelineGroups.length,
                            })}
                          </span>
                          <span className={styles.chevron} aria-hidden="true">
                            ›
                          </span>
                        </summary>
                        <div>{renderTimelineGroups(olderTimelineGroups)}</div>
                      </details>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {empty ? (
                <div className={styles.empty}>{t('bravo.analytics.empty')}</div>
              ) : (
                <>
                  <div className={styles.visualToolbar}>
                    <div className={styles.viewSwitch} aria-label={t('bravo.analytics.view')}>
                      <button
                        type="button"
                        aria-pressed={view === 'chart'}
                        className={view === 'chart' ? styles.viewActive : ''}
                        onClick={() => setView('chart')}
                      >
                        {t('bravo.analytics.chart')}
                      </button>
                      <button
                        type="button"
                        aria-pressed={view === 'table'}
                        className={view === 'table' ? styles.viewActive : ''}
                        onClick={() => setView('table')}
                      >
                        {t('bravo.analytics.table')}
                      </button>
                    </div>
                    <Button variant="secondary" size="sm" onClick={downloadCSV}>
                      <IconDownload size={15} />
                      {t('bravo.analytics.csv')}
                    </Button>
                  </div>

                  {view === 'chart' ? (
                    <UsageChart
                      analytics={state.current}
                      locale={locale}
                      label={t('bravo.analytics.chart_label')}
                    />
                  ) : (
                    <div className={styles.tableScroll}>
                      <table>
                        <thead>
                          <tr>
                            <th scope="col">{t('bravo.analytics.bucket')}</th>
                            <th scope="col">{t('bravo.analytics.metrics.requests')}</th>
                            <th scope="col">{t('bravo.analytics.metrics.tokens')}</th>
                            <th scope="col">{t('bravo.analytics.metrics.failures')}</th>
                            <th scope="col">
                              <ResponseTimeLabel
                                label={t('bravo.analytics.metrics.response_time')}
                                help={t('bravo.analytics.response_time_help')}
                              />
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {state.current.series.map((point) => (
                            <tr key={point.start}>
                              <th scope="row">
                                {formatDate(
                                  point.start,
                                  locale,
                                  state.current?.interval === 'hour'
                                )}
                              </th>
                              <td>{formatNumber(point.usage.requests, locale)}</td>
                              <td>{formatNumber(point.usage.totalTokens, locale)}</td>
                              <td>{formatNumber(point.usage.failures, locale)}</td>
                              <td>
                                {formatBravoResponseTime(point.usage.averageLatencyMs, locale)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className={styles.breakdown}>
                    <div>
                      <h4>{t('bravo.analytics.breakdown_title')}</h4>
                      <p>{t('bravo.analytics.breakdown_hint')}</p>
                    </div>
                    {breakdownGroups.length === 0 ? (
                      <div className={styles.breakdownEmpty}>
                        {breakdownPartial
                          ? t('bravo.analytics.breakdown_not_collected')
                          : t('bravo.analytics.breakdown_empty')}
                      </div>
                    ) : (
                      <div className={styles.breakdownList}>
                        {breakdownGroups.map((group) => {
                          const subscription = group.subscription;
                          const identity = subscription
                            ? formatBravoSubscriptionRecord(subscription)
                            : formatBravoSubscription({
                                provider: group.provider,
                                note: group.note,
                                displayName: group.displayName,
                                label: group.label,
                                email: group.email,
                                workspace: group.workspace,
                                subscriptionId: group.subscriptionId,
                                authIndex: group.authIndex,
                              });
                          return (
                            <details key={group.subscriptionId}>
                              <summary>
                                <span>
                                  <strong title={identity.title}>{identity.title}</strong>
                                  <small title={identity.subtitle}>{identity.subtitle}</small>
                                </span>
                                <span>{formatNumber(group.usage.totalTokens, locale)}</span>
                                <span className={styles.chevron} aria-hidden="true">
                                  ›
                                </span>
                              </summary>
                              <div className={styles.modelRows}>
                                {group.models.length ? (
                                  group.models.map((row) => (
                                    <div
                                      key={[
                                        row.projectId,
                                        row.subscriptionId,
                                        row.provider,
                                        row.logicalModel,
                                        row.model,
                                      ].join(':')}
                                    >
                                      <span>
                                        <strong>
                                          {row.logicalModel
                                            ? `${row.logicalModel} → ${row.model}`
                                            : row.model}
                                        </strong>
                                        <small>{bravoProviderLabel(row.provider)}</small>
                                      </span>
                                      <span className={styles.modelMetric}>
                                        <small>{t('bravo.analytics.metrics.requests')}</small>
                                        <strong>{formatNumber(row.usage.requests, locale)}</strong>
                                      </span>
                                      <span className={styles.modelMetric}>
                                        <small>{t('bravo.analytics.metrics.tokens')}</small>
                                        <strong>
                                          {formatNumber(row.usage.totalTokens, locale)}
                                        </strong>
                                      </span>
                                      <span className={styles.modelMetric}>
                                        <small>{t('bravo.analytics.metrics.failures')}</small>
                                        <strong>{formatNumber(row.usage.failures, locale)}</strong>
                                      </span>
                                    </div>
                                  ))
                                ) : (
                                  <div className={styles.breakdownEmpty}>
                                    {t('bravo.analytics.model_breakdown_empty')}
                                  </div>
                                )}
                              </div>
                            </details>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          ) : null}
        </div>
      ) : null}
    </details>
  );
}
