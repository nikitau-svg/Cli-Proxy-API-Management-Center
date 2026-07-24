import { describe, expect, mock, test } from 'bun:test';

mock.module('../src/services/api/client', () => ({
  apiClient: {},
}));

const bravoModule = import('../src/services/api/bravo');

describe('Bravo API normalization', () => {
  test('keeps missing and invalid quota percentages unknown instead of coercing them to zero', async () => {
    const { normalizeBravoProjectsResponse } = await bravoModule;
    const result = normalizeBravoProjectsResponse({
      subscriptions: [
        {
          auth_index: 'claude:team-a',
          provider: 'claude',
          quota: {
            confidence: 'unknown',
            session: {},
            weekly: { remaining_percent: 'not-a-number' },
          },
        },
      ],
    });

    expect(result.subscriptions[0]?.quota.confidence).toBe('unknown');
    expect(result.subscriptions[0]?.quota.session.remainingPercent).toBeNull();
    expect(result.subscriptions[0]?.quota.weekly.remainingPercent).toBeNull();
  });

  test('preserves an explicit confirmed zero and normalizes snake-case policy fields', async () => {
    const { normalizeBravoProjectsResponse } = await bravoModule;
    const result = normalizeBravoProjectsResponse({
      subscriptions: [
        {
          auth_index: 'codex:personal',
          auth_id: 'opaque-id',
          provider: 'codex',
          effective_tariff: 'x5',
          primary_project_ids: ['project-a'],
          quota: {
            confidence: 'confirmed',
            observed_at: '2026-07-23T10:00:00Z',
            session: {
              used_percent: 100,
              remaining_percent: 0,
              eligible: false,
              reason: 'reserve_floor',
            },
            weekly: { remaining_percent: 42, eligible: true },
          },
        },
      ],
      tariffs: [
        {
          id: 'x5',
          multiplier: 5,
          session_floor_percent: 30,
          weekly_floor_percent: 25,
          reservation_percent: 0.5,
        },
      ],
    });

    expect(result.subscriptions[0]?.quota.session.remainingPercent).toBe(0);
    expect(result.subscriptions[0]?.quota.session.eligible).toBe(false);
    expect(result.subscriptions[0]?.primaryProjectIds).toEqual(['project-a']);
    expect(result.tariffs[0]).toEqual({
      id: 'x5',
      multiplier: 5,
      sessionFloorPercent: 30,
      weeklyFloorPercent: 25,
      reservationPercent: 0.5,
    });
  });

  test('normalizes quota reset modes and drops inactive or sentinel reset timestamps', async () => {
    const { normalizeBravoProjectsResponse } = await bravoModule;
    const result = normalizeBravoProjectsResponse({
      subscriptions: [
        {
          auth_index: 'claude:inactive',
          quota: {
            session: {
              reset_mode: 'inactive',
              reset_at: '0001-01-01T00:00:00Z',
            },
            weekly: {
              reset_mode: 'not_applicable',
              reset_at: '2026-08-01T12:00:00Z',
            },
            model_weekly: [
              {
                model: 'opus',
                reset_mode: 'scheduled',
                reset_at: '0001-01-01T00:00:00Z',
              },
            ],
          },
        },
      ],
    });

    const quota = result.subscriptions[0]?.quota;
    expect(quota?.session.resetMode).toBe('inactive');
    expect(quota?.session.resetAt).toBeNull();
    expect(quota?.weekly.resetMode).toBe('not_applicable');
    expect(quota?.weekly.resetAt).toBeNull();
    expect(quota?.modelWeekly[0]?.resetMode).toBe('scheduled');
    expect(quota?.modelWeekly[0]?.resetAt).toBeNull();
  });

  test('merges project and pool endpoints without inventing missing collections', async () => {
    const { mergeBravoResponses, normalizeBravoProjectsResponse } = await bravoModule;
    const projects = normalizeBravoProjectsResponse({
      projects: [
        {
          id: 'project-a',
          name: 'A',
          models: ['*'],
          primary_auth_ids: ['claude:team-a'],
        },
      ],
      models: ['opus'],
    });
    const pool = normalizeBravoProjectsResponse({
      subscriptions: [{ auth_index: 'claude:team-a' }],
      tariffs: [{ id: 'x1', multiplier: 1 }],
    });

    const result = mergeBravoResponses(projects, pool);
    expect(result.projects).toHaveLength(1);
    expect(result.models).toHaveLength(1);
    expect(result.subscriptions).toHaveLength(1);
    expect(result.tariffs).toHaveLength(1);
  });

  test('normalizes the allowed pool separately from its primary subset and safe analytics ids', async () => {
    const { normalizeBravoProjectsResponse, serializeBravoProject } = await bravoModule;
    const result = normalizeBravoProjectsResponse({
      projects: [
        {
          id: 'project-a',
          name: 'A',
          allowed_auth_ids: ['claude:personal', 'codex:pro'],
          primary_auth_ids: ['codex:pro'],
        },
      ],
      subscriptions: [
        {
          auth_index: 'codex:pro',
          analytics_id: 'sub_4be9',
        },
      ],
    });

    expect(result.projects[0]?.allowedAuthIds).toEqual(['claude:personal', 'codex:pro']);
    expect(result.projects[0]?.primaryAuthIds).toEqual(['codex:pro']);
    expect(result.subscriptions[0]?.analyticsId).toBe('sub_4be9');
    expect(
      serializeBravoProject({
        id: 'project-a',
        name: 'A',
        models: ['*'],
        allowedAuthIds: ['claude:personal', 'codex:pro'],
        primaryAuthIds: ['codex:pro'],
      })
    ).toMatchObject({
      allowed_auth_ids: ['claude:personal', 'codex:pro'],
      primary_auth_ids: ['codex:pro'],
    });
  });

  test('decodes provider display entities without changing opaque identities', async () => {
    const { normalizeBravoProjectsResponse } = await bravoModule;
    const result = normalizeBravoProjectsResponse({
      subscriptions: [
        {
          auth_index: 'claude:opaque&#39;identity',
          auth_id: 'auth&amp;opaque',
          analytics_id: 'sub_4be9',
          provider: 'claude',
          label: 'Nick &amp; Team',
          email: 'nick&#64;example.test',
          workspace: 'Nick&#39;s Organization',
          plan: 'Pro &lt;x1&gt;',
        },
      ],
    });

    expect(result.subscriptions[0]).toMatchObject({
      authIndex: 'claude:opaque&#39;identity',
      authId: 'auth&amp;opaque',
      analyticsId: 'sub_4be9',
      label: 'Nick & Team',
      email: 'nick@example.test',
      workspace: "Nick's Organization",
      plan: 'Pro <x1>',
    });
  });

  test('normalizes analytics coverage, series and cross-dimensional breakdown', async () => {
    const { normalizeBravoAnalyticsResponse } = await bravoModule;
    const result = normalizeBravoAnalyticsResponse({
      schema_version: 2,
      from: '2026-07-01T00:00:00Z',
      to: '2026-07-08T00:00:00Z',
      bucket: 'day',
      coverage_from: '2026-06-01T00:00:00Z',
      breakdown_coverage_from: '2026-07-05T00:00:00Z',
      summary: {
        requests: 10,
        failures: 2,
        input_tokens: 100,
        output_tokens: 50,
        reasoning_tokens: 25,
        latency_ms: 5000,
      },
      series: [
        {
          start: '2026-07-01T00:00:00Z',
          end: '2026-07-02T00:00:00Z',
          usage: { requests: 3, total_tokens: 60 },
        },
      ],
      breakdown: {
        subscriptions: [
          {
            subscription_id: 'sub_safe',
            provider: 'codex',
            usage: { total_tokens: 175 },
          },
        ],
        project_subscription_models: [
          {
            project_id: 'project-a',
            subscription_id: 'sub_safe',
            provider: 'codex',
            logical_model: 'bravo/sol',
            model: 'gpt-5.6-sol',
            usage: { total_tokens: 175 },
          },
        ],
      },
    });

    expect(result.interval).toBe('day');
    expect(result.breakdownCoverageFrom).toBe('2026-07-05T00:00:00Z');
    expect(result.summary.totalTokens).toBe(175);
    expect(result.summary.averageLatencyMs).toBe(500);
    expect(result.summary.failureRatePercent).toBe(20);
    expect(result.series[0]?.usage.totalTokens).toBe(60);
    expect(result.breakdown.subscriptions[0]?.subscriptionId).toBe('sub_safe');
    expect(result.breakdown.projectSubscriptionModels[0]?.logicalModel).toBe('bravo/sol');
    expect(result.breakdown.projectSubscriptionModels[0]?.model).toBe('gpt-5.6-sol');
  });

  test('keeps capability metadata internal and never sends it in a route update', async () => {
    const { normalizeBravoRoutesResponse, serializeBravoRoute } = await bravoModule;
    const result = normalizeBravoRoutesResponse({
      efforts: ['', 'low', 'xhigh'],
      routes: [
        {
          id: 'opus',
          request_model: 'bravo/opus',
          display_name: 'Bravo Opus',
          overridden: true,
          candidates: [
            {
              provider: 'codex',
              model: 'gpt-5.6-sol',
              effort: 'xhigh',
              priority: 90,
              capabilities: ['vision', 'tools'],
            },
            {
              provider: 'claude',
              model: 'claude-opus-4-8',
              priority: 100,
              capabilities: ['vision'],
            },
          ],
          default_candidates: [
            {
              provider: 'claude',
              model: 'claude-opus-4-8',
              priority: 100,
              capabilities: ['vision'],
            },
          ],
        },
      ],
    });

    expect(result.routes[0]?.candidates.map((candidate) => candidate.provider)).toEqual([
      'claude',
      'codex',
    ]);
    expect(result.providers).toEqual([
      { id: 'claude', label: 'claude', models: ['claude-opus-4-8'] },
      { id: 'codex', label: 'codex', models: ['gpt-5.6-sol'] },
    ]);
    expect(result.routes[0]?.candidates[0]?.capabilities).toEqual(['vision']);
    const payload = serializeBravoRoute(result.routes[0]!);
    expect(payload.candidates).toEqual([
      { provider: 'claude', model: 'claude-opus-4-8' },
      { provider: 'codex', model: 'gpt-5.6-sol', effort: 'xhigh' },
    ]);
    expect(Object.keys(payload.candidates[0] ?? {})).not.toContain('capabilities');
    expect(Object.keys(payload.candidates[0] ?? {})).not.toContain('priority');

    const withoutPriorities = normalizeBravoRoutesResponse({
      routes: [
        {
          id: 'sonnet',
          candidates: [
            { provider: 'claude', model: 'claude-sonnet' },
            { provider: 'codex', model: 'gpt-terra' },
          ],
        },
      ],
    });
    expect(withoutPriorities.routes[0]?.candidates.map((candidate) => candidate.provider)).toEqual([
      'claude',
      'codex',
    ]);
  });
});
