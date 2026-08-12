import { describe, expect, test } from 'bun:test';

const readSource = (relativePath: string) =>
  Bun.file(new URL(relativePath, import.meta.url)).text();

describe('Bravo project key endpoint help', () => {
  test('shows copyable project limits and effective route commands in the one-time dialog', async () => {
    const [page, russian, english] = await Promise.all([
      readSource('../src/features/bravo/BravoAdminPage.tsx'),
      readSource('../src/i18n/locales/ru.json'),
      readSource('../src/i18n/locales/en.json'),
    ]);

    expect(page).toContain('limitsStatusCommand');
    expect(page).toContain('routesStatusCommand');
    expect(page).toContain("'bravo.key.limits_status_copied'");
    expect(page).toContain("'bravo.key.routes_status_copied'");
    expect(russian).toContain('usage за 30 дней');
    expect(russian).toContain('Фактический роутинг моделей');
    expect(english).toContain('30-day usage');
    expect(english).toContain('Effective model routing');
  });
});
