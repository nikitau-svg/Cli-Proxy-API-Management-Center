import type {
  BravoQuotaConsumptionPlan,
  BravoQuotaConsumptionPool,
  BravoQuotaConsumptionProject,
  BravoQuotaConsumptionWindow,
} from '@/services/api';

export type BravoQuotaCapacityStatus = 'collecting' | 'add' | 'spare' | 'balanced';

export interface BravoQuotaCompositionSegment {
  kind: 'project' | 'unassigned' | 'external';
  projectId: string;
  percentagePoints: number;
  widthPercent: number;
}

const kindOrder: Record<string, number> = {
  session: 0,
  weekly: 1,
  model_weekly: 2,
};

export const bravoQuotaConsumptionWindowKey = (
  window: Pick<BravoQuotaConsumptionWindow, 'provider' | 'kind' | 'quotaModel'>
): string => `${window.provider}\u0000${window.kind}\u0000${window.quotaModel}`;

export const sortBravoQuotaConsumptionWindows = (
  windows: BravoQuotaConsumptionWindow[]
): BravoQuotaConsumptionWindow[] =>
  [...windows].sort((left, right) => {
    const provider = left.provider.localeCompare(right.provider);
    if (provider !== 0) return provider;
    const kind = (kindOrder[left.kind] ?? 99) - (kindOrder[right.kind] ?? 99);
    if (kind !== 0) return kind;
    return left.quotaModel.localeCompare(right.quotaModel);
  });

export const bravoQuotaTopPlan = (
  project: BravoQuotaConsumptionProject
): BravoQuotaConsumptionPlan | null =>
  [...project.plans].sort((left, right) => right.attributedPercent - left.attributedPercent)[0] ??
  null;

export const bravoQuotaCapacityStatus = (
  confidence: BravoQuotaConsumptionWindow['confidence'],
  plan: BravoQuotaConsumptionPlan | null
): BravoQuotaCapacityStatus => {
  if (!plan || confidence === 'collecting' || confidence === 'low') return 'collecting';
  if (plan.estimatedAdditionalAtPeakPace >= 0.25) return 'add';
  if (plan.estimatedSpareAtPeakPace >= 1) return 'spare';
  return 'balanced';
};

export const bravoQuotaComposition = (
  pool: BravoQuotaConsumptionPool | null,
  projects: BravoQuotaConsumptionProject[]
): BravoQuotaCompositionSegment[] => {
  if (!pool) return [];
  const values: Array<Omit<BravoQuotaCompositionSegment, 'widthPercent'>> = projects
    .filter((project) => project.attributedPercent > 0)
    .map((project) => ({
      kind: 'project' as const,
      projectId: project.projectId,
      percentagePoints: project.attributedPercent,
    }));
  if (pool.attributedLocalUnassignedPercent > 0) {
    values.push({
      kind: 'unassigned',
      projectId: '',
      percentagePoints: pool.attributedLocalUnassignedPercent,
    });
  }
  if (pool.externalOrEstimatorGapPercent > 0) {
    values.push({
      kind: 'external',
      projectId: '',
      percentagePoints: pool.externalOrEstimatorGapPercent,
    });
  }
  const total = Math.max(
    pool.observedDropPercent,
    values.reduce((sum, item) => sum + item.percentagePoints, 0),
    0
  );
  if (total <= 0) return [];
  return values.map((item) => ({
    ...item,
    widthPercent: (item.percentagePoints / total) * 100,
  }));
};
