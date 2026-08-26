import { describe, expect, mock, test } from 'bun:test';

const apiGetCalls: Array<{ url: string; config: unknown }> = [];

mock.module('../src/services/api/client', () => ({
  apiClient: {
    get: async (url: string, config: unknown) => {
      apiGetCalls.push({ url, config });
      return { traces: [] };
    },
  },
}));

const bravoModule = import('../src/services/api/bravo');

describe('Bravo API normalization', () => {
  test('normalizes one-time project status and route endpoints with safe defaults', async () => {
    const { normalizeBravoKeyIssueResponse } = await bravoModule;
    const explicit = normalizeBravoKeyIssueResponse({
      project: { id: 'project-a', name: 'Alpha' },
      plaintext_key: 'brv_secret',
      project_api: {
        limits: { endpoint: '/v1/bravo/limits-v2' },
        routes: { endpoint: '/v1/bravo/routes-v2' },
      },
    });
    expect(explicit.plaintextKey).toBe('brv_secret');
    expect(explicit.projectApi).toEqual({
      limitsEndpoint: '/v1/bravo/limits-v2',
      routesEndpoint: '/v1/bravo/routes-v2',
    });

    const fallback = normalizeBravoKeyIssueResponse({ plaintext_key: 'brv_old_server' });
    expect(fallback.projectApi).toEqual({
      limitsEndpoint: '/v1/bravo/limits',
      routesEndpoint: '/v1/bravo/routes',
    });
  });

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

  test('normalizes polling settings and persistent provider request counters', async () => {
    const { normalizeBravoProjectsResponse } = await bravoModule;
    const result = normalizeBravoProjectsResponse({
      quota_polling: {
        usage_interval_seconds: 900,
        minimum_interval_seconds: 300,
        maximum_interval_seconds: 86400,
        profile_interval_seconds: 21600,
        usage_requests: { attempts: 12, success: 9, failure: 3 },
        profile_requests: { attempts: 4, success: 4, failure: 0 },
      },
      adaptive_allocator: {
        mode: 'observe',
        effect: 'shadow_only',
        routing_enforced: false,
        additional_provider_requests: false,
        quota_snapshot_source: 'existing_background_cache',
        cooling_half_life_seconds: 300,
        cooling_max_age_seconds: 1800,
        tracked_accounts: 2,
        tracked_commitments: 7,
        raw_pending_percent: 4.5,
        effective_pending_percent: 2.25,
        maximum_learned_scale: 1.8,
      },
      adaptive_audit: {
        status: 'ok',
        verdict: 'ready_for_review',
        verdict_message: 'Расхождений не обнаружено.',
        mode: 'observe',
        requests_observed: 41,
        actual_execution_attempts: 46,
        requests_with_fallback: 5,
        would_admit_attempts: 40,
        would_withhold_attempts: 6,
        successful_would_withhold: 0,
        quota_failures_would_admit: 0,
        routing_changes_applied: 0,
        additional_provider_requests: 0,
        queue_capacity: 1024,
        disk_limit_bytes: 8388608,
      },
      subscriptions: [
        {
          auth_index: 'claude:polling',
          quota: {
            refresh: {
              attempt_count: 8,
              success_count: 6,
              failure_count: 2,
              last_attempt_at: '2026-08-07T12:00:00Z',
            },
          },
          profile_refresh: { attempt_count: 3, success_count: 3 },
        },
      ],
    });

    expect(result.quotaPolling.usageIntervalSeconds).toBe(900);
    expect(result.quotaPolling.usageRequests).toEqual({
      attempts: 12,
      success: 9,
      failure: 3,
    });
    expect(result.adaptiveAllocator).toMatchObject({
      mode: 'observe',
      effect: 'shadow_only',
      routingEnforced: false,
      additionalProviderRequests: false,
      coolingHalfLifeSeconds: 300,
      coolingMaxAgeSeconds: 1800,
      trackedAccounts: 2,
      effectivePendingPercent: 2.25,
      maximumLearnedScale: 1.8,
    });
    expect(result.adaptiveAudit).toMatchObject({
      status: 'ok',
      verdict: 'ready_for_review',
      requestsObserved: 41,
      actualExecutionAttempts: 46,
      requestsWithFallback: 5,
      successfulWouldWithhold: 0,
      routingChangesApplied: 0,
      additionalProviderRequests: 0,
      diskLimitBytes: 8388608,
    });
    expect(result.subscriptions[0]?.quota.refresh.attemptCount).toBe(8);
    expect(result.subscriptions[0]?.profileRefresh.successCount).toBe(3);
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
          prompt_cache: {
            anthropic_ttl: '1h',
            openai_mode: 'provider_managed',
          },
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
    expect(result.projects[0]?.promptCache).toEqual({
      anthropicTtl: '1h',
      openaiMode: 'provider_managed',
    });
    expect(result.subscriptions[0]?.analyticsId).toBe('sub_4be9');
    expect(
      serializeBravoProject({
        id: 'project-a',
        name: 'A',
        models: ['*'],
        allowedAuthIds: ['claude:personal', 'codex:pro'],
        primaryAuthIds: ['codex:pro'],
        promptCache: { anthropicTtl: '1h' },
      })
    ).toMatchObject({
      allowed_auth_ids: ['claude:personal', 'codex:pro'],
      primary_auth_ids: ['codex:pro'],
      prompt_cache: { anthropic_ttl: '1h' },
    });
  });

  test('keeps the backend automatic policy when an older project omits cache policy', async () => {
    const { normalizeBravoProjectsResponse } = await bravoModule;
    const result = normalizeBravoProjectsResponse({
      projects: [{ id: 'legacy-project', name: 'Legacy', models: ['*'] }],
    });

    expect(result.projects[0]?.promptCache).toEqual({
      anthropicTtl: 'auto',
      openaiMode: 'provider_managed',
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
          note: 'Nick &amp; primary',
          display_name: 'Nick &amp; Team Account',
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
      note: 'Nick & primary',
      displayName: 'Nick & Team Account',
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
        average_ttft_ms: 280,
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
    expect(result.summary.averageTtftMs).toBe(280);
    expect(result.summary.failureRatePercent).toBe(20);
    expect(result.series[0]?.usage.totalTokens).toBe(60);
    expect(result.subscriptionTimeline).toEqual([]);
    expect(result.breakdown.subscriptions[0]?.subscriptionId).toBe('sub_safe');
    expect(result.breakdown.projectSubscriptionModels[0]?.logicalModel).toBe('bravo/sol');
    expect(result.breakdown.projectSubscriptionModels[0]?.model).toBe('gpt-5.6-sol');
  });

  test('keeps TTFT optional for older analytics responses', async () => {
    const { normalizeBravoAnalyticsResponse } = await bravoModule;
    const result = normalizeBravoAnalyticsResponse({
      summary: { requests: 1, latency_ms: 500 },
    });

    expect(result.summary.averageTtftMs).toBeUndefined();
  });

  test('normalizes safe route traces without inventing sensitive fields', async () => {
    const { normalizeBravoTracesResponse } = await bravoModule;
    const result = normalizeBravoTracesResponse({
      schema_version: 1,
      retention_days: 30,
      warning: 'История восстановлена из последнего безопасного снимка.',
      traces: [
        {
          trace_id: 'trace_safe',
          started_at: '2026-08-07T10:00:00Z',
          project_id: 'project-a',
          logical_model: 'bravo/opus',
          status: 502,
          success: false,
          outcome: 'failed',
          client_action: 'retry',
          final_message: 'Все доступные маршруты временно недоступны.',
          total_latency_ms: 3200,
          attempts: [
            {
              ordinal: 1,
              at: '2026-08-07T10:00:01Z',
              provider: 'claude',
              model: 'claude-opus-4-8',
              subscription_id: 'claude:team-a',
              subscription_label: 'Team A',
              status: 429,
              outcome: 'failed',
              decision: 'fallback',
              committed: false,
              requested_effort: 'high',
              effective_effort: 'xhigh',
              failure_class: 'quota',
              retry_after: '60',
              error_message: 'Лимит подписки временно исчерпан.',
              required_input_tokens: 190000,
              supported_input_tokens: 128000,
              latency_ms: 1200,
              ttfb_ms: 420,
              first_content_ms: 650,
            },
          ],
        },
      ],
    });

    expect(result.retentionDays).toBe(30);
    expect(result.warning).toBe('История восстановлена из последнего безопасного снимка.');
    expect(result.traces[0]).toMatchObject({
      traceId: 'trace_safe',
      projectId: 'project-a',
      logicalModel: 'bravo/opus',
      status: 502,
      success: false,
      outcome: 'failed',
      clientAction: 'retry',
      totalLatencyMs: 3200,
      finalMessage: 'Все доступные маршруты временно недоступны.',
    });
    expect(result.traces[0]?.attempts[0]).toEqual({
      ordinal: 1,
      at: '2026-08-07T10:00:01Z',
      provider: 'claude',
      model: 'claude-opus-4-8',
      subscriptionId: 'claude:team-a',
      subscriptionLabel: 'Team A',
      status: 429,
      success: false,
      outcome: 'failed',
      decision: 'fallback',
      committed: false,
      requestedEffort: 'high',
      effectiveEffort: 'xhigh',
      latencyMs: 1200,
      ttfbMs: 420,
      firstContentMs: 650,
      errorCode: '',
      errorMessage: 'Лимит подписки временно исчерпан.',
      failureClass: 'quota',
      retryAfter: '60',
      requiredInputTokens: 190000,
      supportedInputTokens: 128000,
    });
  });

  test('requests safe route traces with the documented filters and bounded limit', async () => {
    const { bravoApi } = await bravoModule;
    await bravoApi.getTraces({ projectId: 'project-a', errorsOnly: true, limit: 25 });

    expect(apiGetCalls.pop()).toEqual({
      url: '/bravo/traces',
      config: {
        params: {
          project_id: 'project-a',
          errors_only: true,
          limit: 25,
        },
      },
    });
  });

  test('normalizes the optional subscription timeline without trusting malformed rows', async () => {
    const { normalizeBravoAnalyticsResponse } = await bravoModule;
    const result = normalizeBravoAnalyticsResponse({
      subscription_timeline: [
        {
          start: '2026-07-26T18:00:00Z',
          end: '2026-07-26T19:00:00Z',
          subscription_id: 'sub_safe',
          auth_index: 'claude:team-a',
          provider: 'claude',
          note: 'Primary &amp; shared',
          display_name: 'Team &lt;A&gt;',
          label: 'legacy',
          workspace: 'Ascetix &amp; Team',
          email: 'nikita&#64;example.test',
          usage: {
            requests: 3,
            total_tokens: 1200,
            cache_read_tokens: 900,
            failures: 1,
            average_latency_ms: 10874,
          },
        },
        {
          start: '2026-07-26T18:00:00Z',
          provider: 'codex',
        },
      ],
    });

    expect(result.subscriptionTimeline).toHaveLength(1);
    expect(result.subscriptionTimeline[0]).toMatchObject({
      start: '2026-07-26T18:00:00Z',
      subscriptionId: 'sub_safe',
      authIndex: 'claude:team-a',
      provider: 'claude',
      note: 'Primary & shared',
      displayName: 'Team <A>',
      label: 'legacy',
      workspace: 'Ascetix & Team',
      email: 'nikita@example.test',
    });
    expect(result.subscriptionTimeline[0]?.usage.cacheReadTokens).toBe(900);
    expect(result.subscriptionTimeline[0]?.usage.averageLatencyMs).toBe(10874);
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

  test('normalizes the compatibility advisor contract and links suggestions to targets', async () => {
    const { normalizeBravoCompatibilityResponse } = await bravoModule;
    const result = normalizeBravoCompatibilityResponse({
      schema_version: 1,
      generated_at: '2026-07-24T12:00:00Z',
      fail_closed: true,
      summary: {
        total: 2,
        supported: 1,
        code_fix: 1,
        yaml_fix: 0,
        route_fix: 0,
        action_required: 1,
      },
      models: [
        {
          provider: 'claude',
          model: 'claude-opus-5',
          display_name: 'Claude Opus 5',
          classification: 'code_fix',
          base_model: 'claude-opus',
          route_ids: ['opus', 'deep'],
          available_accounts: ['team-a', 'personal'],
          catalog: false,
          available: true,
          detected: { provider_catalog: true, bravo_catalog: false },
          reasons: [
            {
              code: 'host_catalog_missing',
              message: 'The host catalog does not declare this model.',
            },
          ],
          required_fixes: ['code'],
          targets: [
            {
              kind: 'code',
              path: 'internal/registry/models/models.json',
              selector: 'claude',
            },
          ],
          suggested_fixes: [
            {
              code: 'register_model',
              kind: 'code',
              title: 'Register the physical model',
              format: 'json',
              snippet: '{ "id": "claude-opus-5" }',
              safe_to_apply_automatically: false,
            },
          ],
        },
        {
          provider: 'claude',
          model: 'claude-sonnet-5',
          classification: 'supported',
          reasons: ['Verified by the current capability profile.'],
        },
      ],
    });

    expect(result.failClosed).toBe(true);
    expect(result.summary.actionRequired).toBe(1);
    expect(result.models[0]).toMatchObject({
      classification: 'code_fix',
      baseModel: 'claude-opus',
      routeIds: ['opus', 'deep'],
      availableAccounts: 2,
      catalog: false,
      available: true,
      detected: { provider_catalog: true, bravo_catalog: false },
      requiredFixes: ['code'],
    });
    expect(result.models[0]?.fixes[0]).toEqual({
      code: 'register_model',
      kind: 'code',
      title: 'Register the physical model',
      reason: 'The host catalog does not declare this model.',
      reasonCodes: [],
      target: 'internal/registry/models/models.json · claude',
      targets: ['internal/registry/models/models.json · claude'],
      format: 'json',
      snippet: '{ "id": "claude-opus-5" }',
      safeToApplyAutomatically: false,
    });
    expect(result.models[1]?.reasons[0]?.message).toBe(
      'Verified by the current capability profile.'
    );
    expect(result.models[1]?.availableAccounts).toBeNull();
    expect(result.models[1]?.available).toBeNull();
  });

  test('keeps every compatibility suggestion linked to its own reason and route target', async () => {
    const { normalizeBravoCompatibilityResponse } = await bravoModule;
    const result = normalizeBravoCompatibilityResponse({
      models: [
        {
          provider: 'claude',
          model: 'claude-opus-5',
          classification: 'route_fix',
          reasons: [
            {
              code: 'bravo_route_assignment_missing',
              message: 'Recommended logical route "deep" does not use Claude Opus 5.',
            },
            {
              code: 'bravo_route_assignment_missing',
              message: 'Recommended logical route "opus" does not use Claude Opus 5.',
            },
          ],
          targets: [
            {
              kind: 'route',
              path: '/v0/management/bravo/routes',
              selector: 'deep',
            },
            {
              kind: 'route',
              path: '/v0/management/bravo/routes',
              selector: 'opus',
            },
          ],
          suggested_fixes: [
            {
              code: 'preview_route_assignment',
              kind: 'route',
              title: 'Preview opus',
              reason: 'Recommended logical route "opus" does not use Claude Opus 5.',
              reason_codes: ['bravo_route_assignment_missing'],
              targets: [
                {
                  kind: 'route',
                  path: '/v0/management/bravo/routes',
                  selector: 'opus',
                },
              ],
              snippet: '{"id":"opus"}',
            },
            {
              code: 'preview_route_assignment',
              kind: 'route',
              title: 'Preview deep',
              reason: 'Recommended logical route "deep" does not use Claude Opus 5.',
              reason_codes: ['bravo_route_assignment_missing'],
              targets: [
                {
                  kind: 'route',
                  path: '/v0/management/bravo/routes',
                  selector: 'deep',
                },
              ],
              snippet: '{"id":"deep"}',
            },
          ],
        },
      ],
    });

    expect(result.models[0]?.fixes).toMatchObject([
      {
        title: 'Preview opus',
        reason: 'Recommended logical route "opus" does not use Claude Opus 5.',
        reasonCodes: ['bravo_route_assignment_missing'],
        target: '/v0/management/bravo/routes · opus',
        targets: ['/v0/management/bravo/routes · opus'],
      },
      {
        title: 'Preview deep',
        reason: 'Recommended logical route "deep" does not use Claude Opus 5.',
        reasonCodes: ['bravo_route_assignment_missing'],
        target: '/v0/management/bravo/routes · deep',
        targets: ['/v0/management/bravo/routes · deep'],
      },
    ]);
  });

  test('accepts the compact compatibility shape and derives missing summary counters', async () => {
    const { normalizeBravoCompatibilityResponse } = await bravoModule;
    const result = normalizeBravoCompatibilityResponse({
      models: [
        {
          provider: 'codex',
          model: 'gpt-new',
          status: 'needs_route',
          routes: ['frontier'],
          required_fixes: [
            {
              kind: 'route',
              title: 'Add the candidate',
              reason: 'The physical model is not used by a logical route.',
              target: 'bravo/frontier',
              snippet: 'model: gpt-new',
            },
          ],
        },
      ],
    });

    expect(result.summary).toEqual({
      total: 1,
      supported: 0,
      codeFix: 0,
      yamlFix: 0,
      routeFix: 1,
      actionRequired: 1,
    });
    expect(result.models[0]?.classification).toBe('route_fix');
    expect(result.models[0]?.fixes[0]).toMatchObject({
      kind: 'route',
      title: 'Add the candidate',
      target: 'bravo/frontier',
    });
  });

  test('normalizes subscription quota attribution, model pace, and capacity recommendations', async () => {
    const { normalizeBravoAnalyticsResponse } = await bravoModule;
    const result = normalizeBravoAnalyticsResponse({
      quota_consumption: {
        unit: 'subscription_quota_percentage_points',
        status: 'available',
        windows_independent: true,
        shared_pool_visible: true,
        coverage_from: '2026-08-01T00:00:00Z',
        windows: [
          {
            provider: 'claude',
            kind: 'weekly',
            confidence: 'high',
            shared_pool: {
              samples: 12,
              subscription_hours: 24,
              observed_drop_percent: 20,
              attributed_project_percent: 15,
              external_or_estimator_gap_percent: 5,
              average_observed_pp_per_subscription_hour: 0.83,
              forecast_backtest: {
                provider: 'claude',
                window_kind: 'weekly',
                status: 'available',
                paired_intervals: 14,
                skipped_uncalibrated_intervals: 2,
                skipped_no_local_intervals: 3,
                coverage_seconds: 21600,
                predicted_drop_percent: 12.5,
                actual_drop_percent: 15,
                mean_predicted_pp_per_interval: 0.893,
                mean_actual_pp_per_interval: 1.071,
                mean_bias_pp_per_interval: 0.178,
                mean_absolute_error_pp_per_interval: 0.22,
                underprediction_percent: 3.1,
                overprediction_percent: 0.6,
                underprediction_intervals: 5,
                overprediction_intervals: 4,
                conservative_coverage_percent: 64.3,
                underprediction_p95_percent: 0.5,
                maximum_underprediction_percent: 0.8,
              },
            },
            projects: [
              {
                rank: 1,
                project_id: 'project-a',
                commitments: 20,
                attributed_percent: 15,
                share_of_attributed_pool_percent: 100,
                average_pp_per_hour: 0.63,
                peak_hourly_pp: 4,
                subscription_windows_consumed: 0.15,
                base_x1_equivalent_windows: 0.75,
                models: [
                  {
                    provider: 'claude',
                    model: 'claude-fable-5',
                    logical_model: 'bravo/fable',
                    effort: 'max',
                    tariff_id: 'x5',
                    share_of_project_percent: 80,
                  },
                ],
                plans: [
                  {
                    tariff_id: 'x5',
                    multiplier: 5,
                    current_subscriptions: 1,
                    estimated_subscriptions_at_peak_pace: 1.4,
                    estimated_additional_at_peak_pace: 0.4,
                    suggested_action: 'Add capacity.',
                  },
                ],
                signals: ['Fable max dominates consumption.'],
              },
            ],
          },
        ],
      },
    });

    expect(result.quotaConsumption).toMatchObject({
      status: 'available',
      windowsIndependent: true,
      sharedPoolVisible: true,
      coverageFrom: '2026-08-01T00:00:00Z',
    });
    expect(result.quotaConsumption.windows[0]?.sharedPool).toMatchObject({
      samples: 12,
      observedDropPercent: 20,
      attributedProjectPercent: 15,
      externalOrEstimatorGapPercent: 5,
    });
    expect(result.quotaConsumption.windows[0]?.sharedPool?.forecastBacktest).toMatchObject({
      provider: 'claude',
      windowKind: 'weekly',
      status: 'available',
      pairedIntervals: 14,
      skippedUncalibratedIntervals: 2,
      skippedNoLocalIntervals: 3,
      meanPredictedPPPerInterval: 0.893,
      meanActualPPPerInterval: 1.071,
      meanBiasPPPerInterval: 0.178,
      meanAbsoluteErrorPPPerInterval: 0.22,
      conservativeCoveragePercent: 64.3,
      underpredictionP95Percent: 0.5,
      maximumUnderpredictionPercent: 0.8,
    });
    expect(result.quotaConsumption.windows[0]?.projects[0]).toMatchObject({
      rank: 1,
      projectId: 'project-a',
      shareOfAttributedPoolPercent: 100,
      peakHourlyPP: 4,
    });
    expect(result.quotaConsumption.windows[0]?.projects[0]?.models[0]).toMatchObject({
      model: 'claude-fable-5',
      logicalModel: 'bravo/fable',
      effort: 'max',
      tariffId: 'x5',
    });
    expect(result.quotaConsumption.windows[0]?.projects[0]?.plans[0]).toMatchObject({
      currentSubscriptions: 1,
      estimatedSubscriptionsAtPeakPace: 1.4,
      estimatedAdditionalAtPeakPace: 0.4,
    });
  });

  test('requests pool analytics without sending an empty project filter', async () => {
    const { bravoApi } = await bravoModule;
    await bravoApi.getAnalytics({
      from: '2026-08-01T00:00:00Z',
      to: '2026-08-08T00:00:00Z',
      interval: 'day',
    });

    expect(apiGetCalls.pop()).toEqual({
      url: '/bravo/analytics',
      config: {
        params: {
          from: '2026-08-01T00:00:00Z',
          to: '2026-08-08T00:00:00Z',
          interval: 'day',
        },
      },
    });
  });
});
