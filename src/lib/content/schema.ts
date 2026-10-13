/**
 * Contrato do conteúdo do site.
 *
 * O mesmo esquema valida:
 *  - o seed local (supabase/seed/content.json), usado em desenvolvimento e no CI;
 *  - o ficheiro gerado a partir do Supabase antes de cada build (src/generated/content.json).
 * Se o conteúdo não cumprir as regras de publicação, o build falha em vez de publicar algo incompleto.
 */
import { z } from 'zod';

export const LOCALES = ['pt', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

const bilingual = <T extends z.ZodType>(schema: T) => z.object({ pt: schema, en: schema });

const text = z.string().trim().min(1);
const httpsUrl = z.string().regex(/^https:\/\/\S+$/, 'O endereço tem de começar por https://');
const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Só letras minúsculas, números e hífenes');
/** Ano ("2022") ou ano-mês ("2024-05"). */
const yearMonth = z.string().regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/);

export const mediaSchema = z.object({
  file: text,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  i18n: bilingual(z.object({ alt: text, caption: z.string().trim().optional() })),
});

export const technologySchema = z.object({
  name: text,
  group: z.enum(['backend', 'frontend', 'data', 'design', 'tools']),
  sortOrder: z.number().int(),
});

export const categorySchema = z.object({
  slug,
  sortOrder: z.number().int(),
  i18n: bilingual(z.object({ name: text })),
});

const projectTextSchema = z.object({
  title: text,
  summary: text,
  role: z.string().trim().optional(),
  problem: z.string().trim().optional(),
  audience: z.string().trim().optional(),
  solution: z.string().trim().optional(),
  features: z.array(z.object({ title: text, description: text })).default([]),
  decisions: z.array(z.object({ decision: text, reason: text })).default([]),
  challenges: z.array(z.object({ challenge: text, solution: text })).default([]),
  results: z.string().trim().optional(),
  aiUsage: z.string().trim().optional(),
  seoTitle: z.string().trim().optional(),
  seoDescription: z.string().trim().optional(),
});

export const projectSchema = z
  .object({
    slug,
    kind: z.enum(['case_study', 'showcase']),
    featured: z.boolean(),
    sortOrder: z.number().int(),
    category: slug,
    year: z.number().int().min(2000).max(2100).nullable(),
    state: z.enum(['production', 'in_development', 'experimental', 'completed']).nullable(),
    codeVisibility: z.enum(['public', 'private', 'confidential']),
    demoUrl: httpsUrl.nullable(),
    repoUrl: httpsUrl.nullable(),
    videoUrl: httpsUrl.nullable(),
    cover: mediaSchema,
    gallery: z.array(mediaSchema).default([]),
    technologies: z.array(text).default([]),
    publishedAt: z.string(),
    i18n: bilingual(projectTextSchema),
  })
  .superRefine((project, ctx) => {
    for (const issue of publishIssues(project)) ctx.addIssue({ code: 'custom', message: issue });
  });

export type Project = z.infer<typeof projectSchema>;

/**
 * Regras de publicação partilhadas com o painel: um projeto só pode ser publicado se a lista estiver vazia.
 * Estudos de caso exigem papel, problema e solução nos dois idiomas e pelo menos uma tecnologia.
 */
export function publishIssues(project: {
  kind: string;
  technologies: string[];
  i18n: Record<Locale, { role?: string; problem?: string; solution?: string }>;
}): string[] {
  const issues: string[] = [];
  if (project.kind !== 'case_study') return issues;
  if (project.technologies.length === 0) issues.push('Indica pelo menos uma tecnologia.');
  for (const locale of LOCALES) {
    const t = project.i18n[locale];
    if (!t.role) issues.push(`Falta o papel (${locale.toUpperCase()}).`);
    if (!t.problem) issues.push(`Falta o problema (${locale.toUpperCase()}).`);
    if (!t.solution) issues.push(`Falta a solução (${locale.toUpperCase()}).`);
  }
  return issues;
}

export const experienceSchema = z.object({
  organization: text,
  orgUrl: httpsUrl.nullable(),
  employmentType: z.enum(['full_time', 'part_time', 'internship', 'freelance']),
  start: yearMonth,
  end: yearMonth.nullable(),
  sortOrder: z.number().int(),
  technologies: z.array(text).default([]),
  i18n: bilingual(
    z.object({ role: text, description: z.string().trim().optional(), highlights: z.array(text).default([]) }),
  ),
});

export const educationSchema = z.object({
  institution: text,
  start: yearMonth,
  end: yearMonth.nullable(),
  sortOrder: z.number().int(),
  i18n: bilingual(z.object({ degree: text, description: z.string().trim().optional() })),
});

export const linkSchema = z.object({
  kind: z.enum(['linkedin', 'github', 'behance', 'instagram', 'facebook', 'email', 'other']),
  url: z.string().regex(/^(https:\/\/|mailto:)\S+$/),
  label: z.string().trim().optional(),
  placements: z.array(z.enum(['hero', 'contact', 'footer', 'design'])).min(1),
  sortOrder: z.number().int(),
});

export const siteContentSchema = z.object({
  generatedAt: z.string(),
  source: z.enum(['fixtures', 'supabase']),
  profile: z.object({
    fullName: text,
    email: z.email(),
    available: z.boolean(),
    workModes: z.array(z.enum(['remote', 'hybrid', 'onsite'])),
    workZones: z.array(text),
    photo: mediaSchema.nullable(),
    i18n: bilingual(
      z.object({
        headline: text,
        roleLine: text,
        location: text,
        bioShort: text,
        bioLong: text,
        aiNote: z.string().trim().optional(),
        principles: z.array(z.object({ title: text, description: text, projectSlug: slug.optional() })).default([]),
      }),
    ),
  }),
  site: z.object({
    ogImage: mediaSchema.nullable(),
    i18n: bilingual(z.object({ title: text, description: text })),
  }),
  categories: z.array(categorySchema),
  technologies: z.array(technologySchema),
  projects: z.array(projectSchema),
  experiences: z.array(experienceSchema),
  education: z.array(educationSchema),
  links: z.array(linkSchema),
  cv: bilingual(z.object({ file: text, updatedAt: z.string() }).nullable()),
});

export type SiteContent = z.infer<typeof siteContentSchema>;
export type Media = z.infer<typeof mediaSchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type Education = z.infer<typeof educationSchema>;
export type Link = z.infer<typeof linkSchema>;
