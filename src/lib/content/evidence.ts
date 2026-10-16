/**
 * Prova de cada competência, calculada a partir do conteúdo (sem níveis nem percentagens inventados):
 * uma tecnologia é "profissional" se aparece numa experiência, "de projeto" se só aparece em projetos publicados.
 */
import type { Experience, Locale, Project } from './schema';

export type SkillRow =
  | { kind: 'professional'; names: string[]; organizations: string[] }
  | { kind: 'project'; names: string[]; projects: { slug: string; title: string }[] }
  | { kind: 'other'; names: string[] };

const order = { professional: 0, project: 1, other: 2 } as const;

/** Agrupa as tecnologias pela mesma prova (ex.: "Laravel, PHP — JoyTé"), pela ordem em que chegam. */
export function skillRows(
  names: string[],
  experiences: Pick<Experience, 'organization' | 'technologies'>[],
  projects: Pick<Project, 'slug' | 'technologies' | 'i18n'>[],
  locale: Locale,
): SkillRow[] {
  const rows = new Map<string, SkillRow>();
  for (const name of names) {
    const organizations = experiences.filter((e) => e.technologies.includes(name)).map((e) => e.organization);
    const used = projects.filter((p) => p.technologies.includes(name)).map((p) => ({ slug: p.slug, title: p.i18n[locale].title }));
    const row: SkillRow = organizations.length > 0
      ? { kind: 'professional', names: [], organizations }
      : used.length > 0
        ? { kind: 'project', names: [], projects: used }
        : { kind: 'other', names: [] };
    const key = row.kind + '|' + ('organizations' in row ? row.organizations.join() : 'projects' in row ? row.projects.map((p) => p.slug).join() : '');
    const existing = rows.get(key) ?? row;
    existing.names.push(name);
    rows.set(key, existing);
  }
  return [...rows.values()].sort((a, b) => order[a.kind] - order[b.kind]);
}
