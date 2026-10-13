// Código partilhado pelas Edge Functions do painel.
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? 'https://bernardo-azevedo-portfolio.vercel.app,http://127.0.0.1:4321,http://localhost:4321')
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

/**
 * Configuração do Vercel (segredos da Edge Function):
 *  - VERCEL_DEPLOY_HOOK_URL: obrigatório para publicar (Vercel > Project > Settings > Git > Deploy Hooks).
 *  - VERCEL_TOKEN + VERCEL_PROJECT_ID (+ VERCEL_TEAM_ID): opcionais, só para mostrar o estado do último deploy.
 */
export function vercelConfig() {
  return {
    deployHook: Deno.env.get('VERCEL_DEPLOY_HOOK_URL') ?? '',
    token: Deno.env.get('VERCEL_TOKEN') ?? '',
    projectId: Deno.env.get('VERCEL_PROJECT_ID') ?? '',
    teamId: Deno.env.get('VERCEL_TEAM_ID') ?? '',
  };
}
