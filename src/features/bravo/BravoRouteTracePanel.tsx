import { useCallback, useMemo, useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { IconRefreshCw } from '@/components/ui/icons';
import {
  bravoApi,
  type BravoProject,
  type BravoTrace,
  type BravoTraceAttempt,
  type BravoTracesResponse,
} from '@/services/api';
import { getErrorMessage } from '@/utils/helpers';
import { formatBravoResponseTime } from './bravoAnalyticsPresentation';
import styles from './BravoRouteTracePanel.module.scss';

interface BravoRouteTracePanelProps {
  projects: BravoProject[];
}

const TRACE_LIMIT = 50;

const formatTraceTime = (value: string, locale: string): string => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value || '—';
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
};

const formatNumber = (value: number, locale: string): string =>
  new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);

const traceStatusClass = (trace: BravoTrace): 'success' | 'failure' =>
  trace.success ? 'success' : 'failure';

const attemptStatusClass = (attempt: BravoTraceAttempt): 'success' | 'failure' =>
  attempt.success ? 'success' : 'failure';

const formatOptionalTime = (value: number | null, locale: string): string =>
  value === null ? '—' : formatBravoResponseTime(value, locale);

export function BravoRouteTracePanel({ projects }: BravoRouteTracePanelProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language || 'en';
  const [opened, setOpened] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [result, setResult] = useState<BravoTracesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const projectNames = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects]
  );
  const projectOptions = useMemo(
    () => [
      { value: '', label: t('bravo.traces.all_projects') },
      ...projects.map((project) => ({ value: project.id, label: project.name || project.id })),
    ],
    [projects, t]
  );

  const load = useCallback(
    async (nextProjectId = projectId, nextErrorsOnly = errorsOnly) => {
      setLoading(true);
      setError('');
      try {
        setResult(
          await bravoApi.getTraces({
            projectId: nextProjectId,
            errorsOnly: nextErrorsOnly,
            limit: TRACE_LIMIT,
          })
        );
      } catch (err: unknown) {
        setError(getErrorMessage(err, t('bravo.traces.load_failed')));
      } finally {
        setLoading(false);
      }
    },
    [errorsOnly, projectId, t]
  );

  const handleToggle = (event: SyntheticEvent<HTMLDetailsElement>) => {
    const nextOpened = event.currentTarget.open;
    setOpened(nextOpened);
    if (nextOpened && result === null && !loading) {
      void load();
    }
  };

  const handleProjectChange = (nextProjectId: string) => {
    setProjectId(nextProjectId);
    if (opened) void load(nextProjectId, errorsOnly);
  };

  const handleErrorsOnlyChange = (nextErrorsOnly: boolean) => {
    setErrorsOnly(nextErrorsOnly);
    if (opened) void load(projectId, nextErrorsOnly);
  };

  const renderAttempt = (attempt: BravoTraceAttempt, index: number) => {
    const subscription = attempt.subscriptionLabel || attempt.subscriptionId || '—';
    const hasContext =
      attempt.requiredInputTokens !== null || attempt.supportedInputTokens !== null;
    const hasTimings =
      attempt.latencyMs !== null || attempt.ttfbMs !== null || attempt.firstContentMs !== null;
    return (
      <details className={styles.attempt} key={`${attempt.provider}:${attempt.model}:${index}`}>
        <summary>
          <span className={styles.attemptIdentity}>
            <strong>
              #{attempt.ordinal || index + 1} · {attempt.provider || '—'}{' '}
              <span aria-hidden="true">→</span>{' '}
              {attempt.model || '—'}{' '}
              <span aria-hidden="true">→</span> {subscription}
            </strong>
            {attempt.errorMessage ? <small>{attempt.errorMessage}</small> : null}
          </span>
          <span className={styles.attemptMetrics}>
            <span className={styles[attemptStatusClass(attempt)]}>
              {t('bravo.traces.status', { status: attempt.status || '—' })}
            </span>
            {attempt.decision ? (
              <span>
                {t(`bravo.traces.decision_${attempt.decision}`, {
                  defaultValue: attempt.decision,
                })}
              </span>
            ) : null}
            {hasContext ? (
              <span>
                {t('bravo.traces.context', {
                  required:
                    attempt.requiredInputTokens === null
                      ? '—'
                      : formatNumber(attempt.requiredInputTokens, locale),
                  limit:
                    attempt.supportedInputTokens === null
                      ? '—'
                      : formatNumber(attempt.supportedInputTokens, locale),
                })}
              </span>
            ) : null}
            {hasTimings ? (
              <span>
                {t('bravo.traces.attempt_timing', {
                  duration: formatOptionalTime(attempt.latencyMs, locale),
                  ttfb: formatOptionalTime(attempt.ttfbMs, locale),
                  firstContent: formatOptionalTime(attempt.firstContentMs, locale),
                })}
              </span>
            ) : null}
          </span>
          <span className={styles.chevron} aria-hidden="true">
            ›
          </span>
        </summary>
        <div className={styles.attemptDetail}>
          {attempt.at ? <span>{formatTraceTime(attempt.at, locale)}</span> : null}
          {attempt.errorCode ? <code>{attempt.errorCode}</code> : null}
          {attempt.failureClass ? <code>{attempt.failureClass}</code> : null}
          {attempt.requestedEffort || attempt.effectiveEffort ? (
            <span>
              {t('bravo.traces.effort', {
                requested: attempt.requestedEffort || '—',
                effective: attempt.effectiveEffort || '—',
              })}
            </span>
          ) : null}
          {attempt.committed ? <strong>{t('bravo.traces.committed')}</strong> : null}
          {attempt.retryAfter ? (
            <span>{t('bravo.traces.retry_after', { value: attempt.retryAfter })}</span>
          ) : null}
        </div>
      </details>
    );
  };

  return (
    <details className={styles.traces} onToggle={handleToggle}>
      <summary>
        <span>
          <strong>{t('bravo.traces.title')}</strong>
          <small>{t('bravo.traces.subtitle')}</small>
        </span>
        <span className={styles.summaryValue}>
          {result
            ? t('bravo.traces.count', { count: result.traces.length })
            : t('bravo.traces.open')}
        </span>
        <span className={styles.chevron} aria-hidden="true">
          ›
        </span>
      </summary>

      {opened ? (
        <div className={styles.body}>
          <div className={styles.toolbar}>
            <Select
              value={projectId}
              options={projectOptions}
              onChange={handleProjectChange}
              ariaLabel={t('bravo.traces.project_filter')}
              size="sm"
            />
            <div className={styles.toolbarActions}>
              <ToggleSwitch
                checked={errorsOnly}
                onChange={handleErrorsOnlyChange}
                label={t('bravo.traces.errors_only')}
                ariaLabel={t('bravo.traces.errors_only')}
                disabled={loading}
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void load()}
                loading={loading}
              >
                <IconRefreshCw size={15} />
                {t('common.refresh')}
              </Button>
            </div>
          </div>

          {error ? (
            <div className={styles.error} role="alert">
              <span>{error}</span>
              <Button variant="secondary" size="sm" onClick={() => void load()}>
                {t('bravo.traces.retry')}
              </Button>
            </div>
          ) : null}
          {result?.warning ? (
            <div className={styles.warning} role="status">
              {result.warning}
            </div>
          ) : null}
          {loading && result === null ? (
            <div className={styles.loading} role="status">
              {t('bravo.traces.loading')}
            </div>
          ) : null}
          {result && result.traces.length === 0 ? (
            <div className={styles.empty}>{t('bravo.traces.empty')}</div>
          ) : null}
          {result?.traces.length ? (
            <div className={styles.list}>
              {result.traces.map((trace) => (
                <article className={styles.trace} key={trace.traceId}>
                  <div className={styles.traceHeading}>
                    <span>
                      <strong>
                        {projectNames.get(trace.projectId) || trace.projectId || '—'}
                      </strong>
                      <small>{formatTraceTime(trace.startedAt, locale)}</small>
                    </span>
                    <span className={styles.traceModel}>{trace.logicalModel || '—'}</span>
                    <span className={styles.traceStatus}>
                      <span className={styles[traceStatusClass(trace)]}>
                        {t('bravo.traces.status', { status: trace.status || '—' })}
                      </span>
                      <small>
                        {t('bravo.traces.total_duration', {
                          duration: formatBravoResponseTime(trace.totalLatencyMs ?? 0, locale),
                        })}
                      </small>
                    </span>
                  </div>
                  {trace.finalMessage ? (
                    <p className={styles.finalMessage}>{trace.finalMessage}</p>
                  ) : null}
                  {trace.clientAction && trace.clientAction !== 'none' ? (
                    <p className={styles.clientAction}>
                      {t(`bravo.traces.action_${trace.clientAction}`, {
                        defaultValue: trace.clientAction,
                      })}
                    </p>
                  ) : null}
                  {trace.attempts.length ? (
                    <div className={styles.attempts}>
                      {trace.attempts.map(renderAttempt)}
                    </div>
                  ) : (
                    <div className={styles.noAttempts}>{t('bravo.traces.no_attempts')}</div>
                  )}
                </article>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </details>
  );
}
