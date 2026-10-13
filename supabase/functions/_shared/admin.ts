// Código partilhado pelas Edge Functions do painel.
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? 'https://berna58.github.io,http://127.0.0.1:4321,http://localhost:4321')
  .split(',')
  .map((origin) => origin.trim());

export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin') ?? '';
  return {
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  };
}

export function json(request: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
  });
}

/**
 * Só deixa passar o admin com sessão confirmada por MFA: a função SQL is_admin() verifica
 * a tabela admins e o nível aal2 do token de quem chama.
 */
export async function requireAdmin(request: Request): Promise<Response | null> {
  const authorization = request.headers.get('Authorization');
  if (!authorization) return json(request, 401, { error: 'Sessão em falta. Volta a entrar no painel.' });
  const client = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '',
    { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } },
  );
  const { data, error } = await client.rpc('is_admin');
  if (error || data !== true) return json(request, 403, { error: 'Sem permissão. Entra com o código do autenticador.' });
  return null;
}

export function githubConfig() {
  return {
    token: Deno.env.get('GITHUB_TOKEN') ?? '',
    repo: Deno.env.get('GITHUB_REPO') ?? 'Berna58/berna58.github.io',
    workflow: Deno.env.get('GITHUB_WORKFLOW') ?? 'deploy.yml',
    ref: Deno.env.get('GITHUB_REF') ?? 'main',
  };
}

export function githubHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'portfolio-admin',
  };
}
