-- Segurança: RLS, grants explícitos e storage.
--
-- Princípios (ver docs/adr/0002-seguranca.md):
--   * anon (visitantes) não tem acesso a nenhuma tabela: o site público é estático e o conteúdo
--     chega-lhe pelo build, que usa o service_role.
--   * authenticated só pode ler ou escrever se for admin E tiver a sessão confirmada com MFA (aal2).
--   * Os grants são explícitos (a Data API do Supabase deixou de os dar por omissão em projetos novos).

-- Admin = está na tabela admins e entrou com o segundo fator.
-- security definer para poder ler public.admins sem depender das políticas dessa tabela.
create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt() ->> 'aal') = 'aal2', false)
     and exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- A tabela admins: cada utilizador só vê a própria linha (o painel usa isto para saber se é admin).
-- Não há políticas de escrita: a conta de admin é criada à mão, em SQL.
alter table public.admins enable row level security;
create policy "ver a propria linha de admin" on public.admins
  for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.admins from anon, authenticated;
grant select on public.admins to authenticated;
grant all on public.admins to service_role;

-- Todas as tabelas de conteúdo: só o admin com MFA lê e escreve.
do $$
declare
  t text;
begin
  foreach t in array array[
    'media', 'media_translations',
    'categories', 'category_translations', 'technologies',
    'projects', 'project_translations', 'project_media', 'project_technologies',
    'profile', 'profile_translations',
    'experiences', 'experience_translations', 'experience_technologies',
    'education', 'education_translations',
    'links', 'cv_files', 'site_settings', 'site_settings_translations'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "admin com MFA gere o conteudo" on public.%I for all to authenticated '
      'using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end;
$$;

-- Funções: exportação só para o service_role (build); verificação de publicação para o painel.
revoke all on function public.export_published_content() from public, anon, authenticated;
grant execute on function public.export_published_content() to service_role;

revoke all on function public.media_json(uuid) from public, anon, authenticated;
grant execute on function public.media_json(uuid) to service_role;

revoke all on function public.project_publish_issues(public.projects) from public, anon;
grant execute on function public.project_publish_issues(public.projects) to authenticated, service_role;

revoke all on function public.project_publish_issues_by_id(uuid) from public, anon;
grant execute on function public.project_publish_issues_by_id(uuid) to authenticated, service_role;

-- Storage: bucket privado para imagens e CV (máx. 10 MB por ficheiro).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf'])
on conflict (id) do nothing;

create policy "admin com MFA gere a media" on storage.objects
  for all to authenticated
  using (bucket_id = 'media' and (select public.is_admin()))
  with check (bucket_id = 'media' and (select public.is_admin()));
