-- Regras de publicação e exportação do conteúdo publicado.
--
-- As mesmas regras existem em três sítios, de propósito:
--   1. no painel (Zod), para mostrar os erros enquanto se escreve;
--   2. aqui, na base de dados, para que nenhum cliente consiga publicar algo incompleto;
--   3. no build, que valida o conteúdo exportado antes de gerar o site.

-- Lista de problemas que impedem a publicação. Lista vazia = pode publicar.
-- Recebe a linha do projeto (e não o id) para validar os valores NOVOS dentro do trigger.
create function public.project_publish_issues(p public.projects) returns text[]
language plpgsql stable set search_path = '' as $$
declare
  issues text[] := '{}';
  loc public.app_locale;
  tr public.project_translations;
  label text;
begin
  if p.cover_media_id is null then
    issues := array_append(issues, 'Falta a imagem de capa.');
  elsif (select count(1) from public.media_translations mt where mt.media_id = p.cover_media_id) < 2 then
    issues := array_append(issues, 'Falta o texto alternativo da capa em PT e EN.');
  end if;

  if p.category_id is null then
    issues := array_append(issues, 'Falta a categoria.');
  end if;

  foreach loc in array enum_range(null::public.app_locale) loop
    label := upper(loc::text);
    select t.* into tr from public.project_translations t where t.project_id = p.id and t.locale = loc;
    if not found then
      issues := array_append(issues, format('Faltam os textos (%s).', label));
      continue;
    end if;
    if trim(tr.title) = '' then
      issues := array_append(issues, format('Falta o título (%s).', label));
    end if;
    if trim(tr.summary) = '' then
      issues := array_append(issues, format('Falta a frase de resumo (%s).', label));
    end if;
    if p.kind = 'case_study' then
      if coalesce(trim(tr.role), '') = '' then
        issues := array_append(issues, format('Falta o papel (%s).', label));
      end if;
      if coalesce(trim(tr.problem), '') = '' then
        issues := array_append(issues, format('Falta o problema (%s).', label));
      end if;
      if coalesce(trim(tr.solution), '') = '' then
        issues := array_append(issues, format('Falta a solução (%s).', label));
      end if;
    end if;
  end loop;

  if p.kind = 'case_study'
     and not exists (select 1 from public.project_technologies pt where pt.project_id = p.id) then
    issues := array_append(issues, 'Indica pelo menos uma tecnologia.');
  end if;

  return issues;
end;
$$;

-- Versão por id, para o painel perguntar "o que falta?" antes de publicar (respeita RLS).
create function public.project_publish_issues_by_id(project_id uuid) returns text[]
language sql stable security invoker set search_path = '' as $$
  select public.project_publish_issues(p) from public.projects p where p.id = project_id;
$$;

-- Impede a passagem a "publicado" se faltar alguma coisa e regista a data da primeira publicação.
create function public.enforce_publishable() returns trigger
language plpgsql set search_path = '' as $$
declare
  issues text[];
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    issues := public.project_publish_issues(new);
    if cardinality(issues) > 0 then
      raise exception using
        errcode = 'check_violation',
        message = 'O projeto não pode ser publicado.',
        detail = array_to_string(issues, ' ');
    end if;
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end;
$$;

create trigger projects_publishable
  before insert or update of status on public.projects
  for each row execute function public.enforce_publishable();

-- ---------------------------------------------------------------------------
-- Exportação para o build: devolve TODO o conteúdo publicado num único JSON,
-- já no formato de src/lib/content/schema.ts (camelCase). Só o service_role a pode chamar.
-- ---------------------------------------------------------------------------

create function public.media_json(media_id uuid) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'file', m.id::text || '.' || lower(split_part(m.storage_path, '.', -1)),
    'storagePath', m.storage_path,
    'width', m.width,
    'height', m.height,
    'i18n', (
      select jsonb_object_agg(t.locale, jsonb_strip_nulls(jsonb_build_object('alt', t.alt, 'caption', t.caption)))
      from public.media_translations t
      where t.media_id = m.id
    )
  )
  from public.media m
  where m.id = media_id;
$$;

create function public.export_published_content() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'generatedAt', now(),
    'source', 'supabase',

    'profile', (
      select jsonb_build_object(
        'fullName', p.full_name,
        'email', p.email,
        'available', p.available,
        'workModes', to_jsonb(p.work_modes),
        'workZones', to_jsonb(p.work_zones),
        'photo', public.media_json(p.photo_media_id),
        'i18n', (
          select jsonb_object_agg(t.locale, jsonb_strip_nulls(jsonb_build_object(
            'headline', t.headline, 'roleLine', t.role_line, 'location', t.location,
            'bioShort', t.bio_short, 'bioLong', t.bio_long, 'aiNote', t.ai_note, 'principles', t.principles)))
          from public.profile_translations t
        )
      )
      from public.profile p
      where p.id = 1
    ),

    'site', (
      select jsonb_build_object(
        'ogImage', public.media_json(s.og_media_id),
        'i18n', (
          select jsonb_object_agg(t.locale, jsonb_build_object('title', t.title, 'description', t.description))
          from public.site_settings_translations t
        )
      )
      from public.site_settings s
      where s.id = 1
    ),

    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', c.slug,
        'sortOrder', c.sort_order,
        'i18n', (select jsonb_object_agg(t.locale, jsonb_build_object('name', t.name))
                 from public.category_translations t where t.category_id = c.id)
      ) order by c.sort_order)
      from public.categories c
    ), '[]'::jsonb),

    'technologies', coalesce((
      select jsonb_agg(jsonb_build_object('name', t.name, 'group', t.tech_group, 'sortOrder', t.sort_order) order by t.sort_order)
      from public.technologies t
    ), '[]'::jsonb),

    'projects', coalesce((
      select jsonb_agg(jsonb_build_object(
        'slug', p.slug,
        'kind', p.kind,
        'featured', p.featured,
        'sortOrder', p.sort_order,
        'category', (select c.slug from public.categories c where c.id = p.category_id),
        'year', p.year,
        'state', p.project_state,
        'codeVisibility', p.code_visibility,
        'demoUrl', p.demo_url,
        'repoUrl', p.repo_url,
        'videoUrl', p.video_url,
        'cover', public.media_json(p.cover_media_id),
        'gallery', coalesce((
          select jsonb_agg(public.media_json(pm.media_id) order by pm.sort_order)
          from public.project_media pm where pm.project_id = p.id
        ), '[]'::jsonb),
        'technologies', coalesce((
          select jsonb_agg(t.name order by pt.sort_order, t.sort_order)
          from public.project_technologies pt join public.technologies t on t.id = pt.technology_id
          where pt.project_id = p.id
        ), '[]'::jsonb),
        'publishedAt', p.published_at,
        'i18n', (
          select jsonb_object_agg(t.locale, jsonb_strip_nulls(jsonb_build_object(
            'title', t.title, 'summary', t.summary, 'role', t.role, 'problem', t.problem,
            'audience', t.audience, 'solution', t.solution, 'features', t.features,
            'decisions', t.decisions, 'challenges', t.challenges, 'results', t.results,
            'aiUsage', t.ai_usage, 'seoTitle', t.seo_title, 'seoDescription', t.seo_description)))
          from public.project_translations t where t.project_id = p.id
        )
      ) order by p.sort_order)
      from public.projects p
      where p.status = 'published'
    ), '[]'::jsonb),

    'experiences', coalesce((
      select jsonb_agg(jsonb_build_object(
        'organization', e.organization,
        'orgUrl', e.org_url,
        'employmentType', e.employment_type,
        'start', e.start_date,
        'end', e.end_date,
        'sortOrder', e.sort_order,
        'technologies', coalesce((
          select jsonb_agg(t.name order by et.sort_order, t.sort_order)
          from public.experience_technologies et join public.technologies t on t.id = et.technology_id
          where et.experience_id = e.id
        ), '[]'::jsonb),
        'i18n', (
          select jsonb_object_agg(t.locale, jsonb_strip_nulls(jsonb_build_object(
            'role', t.role, 'description', t.description, 'highlights', t.highlights)))
          from public.experience_translations t where t.experience_id = e.id
        )
      ) order by e.sort_order)
      from public.experiences e
    ), '[]'::jsonb),

    'education', coalesce((
      select jsonb_agg(jsonb_build_object(
        'institution', e.institution,
        'start', e.start_date,
        'end', e.end_date,
        'sortOrder', e.sort_order,
        'i18n', (
          select jsonb_object_agg(t.locale, jsonb_strip_nulls(jsonb_build_object('degree', t.degree, 'description', t.description)))
          from public.education_translations t where t.education_id = e.id
        )
      ) order by e.sort_order)
      from public.education e
    ), '[]'::jsonb),

    'links', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'kind', l.kind, 'url', l.url, 'label', l.label,
        'placements', to_jsonb(l.placements), 'sortOrder', l.sort_order)) order by l.sort_order)
      from public.links l
    ), '[]'::jsonb),

    'cv', jsonb_build_object(
      'pt', (select public.media_json(c.media_id) || jsonb_build_object('updatedAt', to_char(c.updated_at, 'YYYY-MM-DD'))
             from public.cv_files c where c.locale = 'pt'),
      'en', (select public.media_json(c.media_id) || jsonb_build_object('updatedAt', to_char(c.updated_at, 'YYYY-MM-DD'))
             from public.cv_files c where c.locale = 'en')
    )
  );
$$;
