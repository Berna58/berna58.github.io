import { createClient, type PostgrestError } from '@supabase/supabase-js';
import type { Database } from './database.types';

const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;

/** O painel só funciona com as variáveis públicas do Supabase definidas no build. */
export const isConfigured = Boolean(url && anonKey);

export const supabase = createClient<Database>(url ?? 'http://invalid.local', anonKey ?? 'invalid', {
  auth: { persistSession: true, storageKey: 'portfolio-admin', autoRefreshToken: true },
});

export const functionsUrl = `${url ?? ''}/functions/v1`;

/** Converte erros do Supabase/Postgres em frases que explicam o que fazer. */
export function describeError(error: unknown): string {
  const e = error as Partial<PostgrestError> & { message?: string };
  if (!e) return 'Ocorreu um erro inesperado.';
  if (e.code === '23505') return 'Já existe um projeto com esse endereço (slug). Escolhe outro.';
  if (e.code === '23514' || e.code === 'check_violation') return [e.message, e.details].filter(Boolean).join(' ');
  if (e.code === '42501') return 'Sem permissão. Volta a entrar com o código do autenticador.';
  if (e.code === 'P0002') return e.message ?? 'O registo não existe.';
  if (e.message?.includes('Failed to fetch')) return 'Sem ligação ao servidor. Verifica a internet e tenta de novo.';
  return e.message ?? 'Ocorreu um erro inesperado.';
}
