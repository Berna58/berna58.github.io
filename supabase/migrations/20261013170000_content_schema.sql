-- Modelo de conteúdo do portefólio.
-- Cada entidade traduzível tem uma tabela *_translations com uma linha por idioma (pt, en).
-- Os rascunhos podem estar incompletos; as regras de publicação estão em 20261013170100.

create type public.app_locale as enum ('pt', 'en');
create type public.publish_status as enum ('draft', 'published', 'unpublished');
create type public.project_kind as enum ('case_study', 'showcase');
create type public.project_state as enum ('production', 'in_development', 'experimental', 'completed');
create type public.code_visibility as enum ('public', 'private', 'confidential');
create type public.tech_group as enum ('backend', 'frontend', 'data', 'design', 'tools');
create type public.employment_type as enum ('full_time', 'part_time', 'internship', 'freelance');
create type public.link_kind as enum ('linkedin', 'github', 'behance', 'instagram', 'facebook', 'email', 'other');
create type public.link_placement as enum ('hero', 'contact', 'footer', 'design');
create type public.work_mode as enum ('remote', 'hybrid', 'onsite');

create domain public.slug as text check (value ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
create domain public.https_url as text check (value ~ '^https://\S+$');
-- ano ("2022") ou ano-mês ("2024-05")
create domain public.year_month as text check (value ~ '^\d{4}(-(0[1-9]|1[0-2]))?$');

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Contas com permissão de administração (só uma, criada à mão).
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Ficheiros no bucket privado "media" (imagens e PDFs).
create table public.media (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  mime_type text not null,
  width integer check (width > 0),
  height integer check (height > 0),
  byte_size integer check (byte_size > 0),
  created_at timestamptz not null default now()
);

create table public.media_translations (
  media_id uuid not null references public.media (id) on delete cascade,
  locale public.app_locale not null,
  alt text not null check (length(trim(alt)) > 0),
  caption text,
  primary key (media_id, locale)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug public.slug not null unique,
  sort_order integer not null default 0
);

create table public.category_translations (
  category_id uuid not null references public.categories (id) on delete cascade,
  locale public.app_locale not null,
  name text not null check (length(trim(name)) > 0),
  primary key (category_id, locale)
);

create table public.technologies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  tech_group public.tech_group not null,
  sort_order integer not null default 0
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  slug public.slug not null unique,
  kind public.project_kind not null default 'case_study',
  status public.publish_status not null default 'draft',
  featured boolean not null default false,
  sort_order integer not null default 0,
  category_id uuid references public.categories (id) on delete restrict,
  year smallint check (year between 2000 and 2100),
  project_state public.project_state,
  code_visibility public.code_visibility not null default 'private',
  demo_url public.https_url,
  repo_url public.https_url,
  video_url public.https_url,
  cover_media_id uuid references public.media (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_status_order_idx on public.projects (status, sort_order);
create index projects_category_idx on public.projects (category_id);
create index projects_cover_idx on public.projects (cover_media_id);
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

create table public.project_translations (
  project_id uuid not null references public.projects (id) on delete cascade,
  locale public.app_locale not null,
  title text not null default '',
  summary text not null default '',
  role text,
  problem text,
  audience text,
  solution text,
  -- [{ "title": "...", "description": "..." }]
  features jsonb not null default '[]' check (jsonb_typeof(features) = 'array'),
  -- [{ "decision": "...", "reason": "..." }]
  decisions jsonb not null default '[]' check (jsonb_typeof(decisions) = 'array'),
  -- [{ "challenge": "...", "solution": "..." }]
  challenges jsonb not null default '[]' check (jsonb_typeof(challenges) = 'array'),
  results text,
  ai_usage text,
  seo_title text,
  seo_description text,
  primary key (project_id, locale)
);

create table public.project_media (
  project_id uuid not null references public.projects (id) on delete cascade,
  media_id uuid not null references public.media (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (project_id, media_id)
);
create index project_media_media_idx on public.project_media (media_id);

create table public.project_technologies (
  project_id uuid not null references public.projects (id) on delete cascade,
  technology_id uuid not null references public.technologies (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (project_id, technology_id)
);
create index project_technologies_tech_idx on public.project_technologies (technology_id);

-- Perfil: uma única linha (id = 1).
create table public.profile (
  id smallint primary key default 1 check (id = 1),
  full_name text not null,
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  available boolean not null default true,
  work_modes public.work_mode[] not null default '{}',
  work_zones text[] not null default '{}',
  photo_media_id uuid references public.media (id) on delete set null,
  updated_at timestamptz not null default now()
);
create trigger profile_touch before update on public.profile
  for each row execute function public.touch_updated_at();

create table public.profile_translations (
  locale public.app_locale primary key,
  headline text not null,
  role_line text not null,
  location text not null,
  bio_short text not null,
  bio_long text not null,
  ai_note text,
  -- [{ "title": "...", "description": "...", "projectSlug": "..." }]
  principles jsonb not null default '[]' check (jsonb_typeof(principles) = 'array')
);

create table public.experiences (
  id uuid primary key default gen_random_uuid(),
  organization text not null,
  org_url public.https_url,
  employment_type public.employment_type not null,
  start_date public.year_month not null,
  -- comparação textual: "2025-02" >= "2024" é verdade; "2023-12" >= "2024" é falso
  end_date public.year_month check (end_date is null or end_date >= left(start_date, 4)),
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);
create trigger experiences_touch before update on public.experiences
  for each row execute function public.touch_updated_at();

create table public.experience_translations (
  experience_id uuid not null references public.experiences (id) on delete cascade,
  locale public.app_locale not null,
  role text not null,
  description text,
  highlights jsonb not null default '[]' check (jsonb_typeof(highlights) = 'array'),
  primary key (experience_id, locale)
);

create table public.experience_technologies (
  experience_id uuid not null references public.experiences (id) on delete cascade,
  technology_id uuid not null references public.technologies (id) on delete cascade,
  sort_order integer not null default 0,
  primary key (experience_id, technology_id)
);
create index experience_technologies_tech_idx on public.experience_technologies (technology_id);

create table public.education (
  id uuid primary key default gen_random_uuid(),
  institution text not null,
  start_date public.year_month not null,
  end_date public.year_month check (end_date is null or end_date >= left(start_date, 4)),
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);
create trigger education_touch before update on public.education
  for each row execute function public.touch_updated_at();

create table public.education_translations (
  education_id uuid not null references public.education (id) on delete cascade,
  locale public.app_locale not null,
  degree text not null,
  description text,
  primary key (education_id, locale)
);

create table public.links (
  id uuid primary key default gen_random_uuid(),
  kind public.link_kind not null,
  url text not null check (url ~ '^(https://|mailto:)\S+$'),
  label text,
  placements public.link_placement[] not null check (cardinality(placements) > 0),
  sort_order integer not null default 0
);

create table public.cv_files (
  locale public.app_locale primary key,
  media_id uuid not null references public.media (id) on delete restrict,
  updated_at timestamptz not null default now()
);
create index cv_files_media_idx on public.cv_files (media_id);
create trigger cv_files_touch before update on public.cv_files
  for each row execute function public.touch_updated_at();

-- Definições gerais do site: uma única linha (id = 1).
create table public.site_settings (
  id smallint primary key default 1 check (id = 1),
  og_media_id uuid references public.media (id) on delete set null
);

create table public.site_settings_translations (
  locale public.app_locale primary key,
  title text not null,
  description text not null
);
