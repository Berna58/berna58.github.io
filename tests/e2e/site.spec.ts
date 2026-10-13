import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pages = ['/', '/en/', '/projetos/', '/en/projects/', '/projetos/associam/', '/en/projects/associam/', '/percurso/', '/en/about/'];

for (const path of pages) {
  test(`${path} sem violações de acessibilidade, erros nem scroll horizontal`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(path);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(errors).toEqual([]);
  });

  test(`${path} acessível no tema escuro`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(path);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2aa']).include('body').analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
  });
}

test('o hero mostra proposta, disponibilidade e CTAs no primeiro ecrã', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('da base de dados à interface');
  await expect(page.getByText('disponível', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ver projetos' })).toBeInViewport();
});

test('o conteúdo está completo sem JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4322/projetos/');
  await expect(page.locator('[data-category]')).toHaveCount(4);
  await page.goto('http://127.0.0.1:4322/');
  await expect(page.locator('a[href^="mailto:"]').first()).toBeVisible();
  await expect(page.locator('[data-copy-button]').first()).toBeHidden();
  await context.close();
});

test('o filtro por categoria mostra só essa categoria e fica no URL', async ({ page }) => {
  await page.goto('/projetos/');
  await page.getByRole('button', { name: /Design/ }).click();
  await expect(page).toHaveURL(/categoria=design/);
  await expect(page.locator('[data-category]:visible')).toHaveCount(3);
});

test('o seletor de idioma leva à página equivalente', async ({ page }) => {
  await page.goto('/projetos/associam/');
  await page.getByRole('link', { name: 'Ver esta página em inglês' }).click();
  await expect(page).toHaveURL(/\/en\/projects\/associam\/$/);
});

test('/admin/ fica fora do sitemap e o robots.txt bloqueia-o', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Disallow: /admin/');
  const sitemap = await (await request.get('/sitemap-0.xml')).text();
  expect(sitemap).not.toContain('/admin');
  expect(sitemap).toContain('/en/projects/associam/');
});

test('a home pesa no máximo 500 KB, incluindo as imagens abaixo da dobra', async ({ page }) => {
  let bytes = 0;
  page.on('response', async (response) => {
    const body = await response.body().catch(() => null);
    if (body) bytes += body.length;
  });
  await page.goto('/');
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 50));
    }
  });
  await page.waitForLoadState('networkidle');
  console.log(`home: ${Math.round(bytes / 1024)} KB`);
  expect(bytes).toBeLessThanOrEqual(500 * 1024);
});
