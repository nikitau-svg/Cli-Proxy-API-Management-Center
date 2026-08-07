import { describe, expect, mock, test } from 'bun:test';

mock.module('../src/services/api/client', () => ({
  apiClient: {},
}));

const bravoModule = import('../src/services/api/bravo');
const readSource = (relativePath: string) =>
  Bun.file(new URL(relativePath, import.meta.url)).text();

describe('Bravo model credits presentation', () => {
  test('normalizes only safe model issue fields from the subscription API', async () => {
    const { normalizeBravoProjectsResponse } = await bravoModule;
    const response = normalizeBravoProjectsResponse({
      subscriptions: [
        {
          auth_index: 'palantir',
          provider: 'claude',
          health: 'ready',
          model_issues: [
            {
              model: 'claude-fable-5',
              provider_error_code: 'credits_required',
              provider_model: 'claude-fable-5',
              provider_model_display_name: 'Fable 5',
              provider_notice_title: "You've hit your monthly spend limit",
              provider_notice_text:
                'Ask your admin to raise your spend limit, or switch models to continue this chat.',
              provider_disabled_reason: 'org_level_disabled_until',
              provider_error_reason: 'monthly_spend_limit',
              scope: 'model',
              observed_at: '2026-07-27T02:11:17Z',
              request_id: 'req_must_be_ignored',
              has_chargeable_saved_payment_method: true,
            },
            {
              model: 'claude-fable-5',
              provider_error_code: 'request_scoped',
              scope: 'model',
              request_id: 'req_unknown_code_must_be_ignored',
            },
            {
              model: 'claude-fable-5',
              provider_error_code: 'credits_required',
              scope: 'account',
            },
          ],
        },
      ],
    });

    expect(response.subscriptions[0]?.modelIssues).toEqual([
      {
        model: 'claude-fable-5',
        providerErrorCode: 'credits_required',
        providerModel: 'claude-fable-5',
        providerModelDisplayName: 'Fable 5',
        providerNoticeTitle: "You've hit your monthly spend limit",
        providerNoticeText:
          'Ask your admin to raise your spend limit, or switch models to continue this chat.',
        providerDisabledReason: 'org_level_disabled_until',
        providerErrorReason: 'monthly_spend_limit',
        scope: 'model',
        retryAt: '',
        observedAt: '2026-07-27T02:11:17Z',
      },
    ]);
    expect(JSON.stringify(response.subscriptions[0])).not.toContain('req_must_be_ignored');
    expect(JSON.stringify(response.subscriptions[0])).not.toContain(
      'has_chargeable_saved_payment_method'
    );
    expect(JSON.stringify(response.subscriptions[0])).not.toContain(
      'req_unknown_code_must_be_ignored'
    );
  });

  test('drops invalid provider timestamps instead of rendering Invalid Date', async () => {
    const { normalizeBravoProjectsResponse } = await bravoModule;
    const response = normalizeBravoProjectsResponse({
      subscriptions: [
        {
          auth_index: 'palantir',
          model_issues: [
            {
              model: 'claude-fable-5',
              provider_error_code: 'credits_required',
              scope: 'model',
              retry_at: 'not-a-timestamp',
              observed_at: 'req_must_not_become_a_timestamp',
            },
          ],
        },
      ],
    });

    expect(response.subscriptions[0]?.modelIssues[0]?.retryAt).toBe('');
    expect(response.subscriptions[0]?.modelIssues[0]?.observedAt).toBe('');
  });

  test('fails closed when an allowed provider text field embeds private diagnostics', async () => {
    const { normalizeBravoProjectsResponse } = await bravoModule;
    const response = normalizeBravoProjectsResponse({
      subscriptions: [
        {
          auth_index: 'palantir',
          model_issues: [
            {
              model: 'claude-fable-5',
              provider_error_code: 'credits_required',
              scope: 'model',
              provider_model_display_name: 'Fable 5 requestId=req_private',
              provider_notice_title: 'authorization=Bearer private',
              provider_notice_text: '{"request_id":"req_private"}',
            },
          ],
        },
      ],
    });

    const issue = response.subscriptions[0]?.modelIssues[0];
    expect(issue?.providerModelDisplayName).toBe('');
    expect(issue?.providerNoticeTitle).toBe('');
    expect(issue?.providerNoticeText).toBe('');
    expect(JSON.stringify(issue)).not.toContain('req_private');
    expect(JSON.stringify(issue)).not.toContain('Bearer private');
  });

  test('renders a collapsed model warning with localized operator copy', async () => {
    const [page, styles, en, ru, zhCN, zhTW] = await Promise.all([
      readSource('../src/features/bravo/BravoAdminPage.tsx'),
      readSource('../src/features/bravo/BravoAdminPage.module.scss'),
      readSource('../src/i18n/locales/en.json'),
      readSource('../src/i18n/locales/ru.json'),
      readSource('../src/i18n/locales/zh-CN.json'),
      readSource('../src/i18n/locales/zh-TW.json'),
    ]);

    expect(page).toContain('subscription.modelIssues.length');
    expect(page).toContain('styles.modelIssueBadge');
    expect(page).toContain('styles.modelIssueList');
    expect(page).toContain('bravo.subscriptions.model_issues.credits_required');
    const modelIssueMarkup = page.slice(
      page.indexOf('<div className={styles.modelIssueList}>'),
      page.indexOf('</section>', page.indexOf('<div className={styles.modelIssueList}>'))
    );
    expect(modelIssueMarkup).toContain('<strong>{message}</strong>');
    expect(modelIssueMarkup).toContain('bravo.subscriptions.model_issues_fallback');
    expect(modelIssueMarkup).not.toContain('issue.providerDisabledReason');
    expect(modelIssueMarkup).not.toContain('issue.providerErrorReason');
    expect(modelIssueMarkup).not.toContain('issue.retryAt');
    expect(modelIssueMarkup).not.toContain('<code>');
    expect(modelIssueMarkup).not.toContain('<strong>{modelName}</strong>');
    expect(page).toContain('subscription.quota.error && subscription.modelIssues.length === 0');
    const technicalMarkup = page.slice(
      page.indexOf('<details className={styles.technicalDetails}>'),
      page.indexOf('</details>', page.indexOf('<details className={styles.technicalDetails}>'))
    );
    expect(technicalMarkup).toContain('issue.providerErrorCode');
    expect(technicalMarkup).toContain('issue.providerDisabledReason');
    expect(technicalMarkup).toContain('issue.providerErrorReason');
    expect(technicalMarkup).toContain('issue.retryAt');
    expect(technicalMarkup).toContain('styles.modelIssueTechnicalRow');
    expect(technicalMarkup).toContain('<dt>quota_error</dt>');
    expect(page).toContain(
      '<details className={styles.subscription} key={subscription.authIndex}>'
    );
    expect(page).not.toContain(
      '<details open className={styles.subscription} key={subscription.authIndex}>'
    );
    expect(styles).toContain('.modelIssueBadge');
    expect(styles).toContain('.modelIssueList');
    expect(styles).toContain('.modelIssueTechnicalRow dd');
    expect(styles).toContain('overflow-wrap: anywhere');
    expect(en).toContain('"models_limited"');
    expect(ru).toContain('"models_limited"');
    expect(ru).toContain('У модели {{model}} исчерпан месячный лимит расходов.');
    expect(zhCN).toContain('"models_limited"');
    expect(zhCN).toContain('每月消费限额');
    expect(zhTW).toContain('"models_limited"');
    expect(zhTW).toContain('每月消費限額');
  });
});
