-- Operações de escrita do painel, cada uma numa única transação.
-- São "security invoker": correm com as permissões de quem chama, por isso o RLS continua a aplicar-se
-- (só o admin com MFA consegue usá-las). A verificação explícita de is_admin() só dá uma mensagem mais clara.

-- Guarda um projeto completo (dados, textos PT/EN, tecnologias e galeria) e devolve o id.
-- Se o projeto estiver publicado, a alteração só é aceite se o projeto continuar completo.
create function public.save_project(payload jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid := nullif(payload ->> 'id', '')::uuid;
  v_project public.projects;
  v_issues text[];
  loc public.app_locale;
  t jsonb;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão para alterar conteúdo.' using errcode = '42501';
  end if;

  if v_id is null then
    insert into public.projects (slug, kind, featured, sort_order, category_id, year, project_state,
                                 code_visibility, demo_url, repo_url, video_url, cover_media_id)
    values (
      payload ->> 'slug',
      (payload ->> 'kind')::public.project_kind,
      coalesce((payload ->> 'featured')::boolean, false),
      coalesce((select max(p.sort_order) + 1 from public.projects p), 1),
      nullif(payload ->> 'category_id', '')::uuid,
      nullif(payload ->> 'year', '')::smallint,
      nullif(payload ->> 'project_state', '')::public.project_state,
      coalesce(nullif(payload ->> 'code_visibility', ''), 'private')::public.code_visibility,
      nullif(payload ->> 'demo_url', ''),
      nullif(payload ->> 'repo_url', ''),
      nullif(payload ->> 'video_url', ''),
      nullif(payload ->> 'cover_media_id', '')::uuid
    )
    returning id into v_id;
  else
    update public.projects set
      slug = payload ->> 'slug',
      kind = (payload ->> 'kind')::public.project_kind,
      featured = coalesce((payload ->> 'featured')::boolean, false),
      category_id = nullif(payload ->> 'category_id', '')::uuid,
      year = nullif(payload ->> 'year', '')::smallint,
      project_state = nullif(payload ->> 'project_state', '')::public.project_state,
      code_visibility = coalesce(nullif(payload ->> 'code_visibility', ''), 'private')::public.code_visibility,
      demo_url = nullif(payload ->> 'demo_url', ''),
      repo_url = nullif(payload ->> 'repo_url', ''),
      video_url = nullif(payload ->> 'video_url', ''),
      cover_media_id = nullif(payload ->> 'cover_media_id', '')::uuid
    where id = v_id;
    if not found then
      raise exception 'O projeto não existe (pode ter sido eliminado).' using errcode = 'P0002';
    end if;
  end if;

  foreach loc in array enum_range(null::public.app_locale) loop
    t := coalesce(payload -> 'translations' -> (loc::text), '{}'::jsonb);
    insert into public.project_translations (project_id, locale, title, summary, role, problem, audience,
      solution, features, decisions, challenges, results, ai_usage, seo_title, seo_description)
    values (
      v_id, loc,
      coalesce(t ->> 'title', ''), coalesce(t ->> 'summary', ''),
      nullif(t ->> 'role', ''), nullif(t ->> 'problem', ''), nullif(t ->> 'audience', ''),
      nullif(t ->> 'solution', ''),
      coalesce(t -> 'features', '[]'::jsonb), coalesce(t -> 'decisions', '[]'::jsonb),
      coalesce(t -> 'challenges', '[]'::jsonb),
      nullif(t ->> 'results', ''), nullif(t ->> 'ai_usage', ''),
      nullif(t ->> 'seo_title', ''), nullif(t ->> 'seo_description', '')
    )
    on conflict (project_id, locale) do update set
      title = excluded.title, summary = excluded.summary, role = excluded.role,
      problem = excluded.problem, audience = excluded.audience, solution = excluded.solution,
      features = excluded.features, decisions = excluded.decisions, challenges = excluded.challenges,
      results = excluded.results, ai_usage = excluded.ai_usage,
      seo_title = excluded.seo_title, seo_description = excluded.seo_description;
  end loop;

  delete from public.project_technologies where project_id = v_id;
  insert into public.project_technologies (project_id, technology_id, sort_order)
  select v_id, x.value::uuid, (x.position - 1)::integer
  from jsonb_array_elements_text(coalesce(payload -> 'technology_ids', '[]'::jsonb)) with ordinality as x(value, position);

  delete from public.project_media where project_id = v_id;
  insert into public.project_media (project_id, media_id, sort_order)
  select v_id, x.value::uuid, (x.position - 1)::integer
  from jsonb_array_elements_text(coalesce(payload -> 'gallery_ids', '[]'::jsonb)) with ordinality as x(value, position);

  -- Um projeto publicado nunca pode ficar incompleto: se faltar algo, a transação é anulada.
  select p.* into v_project from public.projects p where p.id = v_id;
  if v_project.status = 'published' then
    v_issues := public.project_publish_issues(v_project);
    if cardinality(v_issues) > 0 then
      raise exception using
        errcode = 'check_violation',
        message = 'O projeto está publicado e ficaria incompleto. Corrige ou despublica primeiro.',
        detail = array_to_string(v_issues, ' ');
    end if;
  end if;

  return v_id;
end;
$$;

-- Publicar, despublicar ou voltar a rascunho. A validação de publicação é feita pelo trigger projects_publishable.
create function public.set_project_status(project_id uuid, new_status public.publish_status) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  update public.projects set status = new_status where id = project_id;
  if not found then
    raise exception 'O projeto não existe ou não tens permissão.' using errcode = 'P0002';
  end if;
end;
$$;

-- Move um projeto uma posição para cima (-1) ou para baixo (+1), trocando com o vizinho.
create function public.move_project(project_id uuid, direction integer) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  cur public.projects;
  neighbour public.projects;
begin
  select p.* into cur from public.projects p where p.id = project_id for update;
  if not found then
    raise exception 'O projeto não existe ou não tens permissão.' using errcode = 'P0002';
  end if;

  if direction < 0 then
    select p.* into neighbour from public.projects p
    where p.sort_order < cur.sort_order or (p.sort_order = cur.sort_order and p.id < cur.id)
    order by p.sort_order desc, p.id desc limit 1 for update;
  else
    select p.* into neighbour from public.projects p
    where p.sort_order > cur.sort_order or (p.sort_order = cur.sort_order and p.id > cur.id)
    order by p.sort_order, p.id limit 1 for update;
  end if;

  if neighbour.id is null then
    return; -- já está no topo ou no fim
  end if;

  update public.projects set sort_order = neighbour.sort_order where id = cur.id;
  update public.projects set sort_order = cur.sort_order where id = neighbour.id;
end;
$$;

revoke all on function public.save_project(jsonb) from public, anon;
grant execute on function public.save_project(jsonb) to authenticated;
revoke all on function public.set_project_status(uuid, public.publish_status) from public, anon;
grant execute on function public.set_project_status(uuid, public.publish_status) to authenticated;
revoke all on function public.move_project(uuid, integer) from public, anon;
grant execute on function public.move_project(uuid, integer) to authenticated;
