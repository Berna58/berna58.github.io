import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { siteContentSchema, publishIssues } from '@/lib/content/schema';
import { formatYearMonth } from '@/i18n/ui';
import { skillRows } from '@/lib/content/evidence';

const seed = JSON.parse(readFileSync('supabase/seed/content.json', 'utf8'));

describe('seed', () => {
  it('cumpre o contrato de conteúdo', () => {
    const result = siteContentSchema.safeParse(seed);
    expect(result.success, JSON.stringify(result.error?.issues, null, 2)).toBe(true);
  });

  it('não tem idade nem data de nascimento', () => {
    const text = JSON.stringify(seed).toLowerCase();
    expect(text).not.toMatch(/birthday|nascimento|years old|\b2[0-9] anos\b/);
  });
});

describe('publishIssues', () => {
  const base = { kind: 'case_study', technologies: ['Laravel'], i18n: { pt: { role: 'a', problem: 'b', solution: 'c' }, en: { role: 'a', problem: 'b', solution: 'c' } } };

  it('aceita um estudo de caso completo', () => {
    expect(publishIssues(base)).toEqual([]);
  });

  it('exige tecnologia e campos nos dois idiomas', () => {
    const issues = publishIssues({ ...base, technologies: [], i18n: { pt: base.i18n.pt, en: { role: 'a' } } });
    expect(issues).toContain('Indica pelo menos uma tecnologia.');
    expect(issues).toContain('Falta o problema (EN).');
    expect(issues).toContain('Falta a solução (EN).');
  });

  it('não impõe essas regras a peças visuais', () => {
    expect(publishIssues({ kind: 'showcase', technologies: [], i18n: { pt: {}, en: {} } })).toEqual([]);
  });
});

describe('formatYearMonth', () => {
  it('formata ano-mês por idioma', () => {
    expect(formatYearMonth('2024-05', 'en')).toBe('May 2024');
    expect(formatYearMonth('2024-05', 'pt')).toMatch(/^mai\.? 2024$/);
  });
  it('mantém só o ano quando não há mês', () => {
    expect(formatYearMonth('2022', 'pt')).toBe('2022');
  });
});

describe('skillRows', () => {
  const experiences = [
    { organization: 'JoyTé', technologies: ['Laravel', 'PHP'] },
    { organization: 'Liderteam', technologies: ['C#'] },
  ];
  const project = (slug: string, technologies: string[]) =>
    ({ slug, technologies, i18n: { pt: { title: slug.toUpperCase() }, en: { title: slug } } }) as never;

  it('agrupa por prova, profissional antes de projeto e do resto', () => {
    const rows = skillRows(['HTML', 'React', 'Laravel', 'C#', 'PHP'], experiences, [project('ef', ['React', 'PHP'])], 'pt');
    expect(rows).toEqual([
      { kind: 'professional', names: ['Laravel', 'PHP'], organizations: ['JoyTé'] },
      { kind: 'professional', names: ['C#'], organizations: ['Liderteam'] },
      { kind: 'project', names: ['React'], projects: [{ slug: 'ef', title: 'EF' }] },
      { kind: 'other', names: ['HTML'] },
    ]);
  });

  it('sem experiências nem projetos, tudo fica sem prova', () => {
    expect(skillRows(['SQL'], [], [], 'en')).toEqual([{ kind: 'other', names: ['SQL'] }]);
  });
});
