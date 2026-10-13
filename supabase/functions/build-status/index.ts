// Devolve o estado da última execução do workflow de publicação.
import { corsHeaders, json, requireAdmin, githubConfig, githubHeaders } from '../_shared/admin.ts';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(request) });
  if (request.method !== 'GET') return json(request, 405, { error: 'Método não suportado.' });

  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { token, repo, workflow } = githubConfig();
  if (!token) return json(request, 200, { status: 'unknown', conclusion: null, createdAt: null, url: null });

  const response = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflow}/runs?per_page=1`, {
    headers: githubHeaders(token),
  });
  if (!response.ok) return json(request, 502, { error: `Não foi possível consultar o GitHub (${response.status}).` });

  const body = await response.json();
  const run = body.workflow_runs?.[0];
  if (!run) return json(request, 200, { status: 'unknown', conclusion: null, createdAt: null, url: null });
  return json(request, 200, {
    status: ['queued', 'in_progress', 'completed'].includes(run.status) ? run.status : 'in_progress',
    conclusion: run.conclusion,
    createdAt: run.created_at,
    url: run.html_url,
  });
});
