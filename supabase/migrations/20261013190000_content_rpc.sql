-- Escrita do restante conteúdo pelo painel (perfil, percurso, categorias, SEO e ordenação).
-- Funções "security invoker": o RLS (admin com MFA) continua a aplicar-se.

create function public.save_profile(payload jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  loc public.app_locale;
  t jsonb;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão para alterar conteúdo.' using errcode = '42501';
  end if;

  insert into public.profile (id, full_name, email, available, work_modes, work_zones, photo_media_id)
  values (
    1,
    payload ->> 'full_name',
    payload ->> 'email',
    coalesce((payload ->> 'available')::boolean, true),
    array(select jsonb_array_elements_text(coalesce(payload -> 'work_modes', '[]'::jsonb)))::public.work_mode[],
    array(select jsonb_array_elements_text(coalesce(payload -> 'work_zones', '[]'::jsonb))),
    nullif(payload ->> 'photo_media_id', '')::uuid
  )
  on conflict (id) do update set
    full_name = excluded.full_name, email = excluded.email, available = excluded.available,
    work_modes = excluded.work_modes, work_zones = excluded.work_zones, photo_media_id = excluded.photo_media_id;

  foreach loc in array enum_range(null::public.app_locale) loop
    t := coalesce(payload -> 'translations' -> (loc::text), '{}'::jsonb);
    insert into public.profile_translations (locale, headline, role_line, location, bio_short, bio_long, ai_note, principles)
    values (loc, t ->> 'headline', t ->> 'role_line', t ->> 'location', t ->> 'bio_short', t ->> 'bio_long',
            nullif(t ->> 'ai_note', ''), coalesce(t -> 'principles', '[]'::jsonb))
    on conflict (locale) do update set
      headline = excluded.headline, role_line = excluded.role_line, location = excluded.location,
      bio_short = excluded.bio_short, bio_long = excluded.bio_long, ai_note = excluded.ai_note,
      principles = excluded.principles;
  end loop;
end;
$$;

create function public.save_experience(payload jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid := nullif(payload ->> 'id', '')::uuid;
  loc public.app_locale;
  t jsonb;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão para alterar conteúdo.' using errcode = '42501';
  end if;

  if v_id is null then
    insert into public.experiences (organization, org_url, employment_type, start_date, end_date, sort_order)
    values (payload ->> 'organization', nullif(payload ->> 'org_url', ''),
            (payload ->> 'employment_type')::public.employment_type, payload ->> 'start_date',
            nullif(payload ->> 'end_date', ''),
            coalesce((select min(e.sort_order) - 1 from public.experiences e), 1))
    returning id into v_id;
  else
    update public.experiences set
      organization = payload ->> 'organization', org_url = nullif(payload ->> 'org_url', ''),
      employment_type = (payload ->> 'employment_type')::public.employment_type,
      start_date = payload ->> 'start_date', end_date = nullif(payload ->> 'end_date', '')
    where id = v_id;
    if not found then
      raise exception 'A experiência não existe.' using errcode = 'P0002';
    end if;
  end if;

  foreach loc in array enum_range(null::public.app_locale) loop
    t := coalesce(payload -> 'translations' -> (loc::text), '{}'::jsonb);
    insert into public.experience_translations (experience_id, locale, role, description, highlights)
    values (v_id, loc, t ->> 'role', nullif(t ->> 'description', ''), coalesce(t -> 'highlights', '[]'::jsonb))
    on conflict (experience_id, locale) do update set
      role = excluded.role, description = excluded.description, highlights = excluded.highlights;
  end loop;

  delete from public.experience_technologies where experience_id = v_id;
  insert into public.experience_technologies (experience_id, technology_id, sort_order)
  select v_id, x.value::uuid, (x.position - 1)::integer
  from jsonb_array_elements_text(coalesce(payload -> 'technology_ids', '[]'::jsonb)) with ordinality as x(value, position);

  return v_id;
end;
$$;

create function public.save_education(payload jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid := nullif(payload ->> 'id', '')::uuid;
  loc public.app_locale;
  t jsonb;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão para alterar conteúdo.' using errcode = '42501';
  end if;

  if v_id is null then
    insert into public.education (institution, start_date, end_date, sort_order)
    values (payload ->> 'institution', payload ->> 'start_date', nullif(payload ->> 'end_date', ''),
            coalesce((select min(e.sort_order) - 1 from public.education e), 1))
    returning id into v_id;
  else
    update public.education set
      institution = payload ->> 'institution', start_date = payload ->> 'start_date',
      end_date = nullif(payload ->> 'end_date', '')
    where id = v_id;
    if not found then
      raise exception 'A formação não existe.' using errcode = 'P0002';
    end if;
  end if;

  foreach loc in array enum_range(null::public.app_locale) loop
    t := coalesce(payload -> 'translations' -> (loc::text), '{}'::jsonb);
    insert into public.education_translations (education_id, locale, degree, description)
    values (v_id, loc, t ->> 'degree', nullif(t ->> 'description', ''))
    on conflict (education_id, locale) do update set degree = excluded.degree, description = excluded.description;
  end loop;

  return v_id;
end;
$$;

create function public.save_category(payload jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid := nullif(payload ->> 'id', '')::uuid;
  loc public.app_locale;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão para alterar conteúdo.' using errcode = '42501';
  end if;

  if v_id is null then
    insert into public.categories (slug, sort_order)
    values (payload ->> 'slug', coalesce((select max(c.sort_order) + 1 from public.categories c), 1))
    returning id into v_id;
  else
    update public.categories set slug = payload ->> 'slug' where id = v_id;
  end if;

  foreach loc in array enum_range(null::public.app_locale) loop
    insert into public.category_translations (category_id, locale, name)
    values (v_id, loc, payload -> 'names' ->> (loc::text))
    on conflict (category_id, locale) do update set name = excluded.name;
  end loop;

  return v_id;
end;
$$;

create function public.save_site_settings(payload jsonb) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  loc public.app_locale;
  t jsonb;
begin
  if not public.is_admin() then
    raise exception 'Sem permissão para alterar conteúdo.' using errcode = '42501';
  end if;

  insert into public.site_settings (id, og_media_id) values (1, nullif(payload ->> 'og_media_id', '')::uuid)
  on conflict (id) do update set og_media_id = excluded.og_media_id;

  foreach loc in array enum_range(null::public.app_locale) loop
    t := coalesce(payload -> 'translations' -> (loc::text), '{}'::jsonb);
    insert into public.site_settings_translations (locale, title, description)
    values (loc, t ->> 'title', t ->> 'description')
    on conflict (locale) do update set title = excluded.title, description = excluded.description;
  end loop;
end;
$$;

-- Ordenação genérica para as listas do painel. A tabela vem de uma lista fechada (sem SQL dinâmico livre).
create function public.move_item(item_table text, item_id uuid, direction integer) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  cur_order integer;
  other_id uuid;
  other_order integer;
begin
  if item_table not in ('experiences', 'education', 'links', 'categories', 'technologies') then
    raise exception 'Lista desconhecida: %', item_table using errcode = '22023';
  end if;

  execute format('select sort_order from public.%I where id = $1 for update', item_table) into cur_order using item_id;
  if cur_order is null then
    raise exception 'O registo não existe ou não tens permissão.' using errcode = 'P0002';
  end if;

  if direction < 0 then
    execute format(
      'select id, sort_order from public.%I where sort_order < $1 or (sort_order = $1 and id < $2) '
      'order by sort_order desc, id desc limit 1 for update', item_table)
      into other_id, other_order using cur_order, item_id;
  else
    execute format(
      'select id, sort_order from public.%I where sort_order > $1 or (sort_order = $1 and id > $2) '
      'order by sort_order, id limit 1 for update', item_table)
      into other_id, other_order using cur_order, item_id;
  end if;

  if other_id is null then
    return;
  end if;

  execute format('update public.%I set sort_order = $1 where id = $2', item_table) using other_order, item_id;
  execute format('update public.%I set sort_order = $1 where id = $2', item_table) using cur_order, other_id;
end;
$$;

do $$
declare
  f text;
begin
  foreach f in array array[
    'save_profile(jsonb)', 'save_experience(jsonb)', 'save_education(jsonb)', 'save_category(jsonb)',
    'save_site_settings(jsonb)', 'move_item(text, uuid, integer)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end;
$$;
