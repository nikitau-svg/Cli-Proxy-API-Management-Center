import { describe, expect, test } from 'bun:test';

const readSource = (relativePath: string) =>
  Bun.file(new URL(relativePath, import.meta.url)).text();

describe('Bravo model picker layout', () => {
  test('lets model cards size to their content inside the project sheet', async () => {
    const [styles, page] = await Promise.all([
      readSource('../src/features/bravo/BravoAdminPage.module.scss'),
      readSource('../src/features/bravo/BravoAdminPage.tsx'),
    ]);

    const modelList = styles.match(/\.modelList\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
    const modelListItem = styles.match(/\.modelListItem\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';

    expect(modelList).toContain(
      'grid-template-columns: repeat(auto-fit, minmax(min(100%, 360px), 1fr))'
    );
    expect(modelList).toContain('grid-auto-rows: max-content');
    expect(modelList).toContain('align-content: start');
    expect(modelList).toContain('overflow-x: hidden');

    expect(modelListItem).toContain('min-width: 0');
    expect(modelListItem).toContain('min-height: 44px');
    expect(modelListItem).toContain('height: auto');
    expect(modelListItem).toContain('align-items: flex-start');

    expect(page).toContain('data-testid="bravo-model-list"');
    expect(page).toContain('className={styles.modelListItem}');
    expect(page).toContain('labelClassName={styles.modelListItemLabel}');
  });
});
