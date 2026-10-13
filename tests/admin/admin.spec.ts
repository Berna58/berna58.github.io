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
  await expect(page.getByRole('heading', { name: 'Projetos' })).toBeVisible();
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

test('criar, publicar, despublicar e eliminar um projeto sem tocar no código', async ({ page }) => {
  await login(page);
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

  // O botão de publicar o site chega à Edge Function (localmente sem token do GitHub).
  await page.getByRole('button', { name: 'Publicar alterações no site' }).click();
  await expect(page.getByText('A publicação ainda não está configurada', { exact: false })).toBeVisible();

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
  await expect(page.getByRole('heading', { name: 'Projetos' })).toBeVisible();
  const { data: rows } = await service.from('projects').select('id').eq('slug', slug);
  expect(rows).toHaveLength(0);
});

test('reordenar move o projeto na lista do site', async ({ page }) => {
  await login(page);
  const titles = () => page.locator('.adm-row-title').allTextContents();
  const before = await titles();
  await page.getByRole('button', { name: `Descer ${before[0]}` }).click();
  await expect.poll(titles).toEqual([before[1], before[0], ...before.slice(2)]);
  await page.getByRole('button', { name: `Subir ${before[0]}` }).click();
  await expect.poll(titles).toEqual(before);
});
