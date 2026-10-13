// Estado do último deploy de produção no Vercel (só se VERCEL_TOKEN e VERCEL_PROJECT_ID estiverem definidos).
import { corsHeaders, json, requireAdmin, vercelConfig } from '../_shared/admin.ts';

const UNKNOWN = { status: 'unknown', conclusion: null, createdAt: null, url: null };

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(request) });
  if (request.method !== 'GET') return json(request, 405, { error: 'Método não suportado.' });

  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { token, projectId, teamId } = vercelConfig();
  if (!token || !projectId) return json(request, 200, UNKNOWN);

  const query = new URLSearchParams({ projectId, target: 'production', limit: '1' });
  if (teamId) query.set('teamId', teamId);
  const response = await fetch(`https://api.vercel.com/v6/deployments?${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return json(request, 502, { error: `Não foi possível consultar o Vercel (${response.status}).` });

  const deployment = (await response.json()).deployments?.[0];
  if (!deployment) return json(request, 200, UNKNOWN);

  const state: string = deployment.readyState ?? deployment.state ?? '';
  const done = ['READY', 'ERROR', 'CANCELED'].includes(state);
  return json(request, 200, {
    status: done ? 'completed' : state === 'QUEUED' ? 'queued' : 'in_progress',
    conclusion: done ? (state === 'READY' ? 'success' : 'failure') : null,
    createdAt: new Date(deployment.createdAt ?? deployment.created).toISOString(),
    url: deployment.inspectorUrl ?? null,
  });
});
