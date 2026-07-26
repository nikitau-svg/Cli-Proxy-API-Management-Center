import { useCallback, useMemo, useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import {
  IconChevronDown,
  IconChevronUp,
  IconInfo,
  IconPlus,
  IconRefreshCw,
  IconTrash2,
} from '@/components/ui/icons';
import {
  bravoApi,
  type BravoRoute,
  type BravoRouteCandidate,
  type BravoRoutesResponse,
} from '@/services/api';
import { useNotificationStore } from '@/stores';
import { getErrorMessage } from '@/utils/helpers';
import styles from './BravoRouteEditor.module.scss';

const cloneRoute = (route: BravoRoute): BravoRoute => ({
  ...route,
  candidates: route.candidates.map((candidate) => ({
    ...candidate,
    capabilities: [...candidate.capabilities],
  })),
  defaultCandidates: route.defaultCandidates.map((candidate) => ({
    ...candidate,
    capabilities: [...candidate.capabilities],
  })),
});

const candidateKey = (candidate: Pick<BravoRouteCandidate, 'provider' | 'model'>): string =>
  `${encodeURIComponent(candidate.provider)}::${encodeURIComponent(candidate.model)}`;

const candidateLabel = (candidate: Pick<BravoRouteCandidate, 'provider' | 'model'>): string =>
  `${candidate.provider} · ${candidate.model}`;

const candidateIsImage = (candidate: BravoRouteCandidate): boolean =>
  candidate.capabilities.includes('image_generation') ||
  /(^|[-/])(image|dall-e)([-/]|$)/i.test(candidate.model);

const routeIsImage = (route: BravoRoute): boolean =>
  /(^|[-/])image([-/]|$)/i.test(route.id) || route.defaultCandidates.some(candidateIsImage);

export function BravoRouteEditor() {
  const { t } = useTranslation();
  const showNotification = useNotificationStore((state) => state.showNotification);
  const showConfirmation = useNotificationStore((state) => state.showConfirmation);
  const [opened, setOpened] = useState(false);
  const [response, setResponse] = useState<BravoRoutesResponse | null>(null);
  const [drafts, setDrafts] = useState<Record<string, BravoRoute>>({});
  const [addSelections, setAddSelections] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mutatingID, setMutatingID] = useState('');
  const [previewedID, setPreviewedID] = useState('');

  const applyResponse = useCallback((next: BravoRoutesResponse) => {
    setResponse(next);
    setDrafts(Object.fromEntries(next.routes.map((route) => [route.id, cloneRoute(route)])));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      applyResponse(await bravoApi.getRoutes());
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('bravo.routes.load_failed')));
    } finally {
      setLoading(false);
    }
  }, [applyResponse, t]);

  const handleToggle = (event: SyntheticEvent<HTMLDetailsElement>) => {
    const isOpen = event.currentTarget.open;
    setOpened(isOpen);
    if (isOpen && !response && !loading) void load();
  };

  const catalog = useMemo(() => {
    const result = new Map<string, BravoRouteCandidate>();
    response?.routes.forEach((route) => {
      [...route.defaultCandidates, ...route.candidates].forEach((candidate) => {
        result.set(candidateKey(candidate), candidate);
      });
    });
    return [...result.values()].sort((left, right) =>
      candidateLabel(left).localeCompare(candidateLabel(right))
    );
  }, [response]);

  const setDraft = (routeID: string, updater: (route: BravoRoute) => BravoRoute) => {
    setDrafts((current) => {
      const route = current[routeID];
      if (!route) return current;
      return { ...current, [routeID]: updater(route) };
    });
    setPreviewedID('');
  };

  const updateCandidate = (
    routeID: string,
    candidateIndex: number,
    patch: Partial<BravoRouteCandidate>
  ) => {
    setDraft(routeID, (route) => ({
      ...route,
      candidates: route.candidates.map((candidate, index) =>
        index === candidateIndex ? { ...candidate, ...patch } : candidate
      ),
    }));
  };

  const replaceProvider = (routeID: string, candidateIndex: number, provider: string) => {
    const route = drafts[routeID];
    if (!route) return;
    const replacement = catalog.find(
      (candidate) =>
        candidate.provider === provider && candidateIsImage(candidate) === routeIsImage(route)
    );
    updateCandidate(routeID, candidateIndex, {
      provider,
      model: replacement?.model ?? '',
      capabilities: replacement?.capabilities ?? [],
      id: `${provider}:${replacement?.model ?? ''}:${candidateIndex}`,
    });
  };

  const replaceModel = (routeID: string, candidateIndex: number, model: string) => {
    const route = drafts[routeID];
    const current = route?.candidates[candidateIndex];
    const replacement = catalog.find(
      (candidate) => candidate.provider === current?.provider && candidate.model === model
    );
    updateCandidate(routeID, candidateIndex, {
      model,
      capabilities: replacement?.capabilities ?? current?.capabilities ?? [],
    });
  };

  const moveCandidate = (routeID: string, from: number, to: number) => {
    setDraft(routeID, (route) => {
      if (to < 0 || to >= route.candidates.length) return route;
      const candidates = [...route.candidates];
      const [candidate] = candidates.splice(from, 1);
      if (!candidate) return route;
      candidates.splice(to, 0, candidate);
      return { ...route, candidates };
    });
  };

  const removeCandidate = (routeID: string, index: number) => {
    setDraft(routeID, (route) => ({
      ...route,
      candidates: route.candidates.filter((_, candidateIndex) => candidateIndex !== index),
    }));
  };

  const addCandidate = (routeID: string) => {
    const route = drafts[routeID];
    if (!route) return;
    const existing = new Set(route.candidates.map(candidateKey));
    const compatible = catalog.filter(
      (candidate) => candidateIsImage(candidate) === routeIsImage(route)
    );
    const selected =
      compatible.find((candidate) => candidateKey(candidate) === addSelections[routeID]) ??
      compatible.find((candidate) => !existing.has(candidateKey(candidate)));
    if (!selected || existing.has(candidateKey(selected))) return;
    setDraft(routeID, (current) => ({
      ...current,
      candidates: [
        ...current.candidates,
        {
          ...selected,
          id: `${selected.provider}:${selected.model}:${current.candidates.length}`,
          effort: '',
          priority: 0,
          enabled: true,
        },
      ],
    }));
  };

  const previewRoute = async (route: BravoRoute) => {
    if (!route.candidates.some((candidate) => candidate.enabled)) {
      showNotification(t('bravo.routes.validation_candidate'), 'warning');
      return;
    }
    setMutatingID(route.id);
    try {
      await bravoApi.previewRoute(route);
      setPreviewedID(route.id);
      showNotification(t('bravo.routes.preview_ok'), 'success');
    } catch (err: unknown) {
      showNotification(getErrorMessage(err, t('bravo.routes.preview_failed')), 'error');
    } finally {
      setMutatingID('');
    }
  };

  const saveRoute = async (route: BravoRoute) => {
    if (!route.candidates.some((candidate) => candidate.enabled)) {
      showNotification(t('bravo.routes.validation_candidate'), 'warning');
      return;
    }
    setMutatingID(route.id);
    try {
      await bravoApi.updateRoute(route);
      await load();
      showNotification(t('bravo.routes.saved'), 'success');
    } catch (err: unknown) {
      showNotification(getErrorMessage(err, t('bravo.routes.save_failed')), 'error');
    } finally {
      setMutatingID('');
    }
  };

  const resetRoute = (route: BravoRoute) => {
    showConfirmation({
      title: t('bravo.routes.reset_title'),
      message: t('bravo.routes.reset_confirm', { name: route.displayName }),
      confirmText: t('bravo.routes.reset'),
      variant: 'primary',
      onConfirm: async () => {
        setMutatingID(route.id);
        try {
          await bravoApi.resetRoute(route.id);
          await load();
          showNotification(t('bravo.routes.reset_done'), 'success');
        } catch (err: unknown) {
          showNotification(getErrorMessage(err, t('bravo.routes.reset_failed')), 'error');
        } finally {
          setMutatingID('');
        }
      },
    });
  };

  return (
    <details className={styles.editor} onToggle={handleToggle}>
      <summary>
        <span>
          <strong>{t('bravo.routes.title')}</strong>
          <small>{t('bravo.routes.subtitle')}</small>
        </span>
        <span className={styles.scope}>{t('bravo.routes.global_scope')}</span>
        <span className={styles.chevron} aria-hidden="true">
          ›
        </span>
      </summary>
      {opened ? (
        <div className={styles.body}>
          <div className={styles.safetyNote}>
            <IconInfo size={17} />
            <span>
              <strong>{t('bravo.routes.safety_title')}</strong>
              {t('bravo.routes.safety_note')}
            </span>
          </div>
          <div className={styles.toolbar}>
            <div>
              <strong>{t('bravo.routes.order_title')}</strong>
              <span>{t('bravo.routes.order_hint')}</span>
            </div>
            <Button variant="secondary" size="sm" onClick={() => void load()} loading={loading}>
              <IconRefreshCw size={15} />
              {t('common.refresh')}
            </Button>
          </div>

          {error ? (
            <div className={styles.error} role="alert">
              <span>{error}</span>
              <Button variant="secondary" size="sm" onClick={() => void load()}>
                {t('bravo.routes.retry')}
              </Button>
            </div>
          ) : null}
          {loading && !response ? (
            <div className={styles.loading} role="status">
              {t('bravo.routes.loading')}
            </div>
          ) : null}
          {response && response.routes.length === 0 ? (
            <div className={styles.empty}>{t('bravo.routes.empty')}</div>
          ) : null}

          <div className={styles.routes}>
            {response?.routes.map((serverRoute) => {
              const route = drafts[serverRoute.id] ?? serverRoute;
              const busy = mutatingID === route.id;
              const existing = new Set(route.candidates.map(candidateKey));
              const routeCatalog = catalog.filter(
                (candidate) => candidateIsImage(candidate) === routeIsImage(route)
              );
              const routeProviders = [
                ...new Map(
                  routeCatalog.map((candidate) => [
                    candidate.provider,
                    { value: candidate.provider, label: candidate.provider },
                  ])
                ).values(),
              ];
              const addOptions = routeCatalog
                .filter((candidate) => !existing.has(candidateKey(candidate)))
                .map((candidate) => ({
                  value: candidateKey(candidate),
                  label: candidateLabel(candidate),
                }));
              const changed =
                JSON.stringify(route.candidates) !== JSON.stringify(serverRoute.candidates);
              return (
                <details className={styles.route} key={route.id}>
                  <summary>
                    <span>
                      <strong>{route.displayName}</strong>
                      <code>{route.requestModel}</code>
                    </span>
                    <span className={route.overridden ? styles.overrideBadge : styles.defaultBadge}>
                      {route.overridden ? t('bravo.routes.overridden') : t('bravo.routes.default')}
                    </span>
                    <span className={styles.routeSummary}>
                      {t('bravo.routes.candidate_count', {
                        count: route.candidates.filter((candidate) => candidate.enabled).length,
                      })}
                    </span>
                    <span className={styles.chevron} aria-hidden="true">
                      ›
                    </span>
                  </summary>
                  <div className={styles.routeBody}>
                    {route.description ? <p>{route.description}</p> : null}
                    <div
                      className={styles.routePreview}
                      aria-label={t('bravo.routes.preview_chain')}
                    >
                      {route.candidates
                        .filter((candidate) => candidate.enabled)
                        .map((candidate, index) => (
                          <span key={`${candidate.id}:${index}`}>
                            {candidate.provider} · {candidate.model}
                            {candidate.effort
                              ? ` · ${t('bravo.routes.effort_short')} ${candidate.effort}`
                              : ''}
                          </span>
                        ))}
                    </div>

                    <div className={styles.candidates}>
                      {route.candidates.map((candidate, index) => {
                        const providerModels = [
                          ...new Set(
                            routeCatalog
                              .filter((entry) => entry.provider === candidate.provider)
                              .map((entry) => entry.model)
                          ),
                        ];
                        return (
                          <div
                            className={`${styles.candidate} ${
                              candidate.enabled ? '' : styles.candidateDisabled
                            }`}
                            key={`${candidate.id}:${index}`}
                          >
                            <span className={styles.rank}>{index + 1}</span>
                            <div className={styles.selectField}>
                              <label id={`provider-${route.id}-${index}`}>
                                {t('bravo.routes.provider')}
                              </label>
                              <Select
                                value={candidate.provider}
                                options={routeProviders}
                                onChange={(provider) => replaceProvider(route.id, index, provider)}
                                ariaLabelledBy={`provider-${route.id}-${index}`}
                                disabled={busy}
                                size="sm"
                              />
                            </div>
                            <div className={styles.selectField}>
                              <label id={`model-${route.id}-${index}`}>
                                {t('bravo.routes.model')}
                              </label>
                              <Select
                                value={candidate.model}
                                options={providerModels.map((model) => ({
                                  value: model,
                                  label: model,
                                }))}
                                onChange={(model) => replaceModel(route.id, index, model)}
                                ariaLabelledBy={`model-${route.id}-${index}`}
                                disabled={busy}
                                size="sm"
                              />
                            </div>
                            <div className={styles.selectField}>
                              <label id={`effort-${route.id}-${index}`}>
                                {t('bravo.routes.effort')}
                              </label>
                              <Select
                                value={candidate.effort}
                                options={response.efforts.map((effort) => ({
                                  value: effort,
                                  label: effort || t('bravo.routes.effort_auto'),
                                }))}
                                onChange={(effort) => updateCandidate(route.id, index, { effort })}
                                ariaLabelledBy={`effort-${route.id}-${index}`}
                                disabled={busy}
                                size="sm"
                              />
                            </div>
                            <ToggleSwitch
                              checked={candidate.enabled}
                              onChange={(enabled) => updateCandidate(route.id, index, { enabled })}
                              label={t('bravo.routes.enabled')}
                              disabled={busy}
                            />
                            <div className={styles.reorder}>
                              <button
                                type="button"
                                onClick={() => moveCandidate(route.id, index, index - 1)}
                                disabled={busy || index === 0}
                                aria-label={t('bravo.routes.move_up', {
                                  name: candidateLabel(candidate),
                                })}
                                title={t('bravo.routes.move_up_short')}
                              >
                                <IconChevronUp size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveCandidate(route.id, index, index + 1)}
                                disabled={busy || index === route.candidates.length - 1}
                                aria-label={t('bravo.routes.move_down', {
                                  name: candidateLabel(candidate),
                                })}
                                title={t('bravo.routes.move_down_short')}
                              >
                                <IconChevronDown size={16} />
                              </button>
                              <button
                                type="button"
                                className={styles.remove}
                                onClick={() => removeCandidate(route.id, index)}
                                disabled={busy}
                                aria-label={t('bravo.routes.remove_candidate', {
                                  name: candidateLabel(candidate),
                                })}
                                title={t('common.delete')}
                              >
                                <IconTrash2 size={15} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className={styles.addRow}>
                      <Select
                        value={addSelections[route.id] ?? addOptions[0]?.value ?? ''}
                        options={addOptions}
                        onChange={(value) =>
                          setAddSelections((current) => ({ ...current, [route.id]: value }))
                        }
                        placeholder={t('bravo.routes.add_placeholder')}
                        ariaLabel={t('bravo.routes.add_placeholder')}
                        disabled={busy || addOptions.length === 0}
                        size="sm"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => addCandidate(route.id)}
                        disabled={busy || addOptions.length === 0}
                      >
                        <IconPlus size={15} />
                        {t('bravo.routes.add')}
                      </Button>
                    </div>

                    <div className={styles.actions}>
                      <span role="status" aria-live="polite">
                        {previewedID === route.id
                          ? t('bravo.routes.preview_valid')
                          : changed
                            ? t('bravo.routes.unsaved')
                            : t('bravo.routes.saved_state')}
                      </span>
                      <div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => resetRoute(route)}
                          disabled={busy || !route.overridden}
                        >
                          {t('bravo.routes.reset')}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void previewRoute(route)}
                          loading={busy}
                        >
                          {t('bravo.routes.preview')}
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => void saveRoute(route)}
                          loading={busy}
                          disabled={!changed}
                        >
                          {t('common.save')}
                        </Button>
                      </div>
                    </div>
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      ) : null}
    </details>
  );
}
