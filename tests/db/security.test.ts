/**
 * Prova as regras de segurança da ADR 0002 com pedidos reais à API do Supabase (local ou staging).
 *
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... npm run test:db
 *
 * Cria um utilizador de teste temporário, regista-o como admin e apaga-o no fim.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHmac, randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL ?? '';
const anonKey = process.env.SUPABASE_ANON_KEY ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const options = { auth: { persistSession: false, autoRefreshToken: false } };

const service = createClient(url, serviceKey, options);
const email = `teste-${Date.now()}@example.com`;
const password = `Teste-${randomUUID()}`;
let userId = '';
let user: SupabaseClient;
const createdProjects: string[] = [];

/** Código TOTP (RFC 6238, SHA-1, 6 dígitos, 30 s) a partir do segredo em base32. */
function totp(secretBase32: string, now = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of secretBase32.replace(/=+$/, '').toUpperCase()) bits += alphabet.indexOf(char).toString(2).padStart(5, '0');
  const bytes = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 30000)));
  const hmac = createHmac('sha1', bytes).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return code.toString().padStart(6, '0');
}

beforeAll(async () => {
  expect(url && anonKey && serviceKey, 'Define SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY').toBeTruthy();
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  userId = data.user.id;
  const { error: adminError } = await service.from('admins').insert({ user_id: userId });
  if (adminError) throw adminError;
  user = createClient(url, anonKey, options);
  const { error: signInError } = await user.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
});

afterAll(async () => {
  if (createdProjects.length) await service.from('projects').delete().in('id', createdProjects);
  if (userId) await service.auth.admin.deleteUser(userId);
});

describe('visitante sem sessão (anon)', () => {
  const anon = createClient(url, anonKey, options);

  it('não lê nenhuma tabela de conteúdo', async () => {
    const { data, error } = await anon.from('projects').select('id');
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it('não descarrega ficheiros do bucket privado', async () => {
    const { error } = await anon.storage.from('media').download('seed/associam.jpg');
    expect(error).toBeTruthy();
  });

  it('não chama a exportação do build', async () => {
    const { error } = await anon.rpc('export_published_content');
    expect(error).toBeTruthy();
  });

  it('não consegue criar conta (registo público desligado)', async () => {
    const { error } = await anon.auth.signUp({ email: `intruso-${Date.now()}@example.com`, password: `Intruso-${randomUUID()}` });
    expect(error).toBeTruthy();
  });
});

describe('admin com sessão mas sem MFA (aal1)', () => {
  it('não vê conteúdo', async () => {
    const { data } = await user.from('projects').select('id');
    expect(data ?? []).toHaveLength(0);
  });

  it('não consegue escrever', async () => {
    const { error } = await user.from('projects').insert({ slug: `aal1-${Date.now()}` });
    expect(error).toBeTruthy();
  });
});

describe('admin com MFA (aal2)', () => {
  beforeAll(async () => {
    const { data: enrolled, error } = await user.auth.mfa.enroll({ factorType: 'totp', friendlyName: `teste-${Date.now()}` });
    if (error) throw error;
    const { error: verifyError } = await user.auth.mfa.challengeAndVerify({ factorId: enrolled.id, code: totp(enrolled.totp.secret) });
    if (verifyError) throw verifyError;
  });

  it('lê o conteúdo publicado', async () => {
    const { data, error } = await user.from('projects').select('slug').eq('status', 'published');
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
  });

  it('cria um rascunho incompleto mas não o consegue publicar', async () => {
    const { data: created, error } = await user
      .from('projects')
      .insert({ slug: `teste-${Date.now()}`, kind: 'case_study' })
      .select('id')
      .single();
    expect(error).toBeNull();
    createdProjects.push(created!.id);

    const { data: issues } = await user.rpc('project_publish_issues_by_id', { project_id: created!.id });
    expect(issues).toContain('Falta a imagem de capa.');
    expect(issues).toContain('Indica pelo menos uma tecnologia.');

    const { error: publishError } = await user.from('projects').update({ status: 'published' }).eq('id', created!.id);
    expect(publishError?.code).toBe('23514');
    expect(publishError?.details).toContain('Falta a categoria.');
  });

  it('continua sem poder chamar a exportação do build', async () => {
    const { error } = await user.rpc('export_published_content');
    expect(error).toBeTruthy();
  });

  it('não se consegue promover nem promover outros a admin', async () => {
    const { error } = await user.from('admins').insert({ user_id: randomUUID() });
    expect(error).toBeTruthy();
  });
});
