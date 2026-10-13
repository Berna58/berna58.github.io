// Inicia o workflow de publicação do site no GitHub Actions.
import { corsHeaders, json, requireAdmin, githubConfig, githubHeaders } from '../_shared/admin.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(request) });
  if (request.method !== 'POST') return json(request, 405, { error: 'Método não suportado.' });

  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { token, repo, workflow, ref } = githubConfig();
  if (!token) return json(request, 503, { error: 'A publicação ainda não está configurada (falta o GITHUB_TOKEN na Edge Function).' });

  const response = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`, {
    method: 'POST',
    headers: { ...githubHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref }),
  });

  if (response.status !== 204) {
    const detail = await response.text();
    console.error('GitHub dispatch falhou', response.status, detail.slice(0, 300));
    return json(request, 502, { error: `O GitHub recusou o pedido (${response.status}). Verifica o token e o nome do workflow.` });
  }
  return json(request, 202, { ok: true });
});
