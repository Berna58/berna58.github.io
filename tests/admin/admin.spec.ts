/**
 * Fluxo completo do painel contra o Supabase local (critério de aceitação do CMS):
 * entrar com MFA, criar um projeto, carregar a capa, ver o que falta, publicar, confirmar que entra
 * na exportação do site, despublicar e eliminar. Corre com: npm run test:admin
 */
import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createHmac, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const email = `painel-${Date.now()}@example.com`;
const password = `Painel-${randomUUID()}`;
const slug = `teste-e2e-${Date.now()}`;
let userId = '';
let totpSecret = '';

function totp(secretBase32: string, now = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of secretBase32.replace(/=+$/, '').toUpperCase()) bits += alphabet.indexOf(char).toString(2).padStart(5, '0');
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30000)));
  const hmac = createHmac('sha1', key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  return ((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0');
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  expect(url && serviceKey, 'Define SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (Supabase local)').toBeTruthy();
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  userId = data.user.id;
  const admin = await service.from('admins').insert({ user_id: userId });
  if (admin.error) throw admin.error;
});

test.afterAll(async () => {
  await service.from('projects').delete().eq('slug', slug);
  if (userId) await service.auth.admin.deleteUser(userId);
});

async function login(page: Page) {
  await page.goto('/admin/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Palavra-passe').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  if (!totpSecret) {
    await expect(page.getByRole('heading', { name: 'Ativar o autenticador' })).toBeVisible();
    totpSecret = (await page.locator('.adm-secret').textContent()) ?? '';
    await page.getByLabel('Código de 6 dígitos').fill(totp(totpSecret));
    await page.getByRole('button', { name: 'Ativar e entrar' }).click();
  } else {
    await expect(page.getByRole('heading', { name: 'Confirmar entrada' })).toBeVisible();
    await page.getByLabel('Código de 6 dígitos').fill(totp(totpSecret));
    await page.getByRole('button', { name: 'Confirmar' }).click();
  }
  await expect(page.getByRole('heading', { level: 1, name: 'Visão geral' })).toBeVisible();
}

async function openProjects(page: Page) {
  await page.getByRole('link', { name: 'Projetos', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Projetos' })).toBeVisible();
}

test('o ecrã de entrada não tem violações de acessibilidade', async ({ page }) => {
  await page.goto('/admin/');
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
});

test('palavra-passe errada mostra uma mensagem clara', async ({ page }) => {
  await page.goto('/admin/');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Palavra-passe').fill('errada');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toHaveText('Email ou palavra-passe incorretos.');
});

test('a visão geral mostra o estado real dos projetos e não tem violações de acessibilidade', async ({ page }) => {
  await login(page);
  const { data } = await service.from('projects').select('status');
  const published = (data ?? []).filter((p) => p.status === 'published').length;
  await expect(page.locator('.adm-stats > div', { hasText: 'Publicados' }).locator('dd')).toHaveText(String(published));
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
});

test('criar, publicar, despublicar e eliminar um projeto sem tocar no código', async ({ page }) => {
  await login(page);
  await openProjects(page);
  await expect(page.getByRole('link', { name: 'Associam' })).toBeVisible();

  // Novo projeto: começa como rascunho e mostra o que falta para publicar.
  await page.getByRole('link', { name: 'Novo projeto' }).click();
  await expect(page.getByRole('heading', { name: 'Para publicar, falta' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publicar', exact: true })).toBeDisabled();

  await page.locator('#f-title-pt').fill('Projeto de teste');
  await page.locator('#f-slug').fill(slug);
  await page.locator('#f-summary-pt').fill('Aplicação de teste criada pelo teste automático.');
  await page.locator('#f-category').selectOption({ label: 'Web' });
  await page.locator('#f-year').fill('2026');
  await page.getByRole('checkbox', { name: 'Laravel' }).check();
  await page.locator('#f-role-pt').fill('Desenvolvi tudo.');
  await page.locator('#f-problem-pt').fill('Um problema real.');
  await page.locator('#f-solution-pt').fill('Uma solução real.');

  // Guardar como rascunho antes de estar completo é permitido.
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Guardado.', { exact: false })).toBeVisible();

  // Capa: carregada pelo painel, com texto alternativo nos dois idiomas.
  await page.locator('#media-file-capa').setInputFiles('supabase/seed/media/associam.jpg');
  await page.locator('#media-alt-pt-capa').fill('Ecrã da aplicação de teste');
  await page.locator('#media-alt-en-capa').fill('Screen of the test application');
  await page.getByRole('button', { name: 'Carregar imagem' }).first().click();
  await expect(page.locator('.adm-thumbs img').first()).toBeVisible({ timeout: 20000 });

  // Textos em inglês.
  await page.getByRole('button', { name: /English/ }).first().click();
  await page.locator('#f-title-en').fill('Test project');
  await page.locator('#f-summary-en').fill('Test application created by the automated test.');
  await page.locator('#f-role-en').fill('I built everything.');
  await page.locator('#f-problem-en').fill('A real problem.');
  await page.locator('#f-solution-en').fill('A real solution.');
  await expect(page.getByRole('heading', { name: 'Para publicar, falta' })).toHaveCount(0);

  // Pré-visualização com o template real.
  await page.getByRole('button', { name: 'Pré-visualizar' }).click();
  await expect(page.locator('.adm-preview h1')).toHaveText('Projeto de teste');
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar' }).click();

  // Publicar (guarda primeiro e passa pelas regras da base de dados).
  await page.getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.getByText('Projeto publicado.', { exact: false })).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  // O build do site passaria a incluir o projeto, nos dois idiomas.
  const { data: exported } = await service.rpc('export_published_content');
  const project = (exported as { projects: { slug: string; i18n: Record<string, { title: string }> }[] }).projects.find((p) => p.slug === slug);
  expect(project?.i18n.pt.title).toBe('Projeto de teste');
  expect(project?.i18n.en.title).toBe('Test project');

  // Não há botão para publicar o site: a base de dados deteta a alteração e pede o deploy sozinha
  // (localmente não há Deploy Hook no Vault, por isso pode já mostrar esse aviso).
  await expect(page.getByRole('button', { name: /Publicar alterações/ })).toHaveCount(0);
  await expect(page.locator('.adm-build')).toContainText(/O site atualiza-se sozinho dentro de|falta o Deploy Hook/);
  const { data: sync } = await service.from('site_sync').select('deployed_hash').single();
  const { data: hash } = await service.rpc('published_content_hash');
  expect(hash).not.toBe(sync?.deployed_hash);

  // Despublicar: sai da exportação.
  await page.getByRole('button', { name: 'Despublicar' }).click();
  await expect(page.getByText('Projeto despublicado.', { exact: false })).toBeVisible();
  const { data: afterUnpublish } = await service.rpc('export_published_content');
  expect((afterUnpublish as { projects: { slug: string }[] }).projects.some((p) => p.slug === slug)).toBe(false);

  // Eliminar exige escrever o endereço do projeto.
  await page.getByRole('button', { name: 'Eliminar…' }).click();
  const confirm = page.getByRole('button', { name: 'Eliminar definitivamente' });
  await expect(confirm).toBeDisabled();
  await page.locator('#confirm-slug').fill(slug);
  await confirm.click();
  await expect(page.getByRole('heading', { level: 1, name: 'Projetos' })).toBeVisible();
  const { data: rows } = await service.from('projects').select('id').eq('slug', slug);
  expect(rows).toHaveLength(0);
});

test('sair do editor com alterações por guardar pede confirmação', async ({ page }) => {
  await login(page);
  await openProjects(page);
  await page.getByRole('link', { name: 'Novo projeto' }).click();
  await page.locator('#f-title-pt').fill('Rascunho por guardar');

  // Cancelar mantém o editor e o que foi escrito.
  await page.getByRole('link', { name: 'Perfil' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Sair sem guardar?' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.locator('#f-title-pt')).toHaveValue('Rascunho por guardar');

  // Confirmar segue para a secção escolhida.
  await page.getByRole('link', { name: 'Perfil' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Sair sem guardar' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Perfil' })).toBeVisible();
});

test('num ecrã de telemóvel o menu abre como gaveta e não há scroll horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  const menu = page.getByRole('button', { name: 'Abrir menu' });
  await expect(page.getByRole('link', { name: 'Percurso' })).toBeHidden();
  await menu.click();
  await page.getByRole('link', { name: 'Percurso' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Percurso' })).toBeVisible();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
});

test('reordenar move o projeto na lista do site', async ({ page }) => {
  await login(page);
  await openProjects(page);
  await expect(page.locator('.adm-row-title').first()).toBeVisible();
  const titles = () => page.locator('.adm-row-title').allTextContents();
  const before = await titles();
  await page.getByRole('button', { name: `Descer ${before[0]}` }).click();
  await expect.poll(titles).toEqual([before[1], before[0], ...before.slice(2)]);
  await page.getByRole('button', { name: `Subir ${before[0]}` }).click();
  await expect.poll(titles).toEqual(before);
});

test('perfil, percurso e CV geridos pelo painel chegam ao conteúdo do site', async ({ page }) => {
  await login(page);
  type Exported = {
    profile: { available: boolean; i18n: { pt: { location: string } } };
    experiences: { organization: string }[];
    cv: { pt: { file: string } | null };
  };
  const exported = async () => (await service.rpc('export_published_content')).data as unknown as Exported;
  const original = await exported();

  // Perfil: mudar a localização e a disponibilidade.
  await page.getByRole('link', { name: 'Perfil' }).click();
  await page.locator('#p-location-pt').fill('Braga, Portugal');
  await page.locator('#p-available').uncheck();
  await page.getByRole('button', { name: 'Guardar perfil' }).click();
  await expect(page.getByText('Guardado.', { exact: false })).toBeVisible();
  let content = await exported();
  expect(content.profile.i18n.pt.location).toBe('Braga, Portugal');
  expect(content.profile.available).toBe(false);
  // repor
  await page.locator('#p-location-pt').fill(original.profile.i18n.pt.location);
  await page.locator('#p-available').check();
  await page.getByRole('button', { name: 'Guardar perfil' }).click();
  await expect(page.getByText('Guardado.', { exact: false })).toBeVisible();

  // Percurso: adicionar e eliminar uma experiência.
  await page.getByRole('link', { name: 'Percurso' }).click();
  await page.getByRole('button', { name: 'Adicionar experiência' }).click();
  const editor = page.locator('.adm-inline-editor');
  await editor.getByLabel('Organização', { exact: true }).fill('Empresa de Teste');
  await editor.getByLabel('Início').fill('2025-11');
  await editor.getByLabel('Função (PT)').fill('Developer');
  await editor.getByRole('button', { name: 'English' }).click();
  await editor.getByLabel('Função (EN)').fill('Developer');
  await editor.getByRole('button', { name: 'Guardar experiência' }).click();
  await expect(page.getByText('Developer — Empresa de Teste')).toBeVisible();
  content = await exported();
  expect(content.experiences[0].organization).toBe('Empresa de Teste');
  await page.getByRole('listitem').filter({ hasText: 'Empresa de Teste' }).getByRole('button', { name: 'Eliminar' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Eliminar', exact: true }).click();
  await expect(page.getByText('Developer — Empresa de Teste')).toHaveCount(0);
  content = await exported();
  expect(content.experiences.some((e) => e.organization === 'Empresa de Teste')).toBe(false);

  // CV em português.
  await page.getByRole('link', { name: 'CV e SEO' }).click();
  await page.locator('#cv-pt').setInputFiles('supabase/seed/media/CV_BernardoAzevedo_2025.pdf');
  await expect(page.getByText('Guardado.', { exact: false })).toBeVisible({ timeout: 20000 });
  content = await exported();
  expect(content.cv.pt).not.toBeNull();
  await service.from('cv_files').delete().eq('locale', 'pt');
});
