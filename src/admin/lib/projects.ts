/** Acesso aos projetos a partir do painel. Toda a escrita passa por funções SQL transacionais. */
import { z } from 'zod';
import { supabase, functionsUrl } from './supabase';
import { prepareImage } from './images';
import { publishIssues, type Locale } from '@/lib/content/schema';

export const LOCALES: Locale[] = ['pt', 'en'];
export type Status = 'draft' | 'published' | 'unpublished';
export type Kind = 'case_study' | 'showcase';

export interface MediaItem {
  id: string;
  path: string;
  width: number | null;
  height: number | null;
  alt: Record<Locale, string>;
  url?: string;
}

export interface TextFields {
  title: string;
  summary: string;
  role: string;
  problem: string;
  audience: string;
  solution: string;
  features: { title: string; description: string }[];
  decisions: { decision: string; reason: string }[];
  challenges: { challenge: string; solution: string }[];
  results: string;
  ai_usage: string;
  seo_title: string;
  seo_description: string;
}

export interface ProjectForm {
  id: string | null;
  status: Status;
  slug: string;
  kind: Kind;
  featured: boolean;
  category_id: string;
  year: string;
  project_state: string;
  code_visibility: 'public' | 'private' | 'confidential';
  demo_url: string;
  repo_url: string;
  video_url: string;
  translations: Record<Locale, TextFields>;
  technology_ids: string[];
  cover: MediaItem | null;
  gallery: MediaItem[];
}

export const emptyText = (): TextFields => ({
  title: '', summary: '', role: '', problem: '', audience: '', solution: '',
  features: [], decisions: [], challenges: [], results: '', ai_usage: '', seo_title: '', seo_description: '',
});

export const emptyProject = (): ProjectForm => ({
  id: null, status: 'draft', slug: '', kind: 'case_study', featured: false, category_id: '', year: '',
  project_state: '', code_visibility: 'private', demo_url: '', repo_url: '', video_url: '',
  translations: { pt: emptyText(), en: emptyText() }, technology_ids: [], cover: null, gallery: [],
});

// ---------- leitura ----------

export interface ProjectRow {
  id: string;
  slug: string;
  status: Status;
  featured: boolean;
  kind: Kind;
  category: string;
  title: string;
}

export async function listProjects(): Promise<ProjectRow[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, slug, status, featured, kind, sort_order, categories(slug), project_translations(locale, title)')
    .order('sort_order')
    .order('id');
  if (error) throw error;
  return data.map((p) => ({
    id: p.id,
    slug: p.slug,
    status: p.status,
    featured: p.featured,
    kind: p.kind,
    category: p.categories?.slug ?? '',
    title: p.project_translations.find((t) => t.locale === 'pt')?.title || p.slug,
  }));
}

export interface Taxonomies {
  categories: { id: string; slug: string; name: string }[];
  technologies: { id: string; name: string; group: string }[];
}

export async function loadTaxonomies(): Promise<Taxonomies> {
  const [categories, technologies] = await Promise.all([
    supabase.from('categories').select('id, slug, category_translations(locale, name)').order('sort_order'),
    supabase.from('technologies').select('id, name, tech_group').order('sort_order'),
  ]);
  if (categories.error) throw categories.error;
  if (technologies.error) throw technologies.error;
  return {
    categories: categories.data.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.category_translations.find((t) => t.locale === 'pt')?.name ?? c.slug,
    })),
    technologies: technologies.data.map((t) => ({ id: t.id, name: t.name, group: t.tech_group })),
  };
}

const MEDIA = 'id, storage_path, width, height, media_translations(locale, alt)';

type MediaRow = {
  id: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  media_translations: { locale: Locale; alt: string }[];
};

const toMedia = (m: MediaRow): MediaItem => ({
  id: m.id,
  path: m.storage_path,
  width: m.width,
  height: m.height,
  alt: {
    pt: m.media_translations.find((t) => t.locale === 'pt')?.alt ?? '',
    en: m.media_translations.find((t) => t.locale === 'en')?.alt ?? '',
  },
});

/** URLs temporárias (1 hora) para mostrar imagens do bucket privado. */
export async function withSignedUrls(items: MediaItem[]): Promise<MediaItem[]> {
  if (items.length === 0) return items;
  const { data, error } = await supabase.storage.from('media').createSignedUrls(items.map((m) => m.path), 3600);
  if (error) throw error;
  return items.map((m, i) => ({ ...m, url: data[i]?.signedUrl ?? undefined }));
}

export async function loadProject(id: string): Promise<ProjectForm> {
  const { data: p, error } = await supabase
    .from('projects')
    .select(
      `*, project_translations(*), project_technologies(technology_id, sort_order), project_media(sort_order, media(${MEDIA})), cover:media!projects_cover_media_id_fkey(${MEDIA})`,
    )
    .eq('id', id)
    .single();
  if (error) throw error;

  const translations = { pt: emptyText(), en: emptyText() };
  for (const t of p.project_translations) {
    translations[t.locale] = {
      title: t.title,
      summary: t.summary,
      role: t.role ?? '',
      problem: t.problem ?? '',
      audience: t.audience ?? '',
      solution: t.solution ?? '',
      features: (t.features as unknown as TextFields['features']) ?? [],
      decisions: (t.decisions as unknown as TextFields['decisions']) ?? [],
      challenges: (t.challenges as unknown as TextFields['challenges']) ?? [],
      results: t.results ?? '',
      ai_usage: t.ai_usage ?? '',
      seo_title: t.seo_title ?? '',
      seo_description: t.seo_description ?? '',
    };
  }

  const galleryRows = [...p.project_media]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((pm) => toMedia(pm.media as unknown as MediaRow));
  const cover = p.cover ? toMedia(p.cover as unknown as MediaRow) : null;
  const signed = await withSignedUrls([...(cover ? [cover] : []), ...galleryRows]);

  return {
    id: p.id,
    status: p.status,
    slug: p.slug,
    kind: p.kind,
    featured: p.featured,
    category_id: p.category_id ?? '',
    year: p.year?.toString() ?? '',
    project_state: p.project_state ?? '',
    code_visibility: p.code_visibility,
    demo_url: p.demo_url ?? '',
    repo_url: p.repo_url ?? '',
    video_url: p.video_url ?? '',
    translations,
    technology_ids: [...p.project_technologies].sort((a, b) => a.sort_order - b.sort_order).map((t) => t.technology_id),
    cover: cover ? signed[0] : null,
    gallery: cover ? signed.slice(1) : signed,
  };
}

// ---------- validação ----------

const httpsOrEmpty = z.string().trim().regex(/^(https:\/\/\S+)?$/, 'Tem de começar por https://');

const draftSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Só letras minúsculas, números e hífenes (ex.: gestor-de-reservas).'),
  year: z.string().trim().regex(/^(20\d\d)?$/, 'Ano com 4 dígitos (ex.: 2025).'),
  demo_url: httpsOrEmpty,
  repo_url: httpsOrEmpty,
  video_url: httpsOrEmpty,
});

/** Erros que impedem até guardar como rascunho, por campo. */
export function draftErrors(form: ProjectForm): Record<string, string> {
  const result = draftSchema.safeParse(form);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message]));
}

/** O que falta para poder publicar: as mesmas regras que a base de dados aplica. */
export function publishProblems(form: ProjectForm, techNames: (ids: string[]) => string[]): string[] {
  const problems: string[] = [];
  if (!form.cover) problems.push('Falta a imagem de capa.');
  else if (!form.cover.alt.pt || !form.cover.alt.en) problems.push('Falta o texto alternativo da capa em PT e EN.');
  if (!form.category_id) problems.push('Falta a categoria.');
  for (const locale of LOCALES) {
    const t = form.translations[locale];
    if (!t.title.trim()) problems.push(`Falta o título (${locale.toUpperCase()}).`);
    if (!t.summary.trim()) problems.push(`Falta a frase de resumo (${locale.toUpperCase()}).`);
  }
  const trimmed = (locale: Locale) => ({
    role: form.translations[locale].role.trim(),
    problem: form.translations[locale].problem.trim(),
    solution: form.translations[locale].solution.trim(),
  });
  problems.push(
    ...publishIssues({ kind: form.kind, technologies: techNames(form.technology_ids), i18n: { pt: trimmed('pt'), en: trimmed('en') } }),
  );
  return problems;
}

// ---------- escrita ----------

/** Remove espaços e descarta linhas de listas que ficaram incompletas. */
function cleanList<T extends Record<string, string>>(items: T[]): T[] {
  return items
    .map((item) => {
      const copy = { ...item };
      for (const key of Object.keys(copy) as (keyof T)[]) copy[key] = String(copy[key]).trim() as T[keyof T];
      return copy;
    })
    .filter((item) => Object.values(item).every((value) => value !== ''));
}

export async function saveProject(form: ProjectForm): Promise<string> {
  const translations: Record<string, unknown> = {};
  for (const locale of LOCALES) {
    const t = form.translations[locale];
    translations[locale] = {
      ...t,
      features: cleanList(t.features),
      decisions: cleanList(t.decisions),
      challenges: cleanList(t.challenges),
    };
  }
  const { data, error } = await supabase.rpc('save_project', {
    payload: {
      id: form.id,
      slug: form.slug.trim(),
      kind: form.kind,
      featured: form.featured,
      category_id: form.category_id,
      year: form.year.trim(),
      project_state: form.project_state,
      code_visibility: form.code_visibility,
      demo_url: form.demo_url.trim(),
      repo_url: form.repo_url.trim(),
      video_url: form.video_url.trim(),
      cover_media_id: form.cover?.id ?? '',
      translations,
      technology_ids: form.technology_ids,
      gallery_ids: form.gallery.map((m) => m.id),
    } as never,
  });
  if (error) throw error;
  return data;
}

export async function setStatus(id: string, status: Status) {
  const { error } = await supabase.rpc('set_project_status', { project_id: id, new_status: status });
  if (error) throw error;
}

export async function moveProject(id: string, direction: -1 | 1) {
  const { error } = await supabase.rpc('move_project', { project_id: id, direction });
  if (error) throw error;
}

export async function deleteProject(id: string) {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) throw error;
}

/** Reduz a imagem, envia-a para o bucket privado e regista-a com o texto alternativo PT/EN. */
export async function uploadImage(file: File, alt: Record<Locale, string>): Promise<MediaItem> {
  const image = await prepareImage(file);
  const path = `projects/${crypto.randomUUID()}.webp`;
  const upload = await supabase.storage.from('media').upload(path, image.blob, { contentType: 'image/webp' });
  if (upload.error) throw upload.error;
  const { data: media, error } = await supabase
    .from('media')
    .insert({ storage_path: path, mime_type: 'image/webp', width: image.width, height: image.height, byte_size: image.blob.size })
    .select('id')
    .single();
  if (error) throw error;
  const translations = await supabase
    .from('media_translations')
    .insert(LOCALES.map((locale) => ({ media_id: media.id, locale, alt: alt[locale].trim() })));
  if (translations.error) throw translations.error;
  const [signed] = await withSignedUrls([{ id: media.id, path, width: image.width, height: image.height, alt }]);
  return signed;
}

// ---------- publicação do site ----------

async function callFunction(name: string, method: 'GET' | 'POST') {
  const { data } = await supabase.auth.getSession();
  const response = await fetch(`${functionsUrl}/${name}`, {
    method,
    headers: { Authorization: `Bearer ${data.session?.access_token ?? ''}` },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `O servidor respondeu com o código ${response.status}.`);
  return body;
}

export interface BuildState {
  status: 'queued' | 'in_progress' | 'completed' | 'unknown';
  conclusion: string | null;
  createdAt: string | null;
  url: string | null;
}

export const triggerBuild = () => callFunction('trigger-build', 'POST');
export const buildStatus = (): Promise<BuildState> => callFunction('build-status', 'GET');
