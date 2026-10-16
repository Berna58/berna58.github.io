import { createClient, type PostgrestError } from '@supabase/supabase-js';
import type { Database } from './database.types';

// PUBLIC_* (local) ou NEXT_PUBLIC_* (criadas pela integração Supabase do Vercel).
const url = (import.meta.env.PUBLIC_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL) as string | undefined;
const anonKey = (import.meta.env.PUBLIC_SUPABASE_ANON_KEY ??
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) as string | undefined;

/** O painel só funciona com as variáveis públicas do Supabase definidas no build. */
export const isConfigured = Boolean(url && anonKey);

/** Evento lançado depois de cada escrita bem-sucedida (o estado da publicação automática atualiza-se logo). */
export const CONTENT_CHANGED = 'admin:content-changed';

async function fetchAndNotify(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  const method = (init?.method ?? 'GET').toUpperCase();
  const path = new URL(input instanceof Request ? input.url : input.toString()).pathname;
  if (response.ok && method !== 'GET' && method !== 'HEAD' && path.includes('/rest/v1/') && !path.endsWith('/rpc/site_sync_status')) {
    window.dispatchEvent(new Event(CONTENT_CHANGED));
  }
  return response;
}

export const supabase = createClient<Database>(url ?? 'http://invalid.local', anonKey ?? 'invalid', {
  auth: { persistSession: true, storageKey: 'portfolio-admin', autoRefreshToken: true },
  global: { fetch: fetchAndNotify },
});

export const functionsUrl = `${url ?? ''}/functions/v1`;

/** Converte erros do Supabase/Postgres em frases que explicam o que fazer. */
export function describeError(error: unknown): string {
  const e = error as Partial<PostgrestError> & { message?: string };
  if (!e) return 'Ocorreu um erro inesperado.';
  if (e.code === '23505') return 'Já existe um projeto com esse endereço (slug). Escolhe outro.';
  if (e.code === '23514' || e.code === 'check_violation') return [e.message, e.details].filter(Boolean).join(' ');
  if (e.code === '23503') return 'Não é possível apagar: ainda está a ser usado (por exemplo, por um projeto). Muda isso primeiro.';
  if (e.code === '42501') return 'Sem permissão. Volta a entrar com o código do autenticador.';
  if (e.code === 'P0002') return e.message ?? 'O registo não existe.';
  if (e.message?.includes('Failed to fetch')) return 'Sem ligação ao servidor. Verifica a internet e tenta de novo.';
  return e.message ?? 'Ocorreu um erro inesperado.';
}
