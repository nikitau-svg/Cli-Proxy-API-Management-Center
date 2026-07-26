import { describe, expect, test } from 'bun:test';
import { filterBravoCompatibilityModels } from '../src/features/bravo/bravoCompatibilityPresentation';
import type { BravoCompatibilityModel } from '../src/services/api/bravo';

const compatibilityModel = (patch: Partial<BravoCompatibilityModel>): BravoCompatibilityModel => ({
  provider: 'claude',
  model: 'claude-sonnet-5',
  displayName: 'Claude Sonnet 5',
  classification: 'supported',
  baseModel: '',
  routeIds: [],
  availableAccounts: null,
  catalog: true,
  available: true,
  detected: {},
  reasons: [],
  targets: [],
  requiredFixes: [],
  fixes: [],
  ...patch,
});

describe('Bravo compatibility presentation', () => {
  const models = [
    compatibilityModel({
      model: 'claude-opus-5',
      displayName: 'Claude Opus 5',
      classification: 'code_fix',
      routeIds: ['opus', 'deep'],
      reasons: [{ code: 'host_missing', message: 'Host catalog entry is missing' }],
      fixes: [
        {
          code: 'register_model',
          kind: 'code',
          title: 'Register model',
          reason: 'Host catalog entry is missing',
          target: 'models.json',
          format: 'json',
          snippet: '{}',
          safeToApplyAutomatically: false,
        },
      ],
    }),
    compatibilityModel({
      provider: 'codex',
      model: 'gpt-future',
      displayName: 'GPT Future',
      classification: 'route_fix',
      fixes: [
        {
          code: 'add_route',
          kind: 'route',
          title: 'Add frontier fallback',
          reason: 'No logical route selects it',
          target: 'bravo/frontier',
          format: 'yaml',
          snippet: 'model: gpt-future',
          safeToApplyAutomatically: false,
        },
      ],
    }),
    compatibilityModel({}),
  ];

  test('filters action-required and supported models independently', () => {
    expect(
      filterBravoCompatibilityModels(models, '', 'action', 'all').map((model) => model.model)
    ).toEqual(['claude-opus-5', 'gpt-future']);
    expect(
      filterBravoCompatibilityModels(models, '', 'supported', 'all').map((model) => model.model)
    ).toEqual(['claude-sonnet-5']);
  });

  test('searches routes, reasons and fix targets while respecting fix type', () => {
    expect(
      filterBravoCompatibilityModels(models, 'host catalog', 'all', 'code').map(
        (model) => model.model
      )
    ).toEqual(['claude-opus-5']);
    expect(
      filterBravoCompatibilityModels(models, 'frontier', 'all', 'route').map((model) => model.model)
    ).toEqual(['gpt-future']);
  });

  test('keeps required fix kinds visible even when no safe suggestion can be generated', () => {
    const routeFull = compatibilityModel({
      model: 'claude-route-full',
      classification: 'yaml_fix',
      requiredFixes: ['yaml_fix', 'route_fix'],
      fixes: [],
    });

    expect(filterBravoCompatibilityModels([routeFull], '', 'all', 'route')).toEqual([routeFull]);
  });
});
