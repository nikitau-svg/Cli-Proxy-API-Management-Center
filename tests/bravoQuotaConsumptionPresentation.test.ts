import { describe, expect, test } from 'bun:test';
import {
  bravoQuotaCapacityStatus,
  bravoQuotaComposition,
  bravoQuotaConsumptionWindowKey,
  sortBravoQuotaConsumptionWindows,
} from '../src/features/bravo/bravoQuotaConsumptionPresentation';
import type {
  BravoQuotaConsumptionPlan,
  BravoQuotaConsumptionPool,
  BravoQuotaConsumptionProject,
  BravoQuotaConsumptionWindow,
} from '../src/services/api/bravo';

const pool: BravoQuotaConsumptionPool = {
  samples: 10,
  skippedResetOrIncreaseSamples: 0,
  subscriptionHours: 20,
  observedDropPercent: 20,
  attributedProjectPercent: 12,
  attributedLocalUnassignedPercent: 3,
  externalOrEstimatorGapPercent: 5,
  averageObservedPPPerSubscriptionHour: 1,
  averageExternalPPPerSubscriptionHour: 0.25,
};

const project = (id: string, attributedPercent: number): BravoQuotaConsumptionProject => ({
  rank: 1,
  projectId: id,
  commitments: 1,
  estimatedPercent: attributedPercent,
  attributedPercent,
  shareOfAttributedPoolPercent: 0,
  averagePPPerHour: 0,
  peakHourlyPP: 0,
  subscriptionWindowsConsumed: attributedPercent / 100,
  baseX1EquivalentWindows: attributedPercent / 100,
  models: [],
  plans: [],
  signals: [],
});

const plan = (patch: Partial<BravoQuotaConsumptionPlan>): BravoQuotaConsumptionPlan => ({
  tariffId: 'x5',
  multiplier: 5,
  attributedPercent: 10,
  baseX1EquivalentWindows: 0.5,
  averagePPPerHour: 1,
  peakHourlyPP: 2,
  estimatedSubscriptionsAtAveragePace: 0.5,
  estimatedSubscriptionsAtPeakPace: 1,
  currentSubscriptions: 1,
  estimatedAdditionalAtPeakPace: 0,
  estimatedSpareAtPeakPace: 0,
  suggestedAction: '',
  ...patch,
});

describe('Bravo subscription quota consumption presentation', () => {
  test('sorts independent session, weekly, and model windows predictably', () => {
    const windows = [
      { provider: 'claude', kind: 'model_weekly', quotaModel: 'fable' },
      { provider: 'claude', kind: 'weekly', quotaModel: '' },
      { provider: 'claude', kind: 'session', quotaModel: '' },
    ] as BravoQuotaConsumptionWindow[];

    const sorted = sortBravoQuotaConsumptionWindows(windows);
    expect(sorted.map((window) => window.kind)).toEqual(['session', 'weekly', 'model_weekly']);
    expect(bravoQuotaConsumptionWindowKey(sorted[2])).toBe('claude\u0000model_weekly\u0000fable');
  });

  test('keeps projects, unassigned local work, and external consumption visible', () => {
    const segments = bravoQuotaComposition(pool, [project('alpha', 8), project('beta', 4)]);

    expect(segments.map((segment) => segment.kind)).toEqual([
      'project',
      'project',
      'unassigned',
      'external',
    ]);
    expect(segments.reduce((sum, segment) => sum + segment.widthPercent, 0)).toBeCloseTo(100);
    expect(segments.at(-1)).toMatchObject({ percentagePoints: 5, widthPercent: 25 });
  });

  test('does not recommend capacity changes before confidence is sufficient', () => {
    expect(bravoQuotaCapacityStatus('low', plan({ estimatedAdditionalAtPeakPace: 2 }))).toBe(
      'collecting'
    );
    expect(bravoQuotaCapacityStatus('high', plan({ estimatedAdditionalAtPeakPace: 0.4 }))).toBe(
      'add'
    );
    expect(bravoQuotaCapacityStatus('medium', plan({ estimatedSpareAtPeakPace: 1.2 }))).toBe(
      'spare'
    );
    expect(bravoQuotaCapacityStatus('high', plan({}))).toBe('balanced');
  });
});
