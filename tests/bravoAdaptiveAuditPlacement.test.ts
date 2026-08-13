import { describe, expect, test } from 'bun:test';

const readSource = (relativePath: string) =>
  Bun.file(new URL(relativePath, import.meta.url)).text();

describe('Bravo adaptive shadow audit placement', () => {
  test('keeps the accumulated audit visible outside the collapsed subscription pool', async () => {
    const page = await readSource('../src/features/bravo/BravoAdminPage.tsx');
    const audit = page.indexOf('styles.adaptiveDisclosure');
    const compatibility = page.indexOf('<BravoCompatibilityPanel />');
    const pool = page.indexOf("t('bravo.subscriptions.pool')");

    expect(audit).toBeGreaterThan(0);
    expect(audit).toBeLessThan(compatibility);
    expect(compatibility).toBeLessThan(pool);
    expect(page).toContain("t('bravo.quota.adaptive_summary'");
  });
});
