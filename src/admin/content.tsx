/**
 * Restantes conteúdos do site: perfil, percurso, taxonomias, ligações, CV e SEO.
 * Escritas com várias tabelas passam por funções SQL (save_*); tabelas simples são escritas diretamente (RLS).
 */
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { supabase, describeError } from './lib/supabase';
import { LOCALES, withSignedUrls, type MediaItem } from './lib/projects';
import { Field, Fieldset, ListEditor, MediaField } from './projects';
import type { Locale } from '@/lib/content/schema';

const YEAR_MONTH = /^\d{4}(-(0[1-9]|1[0-2]))?$/;
const HTTPS = /^https:\/\/\S+$/;
const WORK_MODES = [['remote', 'Remoto'], ['hybrid', 'Híbrido'], ['onsite', 'Presencial']] as const;
const EMPLOYMENT = [['full_time', 'Tempo inteiro'], ['part_time', 'Part-time'], ['internship', 'Estágio'], ['freelance', 'Freelance']] as const;
const GROUPS = [['backend', 'Backend'], ['frontend', 'Frontend'], ['data', 'Dados'], ['design', 'Design'], ['tools', 'Ferramentas']] as const;
const LINK_KINDS = ['linkedin', 'github', 'behance', 'instagram', 'facebook', 'email', 'other'] as const;
const PLACEMENTS = [['hero', 'Topo'], ['contact', 'Contacto'], ['footer', 'Rodapé'], ['design', 'Secção Design']] as const;

const MEDIA = 'id, storage_path, width, height, media_translations(locale, alt)';
type MediaRow = { id: string; storage_path: string; width: number | null; height: number | null; media_translations: { locale: Locale; alt: string }[] };
const toMedia = (m: MediaRow): MediaItem => ({
  id: m.id, path: m.storage_path, width: m.width, height: m.height,
  alt: { pt: m.media_translations.find((t) => t.locale === 'pt')?.alt ?? '', en: m.media_translations.find((t) => t.locale === 'en')?.alt ?? '' },
});

// ---------- peças comuns ----------

type Notice = { tone: 'ok' | 'error'; text: string } | null;

function NoticeLine({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return <p className={notice.tone === 'ok' ? 'adm-ok' : 'adm-error'} role={notice.tone === 'ok' ? 'status' : 'alert'}>{notice.text}</p>;
}

function LangTabs({ locale, onChange }: { locale: Locale; onChange: (l: Locale) => void }) {
  return (
    <div className="adm-langs" role="group" aria-label="Idioma dos textos">
      {LOCALES.map((l) => (
        <button key={l} type="button" className="adm-chip" aria-pressed={locale === l} onClick={() => onChange(l)}>{l === 'pt' ? 'Português' : 'English'}</button>
      ))}
    </div>
  );
}

function Section({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <section className="adm-section" aria-labelledby="section-title">
      <h1 id="section-title">{title}</h1>
      {intro && <p className="muted">{intro}</p>}
      {children}
    </section>
  );
}

const savedMessage: Notice = { tone: 'ok', text: 'Guardado. Usa "Publicar alterações no site" para atualizar o site.' };

function OrderButtons({ label, first, last, onMove }: { label: string; first: boolean; last: boolean; onMove: (d: -1 | 1) => void }) {
  return (
    <>
      <button type="button" className="btn adm-icon" disabled={first} onClick={() => onMove(-1)} aria-label={`Subir ${label}`}>↑</button>
      <button type="button" className="btn adm-icon" disabled={last} onClick={() => onMove(1)} aria-label={`Descer ${label}`}>↓</button>
    </>
  );
}

type Result = PromiseLike<{ error: unknown }>;

// =====================================================================
// Perfil
// =====================================================================

interface ProfileText { headline: string; role_line: string; location: string; bio_short: string; bio_long: string; ai_note: string; principles: { title: string; description: string; projectSlug: string }[] }
interface ProfileForm { full_name: string; email: string; available: boolean; work_modes: string[]; work_zones: string; photo: MediaItem | null; translations: Record<Locale, ProfileText> }
const emptyProfileText = (): ProfileText => ({ headline: '', role_line: '', location: '', bio_short: '', bio_long: '', ai_note: '', principles: [] });

export function ProfileSection() {
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [locale, setLocale] = useState<Locale>('pt');
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    (async () => {
      const [profile, texts] = await Promise.all([
        supabase.from('profile').select(`*, photo:media!profile_photo_media_id_fkey(${MEDIA})`).eq('id', 1).maybeSingle(),
        supabase.from('profile_translations').select('*'),
      ]);
      if (profile.error || texts.error) {
        setNotice({ tone: 'error', text: describeError(profile.error ?? texts.error) });
        return;
      }
      const p = profile.data;
      const translations = { pt: emptyProfileText(), en: emptyProfileText() };
      for (const t of texts.data) {
        translations[t.locale] = {
          headline: t.headline, role_line: t.role_line, location: t.location, bio_short: t.bio_short, bio_long: t.bio_long,
          ai_note: t.ai_note ?? '',
          principles: ((t.principles as unknown as ProfileText['principles']) ?? []).map((x) => ({ ...x, projectSlug: x.projectSlug ?? '' })),
        };
      }
      const photo = p?.photo ? (await withSignedUrls([toMedia(p.photo as unknown as MediaRow)]))[0] : null;
      setForm({
        full_name: p?.full_name ?? '', email: p?.email ?? '', available: p?.available ?? true,
        work_modes: p?.work_modes ?? [], work_zones: (p?.work_zones ?? []).join(', '), photo, translations,
      });
    })();
  }, []);

  if (!form) return <Section title="Perfil"><NoticeLine notice={notice} />{!notice && <p className="muted">A carregar…</p>}</Section>;
  const current = form;
  const t = current.translations[locale];
  const setText = (patch: Partial<ProfileText>) => setForm({ ...current, translations: { ...current.translations, [locale]: { ...t, ...patch } } });

  async function save(event: FormEvent) {
    event.preventDefault();
    const missing = LOCALES.filter((l) => {
      const x = current.translations[l];
      return [x.headline, x.role_line, x.location, x.bio_short, x.bio_long].some((v) => !v.trim());
    });
    if (!current.full_name.trim() || !/^\S+@\S+\.\S+$/.test(current.email)) {
      setNotice({ tone: 'error', text: 'Indica o nome e um email válido.' });
      return;
    }
    if (missing.length) {
      setNotice({ tone: 'error', text: `Preenche a proposta, a linha de função, a localização e as duas bios em ${missing.map((l) => l.toUpperCase()).join(' e ')}.` });
      return;
    }
    const translations: Record<string, unknown> = {};
    for (const l of LOCALES) {
      const x = current.translations[l];
      translations[l] = {
        ...x,
        principles: x.principles
          .filter((p) => p.title.trim() && p.description.trim())
          .map((p) => (p.projectSlug.trim() ? p : { title: p.title, description: p.description })),
      };
    }
    const { error } = await supabase.rpc('save_profile', {
      payload: {
        full_name: current.full_name.trim(), email: current.email.trim(), available: current.available, work_modes: current.work_modes,
        work_zones: current.work_zones.split(',').map((z) => z.trim()).filter(Boolean), photo_media_id: current.photo?.id ?? '', translations,
      } as never,
    });
    setNotice(error ? { tone: 'error', text: describeError(error) } : savedMessage);
  }

  return (
    <Section title="Perfil" intro="Proposta de valor, apresentação, disponibilidade e fotografia.">
      <NoticeLine notice={notice} />
      <form className="adm-grid" onSubmit={save}>
        <Fieldset legend="Dados e disponibilidade">
          <Field label="Nome"><input id="p-name" value={current.full_name} onChange={(e) => setForm({ ...current, full_name: e.target.value })} /></Field>
          <Field label="Email de contacto"><input id="p-email" type="email" value={current.email} onChange={(e) => setForm({ ...current, email: e.target.value })} /></Field>
          <label className="adm-check">
            <input id="p-available" type="checkbox" checked={current.available} onChange={(e) => setForm({ ...current, available: e.target.checked })} /> Disponível para novas oportunidades
          </label>
          <div className="adm-checks" role="group" aria-label="Modelos de trabalho">
            {WORK_MODES.map(([value, label]) => (
              <label key={value} className="adm-check">
                <input
                  type="checkbox"
                  checked={current.work_modes.includes(value)}
                  onChange={(e) => setForm({ ...current, work_modes: e.target.checked ? [...current.work_modes, value] : current.work_modes.filter((m) => m !== value) })}
                />{' '}
                {label}
              </label>
            ))}
          </div>
          <Field label="Zonas (separadas por vírgulas)"><input id="p-zones" value={current.work_zones} onChange={(e) => setForm({ ...current, work_zones: e.target.value })} /></Field>
        </Fieldset>
        <Fieldset legend="Fotografia">
          <MediaField label="Fotografia" items={current.photo ? [current.photo] : []} multiple={false} onChange={(items) => setForm({ ...current, photo: items[0] ?? null })} />
        </Fieldset>
        <div className="adm-span">
          <LangTabs locale={locale} onChange={setLocale} />
          <Fieldset legend={`Textos (${locale.toUpperCase()})`}>
            <Field label="Proposta de valor" hint="A parte depois do travessão ( — ) fica realçada a menta no site.">
              <input id={`p-headline-${locale}`} value={t.headline} onChange={(e) => setText({ headline: e.target.value })} />
            </Field>
            <div className="adm-row2">
              <Field label="Linha de função"><input id={`p-role-${locale}`} value={t.role_line} onChange={(e) => setText({ role_line: e.target.value })} /></Field>
              <Field label="Localização"><input id={`p-location-${locale}`} value={t.location} onChange={(e) => setText({ location: e.target.value })} /></Field>
            </div>
            <Field label="Bio curta"><textarea id={`p-bioshort-${locale}`} rows={3} value={t.bio_short} onChange={(e) => setText({ bio_short: e.target.value })} /></Field>
            <Field label="Bio longa" hint="Página Percurso. Separa parágrafos com uma linha em branco.">
              <textarea id={`p-biolong-${locale}`} rows={7} value={t.bio_long} onChange={(e) => setText({ bio_long: e.target.value })} />
            </Field>
            <Field label="Como uso IA no meu trabalho (opcional)">
              <textarea id={`p-ai-${locale}`} rows={4} value={t.ai_note} onChange={(e) => setText({ ai_note: e.target.value })} />
            </Field>
            <ListEditor
              label="Princípios de trabalho (secção 'Como trabalho')"
              items={t.principles}
              fields={[['title', 'Princípio'], ['description', 'Explicação'], ['projectSlug', 'Projeto que o prova (slug, opcional)']]}
              onChange={(principles) => setText({ principles })}
            />
          </Fieldset>
        </div>
        <div className="adm-span"><button className="btn btn--primary" type="submit">Guardar perfil</button></div>
      </form>
    </Section>
  );
}

// =====================================================================
// Percurso: experiência e formação
// =====================================================================

interface ExpText { role: string; description: string; highlights: { text: string }[] }
interface ExpForm { id: string; organization: string; org_url: string; employment_type: string; start_date: string; end_date: string; technology_ids: string[]; translations: Record<Locale, ExpText> }
interface EduForm { id: string; institution: string; start_date: string; end_date: string; translations: Record<Locale, { degree: string; description: string }> }

function periodError(start: string, end: string) {
  if (!YEAR_MONTH.test(start)) return 'Início em AAAA ou AAAA-MM (ex.: 2024-05).';
  if (end && !YEAR_MONTH.test(end)) return 'Fim em AAAA ou AAAA-MM, ou vazio se é atual.';
  if (end && end < start.slice(0, 4)) return 'O fim não pode ser antes do início.';
  return '';
}

const saveExperience = (v: ExpForm): Result =>
  supabase.rpc('save_experience', {
    payload: {
      id: v.id, organization: v.organization.trim(), org_url: v.org_url.trim(), employment_type: v.employment_type,
      start_date: v.start_date.trim(), end_date: v.end_date.trim(), technology_ids: v.technology_ids,
      translations: {
        pt: { role: v.translations.pt.role.trim(), description: v.translations.pt.description.trim(), highlights: v.translations.pt.highlights.map((h) => h.text.trim()).filter(Boolean) },
        en: { role: v.translations.en.role.trim(), description: v.translations.en.description.trim(), highlights: v.translations.en.highlights.map((h) => h.text.trim()).filter(Boolean) },
      },
    } as never,
  });

const saveEducation = (v: EduForm): Result =>
  supabase.rpc('save_education', {
    payload: { id: v.id, institution: v.institution.trim(), start_date: v.start_date.trim(), end_date: v.end_date.trim(), translations: v.translations } as never,
  });

export function PathSection() {
  const [experiences, setExperiences] = useState<ExpForm[] | null>(null);
  const [education, setEducation] = useState<EduForm[] | null>(null);
  const [technologies, setTechnologies] = useState<{ id: string; name: string }[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  async function reload() {
    const [exp, edu, tech] = await Promise.all([
      supabase.from('experiences').select('*, experience_translations(*), experience_technologies(technology_id, sort_order)').order('sort_order').order('id'),
      supabase.from('education').select('*, education_translations(*)').order('sort_order').order('id'),
      supabase.from('technologies').select('id, name').order('sort_order'),
    ]);
    const error = exp.error ?? edu.error ?? tech.error;
    if (error || !exp.data || !edu.data) {
      setNotice({ tone: 'error', text: describeError(error) });
      return;
    }
    setTechnologies(tech.data ?? []);
    setExperiences(
      exp.data.map((e) => {
        const textFor = (l: Locale): ExpText => {
          const t = e.experience_translations.find((x) => x.locale === l);
          return { role: t?.role ?? '', description: t?.description ?? '', highlights: ((t?.highlights as unknown as string[]) ?? []).map((text) => ({ text })) };
        };
        return {
          id: e.id, organization: e.organization, org_url: e.org_url ?? '', employment_type: e.employment_type, start_date: e.start_date, end_date: e.end_date ?? '',
          technology_ids: [...e.experience_technologies].sort((a, b) => a.sort_order - b.sort_order).map((t) => t.technology_id),
          translations: { pt: textFor('pt'), en: textFor('en') },
        };
      }),
    );
    setEducation(
      edu.data.map((e) => {
        const textFor = (l: Locale) => {
          const t = e.education_translations.find((x) => x.locale === l);
          return { degree: t?.degree ?? '', description: t?.description ?? '' };
        };
        return { id: e.id, institution: e.institution, start_date: e.start_date, end_date: e.end_date ?? '', translations: { pt: textFor('pt'), en: textFor('en') } };
      }),
    );
  }

  useEffect(() => {
    void reload();
  }, []);

  async function run(action: () => Result, ok: Notice = savedMessage) {
    const { error } = await action();
    if (error) {
      setNotice({ tone: 'error', text: describeError(error) });
      return;
    }
    setNotice(ok);
    setEditing(null);
    await reload();
  }

  if (!experiences || !education) return <Section title="Percurso"><NoticeLine notice={notice} />{!notice && <p className="muted">A carregar…</p>}</Section>;

  const blankExp = (): ExpForm => ({
    id: '', organization: '', org_url: '', employment_type: 'full_time', start_date: '', end_date: '', technology_ids: [],
    translations: { pt: { role: '', description: '', highlights: [] }, en: { role: '', description: '', highlights: [] } },
  });
  const blankEdu = (): EduForm => ({ id: '', institution: '', start_date: '', end_date: '', translations: { pt: { degree: '', description: '' }, en: { degree: '', description: '' } } });

  return (
    <Section title="Percurso" intro="Experiência e formação. A ordem aqui é a ordem do site (a mais recente primeiro).">
      <NoticeLine notice={notice} />
      <h2>Experiência</h2>
      <div><button type="button" className="btn" onClick={() => setEditing('new-exp')}>Adicionar experiência</button></div>
      {editing === 'new-exp' && <ExperienceEditor value={blankExp()} technologies={technologies} onCancel={() => setEditing(null)} onSave={(v) => void run(() => saveExperience(v))} />}
      <ol className="adm-list">
        {experiences.map((e, i) => (
          <li key={e.id} className="adm-row adm-row--stack">
            <div className="adm-row-main">
              <p className="adm-row-title">{e.translations.pt.role} — {e.organization}</p>
              <p className="mono muted">{e.start_date} – {e.end_date || 'atual'}</p>
            </div>
            <div className="adm-row-actions">
              <OrderButtons label={e.organization} first={i === 0} last={i === experiences.length - 1}
                onMove={(d) => void run(() => supabase.rpc('move_item', { item_table: 'experiences', item_id: e.id, direction: d }), null)} />
              <button type="button" className="btn" onClick={() => setEditing(e.id)}>Editar</button>
              <button type="button" className="btn adm-btn-danger"
                onClick={() => { if (window.confirm(`Eliminar a experiência em ${e.organization}?`)) void run(() => supabase.from('experiences').delete().eq('id', e.id)); }}>
                Eliminar
              </button>
            </div>
            {editing === e.id && <ExperienceEditor value={e} technologies={technologies} onCancel={() => setEditing(null)} onSave={(v) => void run(() => saveExperience(v))} />}
          </li>
        ))}
      </ol>

      <h2>Formação</h2>
      <div><button type="button" className="btn" onClick={() => setEditing('new-edu')}>Adicionar formação</button></div>
      {editing === 'new-edu' && <EducationEditor value={blankEdu()} onCancel={() => setEditing(null)} onSave={(v) => void run(() => saveEducation(v))} />}
      <ol className="adm-list">
        {education.map((e, i) => (
          <li key={e.id} className="adm-row adm-row--stack">
            <div className="adm-row-main">
              <p className="adm-row-title">{e.translations.pt.degree}</p>
              <p className="mono muted">{e.institution} · {e.start_date} – {e.end_date || 'atual'}</p>
            </div>
            <div className="adm-row-actions">
              <OrderButtons label={e.institution} first={i === 0} last={i === education.length - 1}
                onMove={(d) => void run(() => supabase.rpc('move_item', { item_table: 'education', item_id: e.id, direction: d }), null)} />
              <button type="button" className="btn" onClick={() => setEditing(e.id)}>Editar</button>
              <button type="button" className="btn adm-btn-danger"
                onClick={() => { if (window.confirm(`Eliminar a formação em ${e.institution}?`)) void run(() => supabase.from('education').delete().eq('id', e.id)); }}>
                Eliminar
              </button>
            </div>
            {editing === e.id && <EducationEditor value={e} onCancel={() => setEditing(null)} onSave={(v) => void run(() => saveEducation(v))} />}
          </li>
        ))}
      </ol>
    </Section>
  );
}

function ExperienceEditor({ value, technologies, onSave, onCancel }: { value: ExpForm; technologies: { id: string; name: string }[]; onSave: (v: ExpForm) => void; onCancel: () => void }) {
  const [v, setV] = useState(value);
  const [locale, setLocale] = useState<Locale>('pt');
  const [error, setError] = useState('');
  const t = v.translations[locale];
  const setT = (patch: Partial<ExpText>) => setV({ ...v, translations: { ...v.translations, [locale]: { ...t, ...patch } } });
  function submit(event: FormEvent) {
    event.preventDefault();
    const problem = !v.organization.trim()
      ? 'Indica a organização.'
      : v.org_url && !HTTPS.test(v.org_url)
        ? 'O site da organização tem de começar por https://.'
        : periodError(v.start_date, v.end_date) || (LOCALES.some((l) => !v.translations[l].role.trim()) ? 'Indica a função em PT e EN.' : '');
    if (problem) {
      setError(problem);
      return;
    }
    onSave(v);
  }
  return (
    <form className="adm-inline-editor" onSubmit={submit}>
      <div className="adm-row2">
        <Field label="Organização"><input value={v.organization} onChange={(e) => setV({ ...v, organization: e.target.value })} /></Field>
        <Field label="Site da organização (opcional)"><input type="url" value={v.org_url} onChange={(e) => setV({ ...v, org_url: e.target.value })} placeholder="https://" /></Field>
        <Field label="Tipo">
          <select value={v.employment_type} onChange={(e) => setV({ ...v, employment_type: e.target.value })}>
            {EMPLOYMENT.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
          </select>
        </Field>
        <div className="adm-row2">
          <Field label="Início" hint="AAAA ou AAAA-MM"><input value={v.start_date} onChange={(e) => setV({ ...v, start_date: e.target.value })} /></Field>
          <Field label="Fim" hint="Vazio = atual"><input value={v.end_date} onChange={(e) => setV({ ...v, end_date: e.target.value })} /></Field>
        </div>
      </div>
      <div className="adm-checks" role="group" aria-label="Tecnologias usadas">
        {technologies.map((tech) => (
          <label key={tech.id} className="adm-check">
            <input
              type="checkbox"
              checked={v.technology_ids.includes(tech.id)}
              onChange={(e) => setV({ ...v, technology_ids: e.target.checked ? [...v.technology_ids, tech.id] : v.technology_ids.filter((x) => x !== tech.id) })}
            />{' '}
            {tech.name}
          </label>
        ))}
      </div>
      <LangTabs locale={locale} onChange={setLocale} />
      <Field label={`Função (${locale.toUpperCase()})`}><input value={t.role} onChange={(e) => setT({ role: e.target.value })} /></Field>
      <Field label={`Descrição (${locale.toUpperCase()}, opcional)`}><textarea rows={2} value={t.description} onChange={(e) => setT({ description: e.target.value })} /></Field>
      <ListEditor label={`Pontos principais (${locale.toUpperCase()})`} items={t.highlights} fields={[['text', 'Ponto']]} onChange={(highlights) => setT({ highlights })} />
      {error && <p className="adm-error" role="alert">{error}</p>}
      <div className="adm-actions">
        <button className="btn btn--primary" type="submit">Guardar experiência</button>
        <button className="btn" type="button" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}

function EducationEditor({ value, onSave, onCancel }: { value: EduForm; onSave: (v: EduForm) => void; onCancel: () => void }) {
  const [v, setV] = useState(value);
  const [locale, setLocale] = useState<Locale>('pt');
  const [error, setError] = useState('');
  const t = v.translations[locale];
  const setT = (patch: Partial<EduForm['translations']['pt']>) => setV({ ...v, translations: { ...v.translations, [locale]: { ...t, ...patch } } });
  function submit(event: FormEvent) {
    event.preventDefault();
    const problem = !v.institution.trim()
      ? 'Indica a instituição.'
      : periodError(v.start_date, v.end_date) || (LOCALES.some((l) => !v.translations[l].degree.trim()) ? 'Indica o curso em PT e EN.' : '');
    if (problem) {
      setError(problem);
      return;
    }
    onSave(v);
  }
  return (
    <form className="adm-inline-editor" onSubmit={submit}>
      <div className="adm-row2">
        <Field label="Instituição"><input value={v.institution} onChange={(e) => setV({ ...v, institution: e.target.value })} /></Field>
        <div className="adm-row2">
          <Field label="Início" hint="AAAA ou AAAA-MM"><input value={v.start_date} onChange={(e) => setV({ ...v, start_date: e.target.value })} /></Field>
          <Field label="Fim" hint="Vazio = em curso"><input value={v.end_date} onChange={(e) => setV({ ...v, end_date: e.target.value })} /></Field>
        </div>
      </div>
      <LangTabs locale={locale} onChange={setLocale} />
      <Field label={`Curso (${locale.toUpperCase()})`}><input value={t.degree} onChange={(e) => setT({ degree: e.target.value })} /></Field>
      <Field label={`Descrição (${locale.toUpperCase()}, opcional)`}><textarea rows={2} value={t.description} onChange={(e) => setT({ description: e.target.value })} /></Field>
      {error && <p className="adm-error" role="alert">{error}</p>}
      <div className="adm-actions">
        <button className="btn btn--primary" type="submit">Guardar formação</button>
        <button className="btn" type="button" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}

// =====================================================================
// Taxonomias: categorias e tecnologias
// =====================================================================

type CategoryValue = { id: string; slug: string; names: Record<Locale, string> };
type TechValue = { id: string; name: string; tech_group: string };

export function TaxonomySection() {
  const [categories, setCategories] = useState<CategoryValue[] | null>(null);
  const [technologies, setTechnologies] = useState<TechValue[]>([]);
  const [notice, setNotice] = useState<Notice>(null);

  async function reload() {
    const [cat, tech] = await Promise.all([
      supabase.from('categories').select('id, slug, category_translations(locale, name)').order('sort_order').order('id'),
      supabase.from('technologies').select('id, name, tech_group').order('sort_order').order('id'),
    ]);
    if (cat.error || tech.error || !cat.data || !tech.data) {
      setNotice({ tone: 'error', text: describeError(cat.error ?? tech.error) });
      return;
    }
    setCategories(cat.data.map((c) => ({
      id: c.id,
      slug: c.slug,
      names: { pt: c.category_translations.find((t) => t.locale === 'pt')?.name ?? '', en: c.category_translations.find((t) => t.locale === 'en')?.name ?? '' },
    })));
    setTechnologies(tech.data);
  }

  useEffect(() => {
    void reload();
  }, []);

  async function act(action: () => Result) {
    const { error } = await action();
    setNotice(error ? { tone: 'error', text: describeError(error) } : savedMessage);
    if (!error) await reload();
  }

  if (!categories) return <Section title="Categorias e tecnologias"><NoticeLine notice={notice} /></Section>;

  return (
    <Section title="Categorias e tecnologias" intro="As categorias servem de filtro em /projetos/. As tecnologias aparecem nos projetos, no percurso e em 'Como trabalho'.">
      <NoticeLine notice={notice} />
      <h2>Categorias</h2>
      <ol className="adm-list">
        {categories.map((c, i) => (
          <li key={c.id} className="adm-row adm-row--stack">
            <CategoryForm value={c} onSave={(v) => void act(() => supabase.rpc('save_category', { payload: v as never }))} />
            <div className="adm-row-actions">
              <OrderButtons label={c.names.pt} first={i === 0} last={i === categories.length - 1}
                onMove={(d) => void act(() => supabase.rpc('move_item', { item_table: 'categories', item_id: c.id, direction: d }))} />
              <button type="button" className="btn adm-btn-danger"
                onClick={() => { if (window.confirm(`Eliminar a categoria ${c.names.pt}?`)) void act(() => supabase.from('categories').delete().eq('id', c.id)); }}>
                Eliminar
              </button>
            </div>
          </li>
        ))}
        <li className="adm-row adm-row--stack">
          <CategoryForm value={{ id: '', slug: '', names: { pt: '', en: '' } }} isNew onSave={(v) => void act(() => supabase.rpc('save_category', { payload: v as never }))} />
        </li>
      </ol>

      <h2>Tecnologias</h2>
      <ol className="adm-list">
        {technologies.map((t, i) => (
          <li key={t.id} className="adm-row adm-row--stack">
            <TechForm value={t} onSave={(v) => void act(() => supabase.from('technologies').update({ name: v.name, tech_group: v.tech_group as never }).eq('id', t.id))} />
            <div className="adm-row-actions">
              <OrderButtons label={t.name} first={i === 0} last={i === technologies.length - 1}
                onMove={(d) => void act(() => supabase.rpc('move_item', { item_table: 'technologies', item_id: t.id, direction: d }))} />
              <button type="button" className="btn adm-btn-danger"
                onClick={() => { if (window.confirm(`Eliminar ${t.name}? Sai também dos projetos e do percurso.`)) void act(() => supabase.from('technologies').delete().eq('id', t.id)); }}>
                Eliminar
              </button>
            </div>
          </li>
        ))}
        <li className="adm-row adm-row--stack">
          <TechForm value={{ id: '', name: '', tech_group: 'backend' }} isNew
            onSave={(v) => void act(() => supabase.from('technologies').insert({ name: v.name, tech_group: v.tech_group as never, sort_order: technologies.length + 1 }))} />
        </li>
      </ol>
    </Section>
  );
}

function CategoryForm({ value, onSave, isNew = false }: { value: CategoryValue; onSave: (v: CategoryValue) => void; isNew?: boolean }) {
  const [v, setV] = useState(value);
  const [error, setError] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v.slug)) {
      setError('Endereço só com letras minúsculas, números e hífenes.');
      return;
    }
    if (!v.names.pt.trim() || !v.names.en.trim()) {
      setError('Indica o nome em PT e EN.');
      return;
    }
    setError('');
    onSave(v);
    if (isNew) setV(value);
  }
  return (
    <form className="adm-inline-form" onSubmit={submit}>
      <Field label="Nome (PT)"><input value={v.names.pt} onChange={(e) => setV({ ...v, names: { ...v.names, pt: e.target.value } })} /></Field>
      <Field label="Nome (EN)"><input value={v.names.en} onChange={(e) => setV({ ...v, names: { ...v.names, en: e.target.value } })} /></Field>
      <Field label="Endereço (slug)"><input value={v.slug} onChange={(e) => setV({ ...v, slug: e.target.value })} /></Field>
      {error && <p className="adm-error" role="alert">{error}</p>}
      <button className="btn" type="submit">{isNew ? 'Adicionar categoria' : 'Guardar'}</button>
    </form>
  );
}

function TechForm({ value, onSave, isNew = false }: { value: TechValue; onSave: (v: { name: string; tech_group: string }) => void; isNew?: boolean }) {
  const [v, setV] = useState(value);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!v.name.trim()) return;
    onSave({ name: v.name.trim(), tech_group: v.tech_group });
    if (isNew) setV(value);
  }
  return (
    <form className="adm-inline-form" onSubmit={submit}>
      <Field label="Tecnologia"><input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
      <Field label="Grupo">
        <select value={v.tech_group} onChange={(e) => setV({ ...v, tech_group: e.target.value })}>
          {GROUPS.map(([g, label]) => <option key={g} value={g}>{label}</option>)}
        </select>
      </Field>
      <button className="btn" type="submit">{isNew ? 'Adicionar tecnologia' : 'Guardar'}</button>
    </form>
  );
}

// =====================================================================
// Ligações
// =====================================================================

interface LinkRow { id: string; kind: string; url: string; label: string; placements: string[] }

export function LinksSection() {
  const [links, setLinks] = useState<LinkRow[] | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  async function reload() {
    const { data, error } = await supabase.from('links').select('id, kind, url, label, placements').order('sort_order').order('id');
    if (error) {
      setNotice({ tone: 'error', text: describeError(error) });
      return;
    }
    setLinks(data.map((l) => ({ ...l, label: l.label ?? '' })));
  }

  useEffect(() => {
    void reload();
  }, []);

  async function act(action: () => Result) {
    const { error } = await action();
    setNotice(error ? { tone: 'error', text: describeError(error) } : savedMessage);
    if (!error) await reload();
  }

  function save(v: LinkRow) {
    if (!/^(https:\/\/|mailto:)\S+$/.test(v.url.trim())) {
      setNotice({ tone: 'error', text: 'O endereço tem de começar por https:// ou mailto:.' });
      return;
    }
    if (v.placements.length === 0) {
      setNotice({ tone: 'error', text: 'Escolhe pelo menos um sítio onde a ligação aparece.' });
      return;
    }
    const row = { kind: v.kind as never, url: v.url.trim(), label: v.label.trim() || null, placements: v.placements as never };
    void act(() => (v.id ? supabase.from('links').update(row).eq('id', v.id) : supabase.from('links').insert({ ...row, sort_order: (links?.length ?? 0) + 1 })));
  }

  if (!links) return <Section title="Ligações"><NoticeLine notice={notice} /></Section>;

  return (
    <Section title="Ligações" intro="Email e redes sociais. Escolhe onde cada uma aparece no site.">
      <NoticeLine notice={notice} />
      <ol className="adm-list">
        {links.map((l, i) => (
          <li key={l.id} className="adm-row adm-row--stack">
            <LinkForm value={l} onSave={save} />
            <div className="adm-row-actions">
              <OrderButtons label={l.kind} first={i === 0} last={i === links.length - 1}
                onMove={(d) => void act(() => supabase.rpc('move_item', { item_table: 'links', item_id: l.id, direction: d }))} />
              <button type="button" className="btn adm-btn-danger"
                onClick={() => { if (window.confirm(`Eliminar a ligação ${l.url}?`)) void act(() => supabase.from('links').delete().eq('id', l.id)); }}>
                Eliminar
              </button>
            </div>
          </li>
        ))}
        <li className="adm-row adm-row--stack">
          <LinkForm value={{ id: '', kind: 'linkedin', url: '', label: '', placements: ['footer'] }} onSave={save} isNew />
        </li>
      </ol>
    </Section>
  );
}

function LinkForm({ value, onSave, isNew = false }: { value: LinkRow; onSave: (v: LinkRow) => void; isNew?: boolean }) {
  const [v, setV] = useState(value);
  function submit(event: FormEvent) {
    event.preventDefault();
    onSave(v);
    if (isNew) setV(value);
  }
  return (
    <form className="adm-inline-form" onSubmit={submit}>
      <Field label="Tipo">
        <select value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })}>
          {LINK_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
      </Field>
      <Field label="Endereço"><input value={v.url} onChange={(e) => setV({ ...v, url: e.target.value })} placeholder="https:// ou mailto:" /></Field>
      <Field label="Texto (opcional)"><input value={v.label} onChange={(e) => setV({ ...v, label: e.target.value })} /></Field>
      <div className="adm-checks" role="group" aria-label="Onde aparece">
        {PLACEMENTS.map(([p, label]) => (
          <label key={p} className="adm-check">
            <input type="checkbox" checked={v.placements.includes(p)} onChange={(e) => setV({ ...v, placements: e.target.checked ? [...v.placements, p] : v.placements.filter((x) => x !== p) })} />{' '}
            {label}
          </label>
        ))}
      </div>
      <button className="btn" type="submit">{isNew ? 'Adicionar ligação' : 'Guardar'}</button>
    </form>
  );
}

// =====================================================================
// CV e SEO
// =====================================================================

type SiteForm = { og: MediaItem | null; translations: Record<Locale, { title: string; description: string }> };

export function CvSeoSection() {
  const [cv, setCv] = useState<Record<Locale, { url: string; updated: string } | null>>({ pt: null, en: null });
  const [site, setSite] = useState<SiteForm | null>(null);
  const [locale, setLocale] = useState<Locale>('pt');
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<Locale | ''>('');

  async function reload() {
    const [files, settings, texts] = await Promise.all([
      supabase.from('cv_files').select('locale, updated_at, media(storage_path)'),
      supabase.from('site_settings').select(`og:media!site_settings_og_media_id_fkey(${MEDIA})`).eq('id', 1).maybeSingle(),
      supabase.from('site_settings_translations').select('*'),
    ]);
    const error = files.error ?? settings.error ?? texts.error;
    if (error || !files.data || !texts.data) {
      setNotice({ tone: 'error', text: describeError(error) });
      return;
    }
    const next: Record<Locale, { url: string; updated: string } | null> = { pt: null, en: null };
    for (const f of files.data) {
      const path = (f.media as unknown as { storage_path: string }).storage_path;
      const { data } = await supabase.storage.from('media').createSignedUrl(path, 3600);
      next[f.locale] = { url: data?.signedUrl ?? '', updated: new Date(f.updated_at).toLocaleDateString('pt-PT') };
    }
    setCv(next);
    const og = settings.data?.og ? (await withSignedUrls([toMedia(settings.data.og as unknown as MediaRow)]))[0] : null;
    const textFor = (l: Locale) => {
      const t = texts.data.find((x) => x.locale === l);
      return { title: t?.title ?? '', description: t?.description ?? '' };
    };
    setSite({ og, translations: { pt: textFor('pt'), en: textFor('en') } });
  }

  useEffect(() => {
    void reload();
  }, []);

  async function uploadCv(target: Locale, file: File | undefined) {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setNotice({ tone: 'error', text: 'O CV tem de ser um PDF.' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setNotice({ tone: 'error', text: 'O PDF tem mais de 10 MB. Exporta-o com menor qualidade de imagem.' });
      return;
    }
    setBusy(target);
    try {
      const path = `cv/${crypto.randomUUID()}.pdf`;
      const up = await supabase.storage.from('media').upload(path, file, { contentType: 'application/pdf' });
      if (up.error) throw up.error;
      const media = await supabase.from('media').insert({ storage_path: path, mime_type: 'application/pdf', byte_size: file.size }).select('id').single();
      if (media.error) throw media.error;
      const alt = await supabase.from('media_translations').insert(LOCALES.map((l) => ({ media_id: media.data.id, locale: l, alt: `CV (${target.toUpperCase()})` })));
      if (alt.error) throw alt.error;
      const link = await supabase.from('cv_files').upsert({ locale: target, media_id: media.data.id, updated_at: new Date().toISOString() });
      if (link.error) throw link.error;
      setNotice(savedMessage);
      await reload();
    } catch (e) {
      setNotice({ tone: 'error', text: describeError(e) });
    } finally {
      setBusy('');
    }
  }

  if (!site) return <Section title="CV e SEO"><NoticeLine notice={notice} /></Section>;
  const current = site;
  const t = current.translations[locale];
  const setT = (patch: Partial<{ title: string; description: string }>) => setSite({ ...current, translations: { ...current.translations, [locale]: { ...t, ...patch } } });

  async function saveSite(event: FormEvent) {
    event.preventDefault();
    if (LOCALES.some((l) => !current.translations[l].title.trim() || !current.translations[l].description.trim())) {
      setNotice({ tone: 'error', text: 'Indica o título e a descrição em PT e EN.' });
      return;
    }
    const { error } = await supabase.rpc('save_site_settings', { payload: { og_media_id: current.og?.id ?? '', translations: current.translations } as never });
    setNotice(error ? { tone: 'error', text: describeError(error) } : savedMessage);
  }

  return (
    <Section title="CV e SEO" intro="O CV é descarregado pelos botões do site. O título e a descrição aparecem nos resultados de pesquisa e nas partilhas.">
      <NoticeLine notice={notice} />
      <div className="adm-grid">
        {LOCALES.map((l) => {
          const file = cv[l];
          return (
            <Fieldset key={l} legend={`CV em ${l === 'pt' ? 'português' : 'inglês'}`}>
              {file ? (
                <p>Atual: <a href={file.url} target="_blank" rel="noopener">ver PDF</a> <span className="muted">(atualizado a {file.updated})</span></p>
              ) : (
                <p className="muted">Ainda não há CV neste idioma{l === 'pt' ? '; o site mostra o inglês.' : '.'}</p>
              )}
              <p className="adm-hint">Antes de carregar, confirma que o PDF não expõe dados que não queres públicos (por exemplo, o telefone).</p>
              <Field label="Carregar PDF"><input id={`cv-${l}`} type="file" accept="application/pdf" disabled={busy !== ''} onChange={(e) => void uploadCv(l, e.target.files?.[0])} /></Field>
              {busy === l && <p className="muted" role="status">A enviar…</p>}
            </Fieldset>
          );
        })}
      </div>
      <form className="adm-grid" onSubmit={saveSite}>
        <div className="adm-span">
          <LangTabs locale={locale} onChange={setLocale} />
          <Fieldset legend={`SEO por omissão (${locale.toUpperCase()})`}>
            <Field label="Título do site" hint="Até ~60 caracteres."><input id={`s-title-${locale}`} value={t.title} onChange={(e) => setT({ title: e.target.value })} /></Field>
            <Field label="Descrição" hint="Até ~155 caracteres."><textarea id={`s-desc-${locale}`} rows={3} value={t.description} onChange={(e) => setT({ description: e.target.value })} /></Field>
          </Fieldset>
        </div>
        <Fieldset legend="Imagem de partilha">
          <MediaField label="Imagem de partilha" items={current.og ? [current.og] : []} multiple={false} onChange={(items) => setSite({ ...current, og: items[0] ?? null })} />
        </Fieldset>
        <div className="adm-span"><button className="btn btn--primary" type="submit">Guardar SEO</button></div>
      </form>
    </Section>
  );
}
