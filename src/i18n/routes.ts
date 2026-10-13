import type { Locale } from '@/lib/content/schema';

export const routes = {
  home: { pt: '/', en: '/en/' },
  projects: { pt: '/projetos/', en: '/en/projects/' },
  about: { pt: '/percurso/', en: '/en/about/' },
} as const;

export type RouteKey = keyof typeof routes;

export const otherLocale = (locale: Locale): Locale => (locale === 'pt' ? 'en' : 'pt');

export const projectPath = (slug: string, locale: Locale) =>
  locale === 'pt' ? `/projetos/${slug}/` : `/en/projects/${slug}/`;

export const contactHref = (locale: Locale) => `${routes.home[locale]}#contacto`;
