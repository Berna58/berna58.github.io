import type { Locale, Project } from '@/lib/content/schema';

/** Imagem já resolvida para <img>: no site vem do pipeline do Astro; no painel, de URLs do Supabase. */
export interface ResolvedImage {
  src: string;
  srcSet?: string;
  sizes?: string;
  width: number;
  height: number;
  alt: string;
  caption?: string;
}

export interface ProjectViewProps {
  locale: Locale;
  project: Pick<
    Project,
    'kind' | 'year' | 'state' | 'codeVisibility' | 'demoUrl' | 'repoUrl' | 'videoUrl' | 'technologies' | 'i18n'
  >;
  categoryLabel: string;
  cover: ResolvedImage;
  gallery: ResolvedImage[];
}
