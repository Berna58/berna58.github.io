/**
 * Acesso ao conteúdo durante o build. Lê src/generated/content.json (gerado por scripts/sync-content.mjs)
 * e resolve as imagens locais para que o Astro as otimize.
 */
import type { ImageMetadata } from 'astro';
import raw from '@/generated/content.json';
import { siteContentSchema, type Locale, type Media, type Link } from './schema';

const content = siteContentSchema.parse(raw);

const images = import.meta.glob<{ default: ImageMetadata }>('/src/generated/media/*.{jpg,jpeg,png,webp,avif}', {
  eager: true,
});

export function imageOf(media: Media): ImageMetadata {
  const mod = images[`/src/generated/media/${media.file}`];
  if (!mod) throw new Error(`Imagem em falta no conteúdo gerado: ${media.file}`);
  return mod.default;
}

const bySort = <T extends { sortOrder: number }>(a: T, b: T) => a.sortOrder - b.sortOrder;

export const profile = content.profile;
export const site = content.site;
export const categories = [...content.categories].sort(bySort);
export const technologies = [...content.technologies].sort(bySort);
export const projects = [...content.projects].sort(bySort);
export const experiences = [...content.experiences].sort(bySort);
export const education = [...content.education].sort(bySort);

export const featuredProjects = () => projects.filter((p) => p.featured);
export const designProjects = () => projects.filter((p) => p.category === 'design');

export const linksFor = (placement: Link['placements'][number]) =>
  [...content.links].filter((l) => l.placements.includes(placement)).sort(bySort);

export const categoryName = (slug: string, locale: Locale) =>
  categories.find((c) => c.slug === slug)?.i18n[locale].name ?? slug;

/** CV no idioma pedido; se não existir, o do outro idioma (sinalizado com `fallback`). */
export function cvFor(locale: Locale): { href: string; fallback: boolean } | null {
  const own = content.cv[locale];
  if (own) return { href: `/cv/${own.file}`, fallback: false };
  const other = content.cv[locale === 'pt' ? 'en' : 'pt'];
  return other ? { href: `/cv/${other.file}`, fallback: true } : null;
}
