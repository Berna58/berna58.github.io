-- Publicação automática: o site atualiza-se sozinho depois de cada alteração no painel.
--
-- Um job do pg_cron corre a cada 30 segundos e compara a impressão digital (md5) do conteúdo publicado
-- com a do último deploy pedido. Se mudou e ficou estável durante uma volta (o admin parou de gravar),
-- chama o Deploy Hook do Vercel com o pg_net. Assim:
--   * não depende do browser do painel estar aberto;
--   * rascunhos não gastam builds (não entram na exportação);
--   * várias gravações seguidas dão um só deploy.
--
-- O endereço do Deploy Hook é secreto e fica no Vault (ver docs/operacao.md):
--   select vault.create_secret('<endereço>', 'vercel_deploy_hook_url', 'Deploy Hook do Vercel (ramo main)');

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Estado da sincronização (uma só linha).
create table public.site_sync (
  id smallint primary key default 1 check (id = 1),
  deployed_hash text,          -- conteúdo do último deploy pedido
  pending_hash text,           -- conteúdo novo à espera de ficar estável
  pending_since timestamptz,
  request_id bigint,           -- pedido do pg_net cuja resposta ainda não foi lida
  requested_at timestamptz,
  retry_after timestamptz,     -- depois de uma falha, não insistir antes disto
  last_error text
);

alter table public.site_sync enable row level security;
revoke all on public.site_sync from anon, authenticated;
grant all on public.site_sync to service_role;

-- Impressão digital do conteúdo publicado (sem a data de geração, que muda sempre).
create function public.published_content_hash() returns text
language sql stable set search_path = '' as $$
  select md5((public.export_published_content() - 'generatedAt')::text);
$$;

revoke all on function public.published_content_hash() from public, anon, authenticated;
grant execute on function public.published_content_hash() to service_role;

insert into public.site_sync (id, deployed_hash) values (1, public.published_content_hash());

-- Uma volta da sincronização. Corre como postgres (pg_cron), por isso vê todo o conteúdo.
create function public.sync_site() returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.site_sync;
  current_hash text := public.published_content_hash();
  hook text;
  reply_status integer;
  reply_error text;
begin
  select * into s from public.site_sync where id = 1 for update;

  -- O pg_net responde de forma assíncrona: ler o resultado do último pedido.
  if s.request_id is not null then
    select r.status_code, r.error_msg into reply_status, reply_error from net._http_response r where r.id = s.request_id;
    if found and reply_status between 200 and 299 then
      update public.site_sync set request_id = null, last_error = null where id = 1;
    elsif found or s.requested_at < now() - interval '10 minutes' then
      -- Falhou (ou a resposta perdeu-se): voltar a tentar daqui a 10 minutos.
      update public.site_sync set
        request_id = null,
        deployed_hash = null,
        retry_after = now() + interval '10 minutes',
        last_error = case
          when reply_error is not null then 'Não foi possível contactar o Vercel: ' || reply_error
          when reply_status is not null then format('O Vercel recusou o pedido (%s). Verifica o Deploy Hook.', reply_status)
          else 'O Vercel não respondeu ao pedido de publicação.'
        end
      where id = 1;
    else
      return; -- ainda sem resposta
    end if;
    select * into s from public.site_sync where id = 1;
  end if;

  -- O site já está em dia (por exemplo, a alteração foi desfeita): nada a fazer nem a reportar.
  if current_hash = s.deployed_hash then
    if s.pending_hash is not null or s.last_error is not null then
      update public.site_sync set pending_hash = null, pending_since = null, last_error = null where id = 1;
    end if;
    return;
  end if;

  -- Conteúdo novo (ou mudou outra vez): esperar que fique estável.
  if s.pending_hash is distinct from current_hash then
    update public.site_sync set pending_hash = current_hash, pending_since = now() where id = 1;
    return;
  end if;

  if now() - s.pending_since < interval '20 seconds' or now() < coalesce(s.retry_after, '-infinity') then
    return;
  end if;

  -- Sem Deploy Hook (ambiente local, ou produção ainda por configurar): fica pendente; o painel mostra-o.
  select ds.decrypted_secret into hook from vault.decrypted_secrets ds where ds.name = 'vercel_deploy_hook_url';
  if coalesce(hook, '') = '' then
    return;
  end if;

  update public.site_sync set
    request_id = net.http_post(url := hook),
    requested_at = now(),
    deployed_hash = current_hash,
    pending_hash = null,
    pending_since = null,
    retry_after = null,
    last_error = null
  where id = 1;
end;
$$;

revoke all on function public.sync_site() from public, anon, authenticated;

-- Estado para o painel: há alterações a caminho do site? Houve algum erro?
create function public.site_sync_status() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.site_sync;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  select * into s from public.site_sync where id = 1;
  return jsonb_build_object(
    'configured', exists (select 1 from vault.secrets v where v.name = 'vercel_deploy_hook_url'),
    'pending', s.request_id is null and public.published_content_hash() is distinct from s.deployed_hash,
    'requestedAt', s.requested_at,
    'error', s.last_error
  );
end;
$$;

revoke all on function public.site_sync_status() from public, anon;
grant execute on function public.site_sync_status() to authenticated;

select cron.schedule('publicar-site', '30 seconds', 'select public.sync_site()');
