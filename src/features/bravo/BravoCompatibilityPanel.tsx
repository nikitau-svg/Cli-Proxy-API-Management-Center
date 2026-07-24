import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import {
  IconAlertTriangle,
  IconCheckCircle2,
  IconCode,
  IconCopy,
  IconRefreshCw,
  IconSearch,
} from '@/components/ui/icons';
import {
  bravoApi,
  type BravoCompatibilityClassification,
  type BravoCompatibilityFixKind,
  type BravoCompatibilityModel,
  type BravoCompatibilityReason,
  type BravoCompatibilityResponse,
} from '@/services/api';
import { useAuthStore, useNotificationStore } from '@/stores';
import { copyToClipboard } from '@/utils/clipboard';
import { getErrorMessage } from '@/utils/helpers';
import {
  filterBravoCompatibilityModels,
  type BravoCompatibilityKindFilter,
  type BravoCompatibilityStatusFilter,
} from './bravoCompatibilityPresentation';
import styles from './BravoCompatibilityPanel.module.scss';

const classificationKind = (
  classification: BravoCompatibilityClassification
): BravoCompatibilityFixKind | null => {
  if (classification === 'code_fix') return 'code';
  if (classification === 'yaml_fix') return 'yaml';
  if (classification === 'route_fix') return 'route';
  return null;
};

const formatGeneratedAt = (value: string, locale: string): string => {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const humanize = (value: string): string =>
  value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export function BravoCompatibilityPanel() {
  const { t, i18n } = useTranslation();
  const connected = useAuthStore((state) => state.connectionStatus === 'connected');
  const showNotification = useNotificationStore((state) => state.showNotification);
  const [report, setReport] = useState<BravoCompatibilityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<BravoCompatibilityStatusFilter>('all');
  const [kindFilter, setKindFilter] = useState<BravoCompatibilityKindFilter>('all');
  const locale = i18n.resolvedLanguage || i18n.language || 'en';

  const load = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    setError('');
    try {
      setReport(await bravoApi.getCompatibility());
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('bravo.compatibility.load_failed')));
    } finally {
      setLoading(false);
    }
  }, [connected, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleModels = useMemo(
    () => filterBravoCompatibilityModels(report?.models ?? [], query, statusFilter, kindFilter),
    [kindFilter, query, report?.models, statusFilter]
  );

  const actionRequired = report?.summary.actionRequired ?? 0;
  const healthy = Boolean(report) && actionRequired === 0;
  const summaryText = loading
    ? t('bravo.compatibility.checking')
    : error
      ? t('bravo.compatibility.check_failed')
      : report
        ? healthy
          ? t('bravo.compatibility.all_supported', { count: report.summary.supported })
          : t('bravo.compatibility.action_summary', { count: actionRequired })
        : t('bravo.compatibility.not_checked');

  const copySnippet = async (snippet: string) => {
    const copied = await copyToClipboard(snippet);
    showNotification(
      copied ? t('bravo.compatibility.snippet_copied') : t('bravo.compatibility.copy_failed'),
      copied ? 'success' : 'error'
    );
  };

  const localizeReason = (
    reason: BravoCompatibilityReason,
    model: BravoCompatibilityModel
  ): string =>
    reason.code
      ? t(`bravo.compatibility.reason_codes.${reason.code}`, {
          defaultValue: reason.message,
          provider: model.provider,
          model: model.model,
        })
      : reason.message;

  return (
    <details
      className={`${styles.panel} ${
        error
          ? styles.panelError
          : healthy
            ? styles.panelHealthy
            : actionRequired > 0
              ? styles.panelAttention
              : ''
      }`}
    >
      <summary>
        <span className={styles.statusIcon} aria-hidden="true">
          {healthy ? <IconCheckCircle2 size={20} /> : <IconAlertTriangle size={20} />}
        </span>
        <span className={styles.summaryCopy}>
          <strong>{t('bravo.compatibility.title')}</strong>
          <small>{summaryText}</small>
        </span>
        {report ? (
          <span className={styles.summaryKinds} aria-label={t('bravo.compatibility.fix_counts')}>
            {report.summary.codeFix > 0 ? (
              <span className={styles.kindCode}>
                {t('bravo.compatibility.kinds.code')} {report.summary.codeFix}
              </span>
            ) : null}
            {report.summary.yamlFix > 0 ? (
              <span className={styles.kindYaml}>
                {t('bravo.compatibility.kinds.yaml')} {report.summary.yamlFix}
              </span>
            ) : null}
            {report.summary.routeFix > 0 ? (
              <span className={styles.kindRoute}>
                {t('bravo.compatibility.kinds.route')} {report.summary.routeFix}
              </span>
            ) : null}
          </span>
        ) : null}
        <span className={styles.chevron} aria-hidden="true">
          ›
        </span>
      </summary>

      <div className={styles.body}>
        <div className={styles.intro}>
          <div>
            <strong>{t('bravo.compatibility.intro_title')}</strong>
            <span>{t('bravo.compatibility.intro')}</span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void load()}
            loading={loading}
            disabled={!connected}
          >
            <IconRefreshCw size={15} />
            {t('bravo.compatibility.recheck')}
          </Button>
        </div>

        {error ? (
          <div className={styles.error} role="alert">
            <span>{error}</span>
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              {t('bravo.compatibility.retry')}
            </Button>
          </div>
        ) : null}
        {loading && !report ? (
          <div className={styles.loading} role="status">
            {t('bravo.compatibility.checking')}
          </div>
        ) : null}

        {report ? (
          <>
            <div className={styles.reportMeta}>
              <span>
                {t('bravo.compatibility.models_checked', { count: report.summary.total })}
              </span>
              <span
                className={
                  report.failClosed === true ? styles.failClosed : styles.failClosedUnknown
                }
              >
                {report.failClosed === true
                  ? t('bravo.compatibility.fail_closed')
                  : t('bravo.compatibility.fail_closed_unknown')}
              </span>
              {report.generatedAt ? (
                <span>
                  {t('bravo.compatibility.generated_at', {
                    time: formatGeneratedAt(report.generatedAt, locale),
                  })}
                </span>
              ) : null}
            </div>

            <div className={styles.filters}>
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                label={t('bravo.compatibility.search')}
                placeholder={t('bravo.compatibility.search_placeholder')}
                rightElement={<IconSearch size={16} aria-hidden="true" />}
              />
              <div className={styles.filterField}>
                <label id="bravo-compatibility-status">
                  {t('bravo.compatibility.status_filter')}
                </label>
                <Select
                  value={statusFilter}
                  options={[
                    { value: 'all', label: t('bravo.compatibility.filters.all') },
                    { value: 'action', label: t('bravo.compatibility.filters.action') },
                    { value: 'supported', label: t('bravo.compatibility.filters.supported') },
                  ]}
                  onChange={(value) => setStatusFilter(value as BravoCompatibilityStatusFilter)}
                  ariaLabelledBy="bravo-compatibility-status"
                />
              </div>
              <div className={styles.filterField}>
                <label id="bravo-compatibility-kind">{t('bravo.compatibility.kind_filter')}</label>
                <Select
                  value={kindFilter}
                  options={[
                    { value: 'all', label: t('bravo.compatibility.filters.all_fixes') },
                    { value: 'code', label: t('bravo.compatibility.kinds.code') },
                    { value: 'yaml', label: t('bravo.compatibility.kinds.yaml') },
                    { value: 'route', label: t('bravo.compatibility.kinds.route') },
                  ]}
                  onChange={(value) => setKindFilter(value as BravoCompatibilityKindFilter)}
                  ariaLabelledBy="bravo-compatibility-kind"
                />
              </div>
            </div>

            {visibleModels.length === 0 ? (
              <div className={styles.empty}>{t('bravo.compatibility.no_matches')}</div>
            ) : (
              <div className={styles.models}>
                {visibleModels.map((model) => {
                  const kind = classificationKind(model.classification);
                  const statusClass =
                    kind === 'code'
                      ? styles.kindCode
                      : kind === 'yaml'
                        ? styles.kindYaml
                        : kind === 'route'
                          ? styles.kindRoute
                          : model.classification === 'supported'
                            ? styles.kindSupported
                            : styles.kindUnknown;
                  return (
                    <details className={styles.model} key={`${model.provider}:${model.model}`}>
                      <summary>
                        <span className={styles.modelIdentity}>
                          <strong>{model.displayName}</strong>
                          <code>{model.model}</code>
                        </span>
                        <span className={styles.provider}>{model.provider}</span>
                        <span className={statusClass}>
                          {t(`bravo.compatibility.classifications.${model.classification}`)}
                        </span>
                        <span className={styles.modelMeta}>
                          {model.availableAccounts !== null
                            ? t('bravo.compatibility.accounts_routes', {
                                accounts: model.availableAccounts,
                                routes: model.routeIds.length,
                              })
                            : model.available === true
                              ? t('bravo.compatibility.available_routes', {
                                  routes: model.routeIds.length,
                                })
                              : model.available === false
                                ? t('bravo.compatibility.unavailable_routes', {
                                    routes: model.routeIds.length,
                                  })
                                : t('bravo.compatibility.routes_count', {
                                    routes: model.routeIds.length,
                                  })}
                        </span>
                        <span className={styles.chevron} aria-hidden="true">
                          ›
                        </span>
                      </summary>

                      <div className={styles.modelBody}>
                        <div className={styles.modelFacts}>
                          {model.baseModel ? (
                            <span>
                              {t('bravo.compatibility.base_model')}: <code>{model.baseModel}</code>
                            </span>
                          ) : null}
                          {model.routeIds.length > 0 ? (
                            <span>
                              {t('bravo.compatibility.routes')}:{' '}
                              <code>{model.routeIds.join(', ')}</code>
                            </span>
                          ) : null}
                        </div>

                        {Object.keys(model.detected).length > 0 ? (
                          <div className={styles.detected}>
                            <strong>{t('bravo.compatibility.detected_title')}</strong>
                            <div>
                              {Object.entries(model.detected).map(([flag, enabled]) => (
                                <span
                                  className={enabled ? styles.detectedYes : styles.detectedNo}
                                  key={flag}
                                >
                                  {t(`bravo.compatibility.detected.${flag}`, {
                                    defaultValue: humanize(flag),
                                  })}
                                  :{' '}
                                  {enabled
                                    ? t('bravo.compatibility.yes')
                                    : t('bravo.compatibility.no')}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {model.reasons.length > 0 ? (
                          <div className={styles.reasons}>
                            <strong>{t('bravo.compatibility.why')}</strong>
                            <ul>
                              {model.reasons.map((reason, index) => (
                                <li key={`${reason.code}:${index}`}>
                                  {reason.code ? <code>{reason.code}</code> : null}
                                  <span>{localizeReason(reason, model)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {model.fixes.length > 0 ? (
                          <div className={styles.fixes}>
                            {model.fixes.map((fix, index) => {
                              const fixTitle = fix.code
                                ? t(`bravo.compatibility.fix_codes.${fix.code}`, {
                                    defaultValue: fix.title,
                                    provider: model.provider,
                                    model: model.model,
                                  })
                                : fix.title;
                              const matchedReason = model.reasons.find(
                                (reason) => reason.message === fix.reason
                              );
                              const matchedReasons = matchedReason
                                ? [matchedReason]
                                : (fix.reasonCodes ?? []).flatMap((code) =>
                                    model.reasons.filter((reason) => reason.code === code)
                                  );
                              const targetLabels =
                                fix.targets && fix.targets.length > 0
                                  ? fix.targets
                                  : fix.target
                                    ? [fix.target]
                                    : [];
                              return (
                                <article
                                  className={styles.fix}
                                  key={`${fix.kind}:${fix.code || fix.title}:${index}`}
                                >
                                  <div className={styles.fixHeading}>
                                    <span
                                      className={
                                        fix.kind === 'code'
                                          ? styles.kindCode
                                          : fix.kind === 'yaml'
                                            ? styles.kindYaml
                                            : styles.kindRoute
                                      }
                                    >
                                      {t(`bravo.compatibility.kinds.${fix.kind}`)}
                                    </span>
                                    <strong>{fixTitle}</strong>
                                    <span className={styles.manualBadge}>
                                      <IconCode size={14} />
                                      {t('bravo.compatibility.manual_review')}
                                    </span>
                                  </div>
                                  {fix.reason ? (
                                    <p>
                                      {matchedReasons.length > 0
                                        ? matchedReasons
                                            .map((reason) => localizeReason(reason, model))
                                            .join(' ')
                                        : fix.reason}
                                    </p>
                                  ) : null}
                                  {targetLabels.length > 0 ? (
                                    <div className={styles.target}>
                                      <span>{t('bravo.compatibility.target')}</span>
                                      {targetLabels.map((target) => (
                                        <code key={target}>{target}</code>
                                      ))}
                                    </div>
                                  ) : null}
                                  {fix.snippet ? (
                                    <div className={styles.snippet}>
                                      <div>
                                        <span>{fix.format || fix.kind}</span>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => void copySnippet(fix.snippet)}
                                          aria-label={t('bravo.compatibility.copy_snippet', {
                                            title: fixTitle,
                                          })}
                                        >
                                          <IconCopy size={14} />
                                          {t('common.copy')}
                                        </Button>
                                      </div>
                                      <pre>
                                        <code>{fix.snippet}</code>
                                      </pre>
                                    </div>
                                  ) : null}
                                </article>
                              );
                            })}
                          </div>
                        ) : model.classification === 'supported' ? (
                          <div className={styles.supportedNote}>
                            <IconCheckCircle2 size={17} />
                            {t('bravo.compatibility.no_fix_needed')}
                          </div>
                        ) : (
                          <div className={styles.emptyFix}>
                            {t('bravo.compatibility.no_suggestion')}
                          </div>
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </>
        ) : null}
      </div>
    </details>
  );
}
