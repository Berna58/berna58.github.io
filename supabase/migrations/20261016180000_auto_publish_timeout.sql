-- Publicação automática, correções depois do primeiro uso em produção:
--   * o Deploy Hook do Vercel pode demorar mais de 5 s a responder (o limite por omissão do pg_net): passa a 30 s;
--   * sem Deploy Hook no Vault não é um erro: fica pendente e o painel diz que a publicação não está ligada.

create or replace function public.sync_site() returns void
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
    request_id = net.http_post(url := hook, timeout_milliseconds := 30000),
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

create or replace function public.site_sync_status() returns jsonb
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

-- Esquecer as falhas anteriores (timeouts e o antigo "falta o Deploy Hook"): a próxima volta tenta logo.
update public.site_sync set last_error = null, retry_after = null where id = 1;
