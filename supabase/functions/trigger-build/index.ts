// Pede ao Vercel um novo deploy de produção através do Deploy Hook (o site é reconstruído com o conteúdo publicado).
import { corsHeaders, json, requireAdmin, vercelConfig } from '../_shared/admin.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(request) });
  if (request.method !== 'POST') return json(request, 405, { error: 'Método não suportado.' });

  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { deployHook } = vercelConfig();
  if (!deployHook) return json(request, 503, { error: 'A publicação ainda não está configurada (falta o VERCEL_DEPLOY_HOOK_URL na Edge Function).' });

  const response = await fetch(deployHook, { method: 'POST' });
  if (!response.ok) {
    console.error('Deploy Hook falhou', response.status, (await response.text()).slice(0, 300));
    return json(request, 502, { error: `O Vercel recusou o pedido (${response.status}). Verifica o Deploy Hook.` });
  }
  return json(request, 202, { ok: true });
});
