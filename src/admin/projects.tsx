/**
 * Lista e editor de projetos.
 * O editor guarda tudo numa transação (save_project); publicar passa pelas regras da base de dados.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { describeError } from './lib/supabase';
import {
  LOCALES, emptyProject, listProjects, loadProject, loadTaxonomies, saveProject, setStatus, moveProject,
  deleteProject, uploadImage, draftErrors, publishProblems,
  type ProjectForm, type ProjectRow, type Status, type Taxonomies, type TextFields, type MediaItem,
} from './lib/projects';
import CaseStudy from '@/shared/CaseStudy';
import Showcase from '@/shared/Showcase';
import type { Locale } from '@/lib/content/schema';
import type { ResolvedImage } from '@/shared/types';

const STATUS_LABEL: Record<Status, string> = { draft: 'Rascunho', published: 'Publicado', unpublished: 'Despublicado' };
const KIND_LABEL = { case_study: 'Estudo de caso', showcase: 'Peça visual' } as const;
const STATE_LABEL: Record<string, string> = {
  production: 'Em produção', in_development: 'Em desenvolvimento', experimental: 'Experimental', completed: 'Concluído',
};
const GROUP_LABEL: Record<string, string> = { backend: 'Backend', frontend: 'Frontend', data: 'Dados', design: 'Design', tools: 'Ferramentas' };

function StatusBadge({ status }: { status: Status }) {
  return <span className={`adm-badge adm-badge--${status}`}>{STATUS_LABEL[status]}</span>;
}

// =====================================================================
// Lista
// =====================================================================

export function ProjectList() {
  const [rows, setRows] = useState<ProjectRow[] | null>(null);
  const [filter, setFilter] = useState<Status | 'all'>('all');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const liveRef = useRef<HTMLParagraphElement>(null);

  const reload = async () => {
    try {
      setRows(await listProjects());
    } catch (e) {
      setError(describeError(e));
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  async function move(row: ProjectRow, direction: -1 | 1) {
    setBusyId(row.id);
    try {
      await moveProject(row.id, direction);
      await reload();
      if (liveRef.current) liveRef.current.textContent = `${row.title} ${direction < 0 ? 'subiu' : 'desceu'} uma posição.`;
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusyId('');
    }
  }

  const counts = useMemo(() => {
    const c = { all: rows?.length ?? 0, draft: 0, published: 0, unpublished: 0 };
    rows?.forEach((r) => (c[r.status] += 1));
    return c;
  }, [rows]);

  const visible = rows?.filter((r) => filter === 'all' || r.status === filter) ?? [];

  return (
    <section className="adm-section" aria-labelledby="list-title">
      <div className="adm-section-head">
        <h1 id="list-title">Projetos</h1>
        <a className="btn btn--primary" href="#/projetos/novo">Novo projeto</a>
      </div>
      <p className="muted">A ordem desta lista é a ordem do site. Os projetos marcados como destaque aparecem na página inicial (até 3).</p>

      <div className="adm-tabs" role="group" aria-label="Filtrar por estado">
        {(['all', 'published', 'draft', 'unpublished'] as const).map((key) => (
          <button key={key} type="button" className="adm-chip" aria-pressed={filter === key} onClick={() => setFilter(key)}>
            {key === 'all' ? 'Todos' : STATUS_LABEL[key]} <span className="mono">{counts[key]}</span>
          </button>
        ))}
      </div>

      {error && <p className="adm-error" role="alert">{error}</p>}
      <p ref={liveRef} className="visually-hidden" role="status" aria-live="polite"></p>

      {!rows ? (
        <p className="muted">A carregar…</p>
      ) : visible.length === 0 ? (
        <p className="muted">Não há projetos neste estado.</p>
      ) : (
        <ol className="adm-list">
          {visible.map((row) => {
            const index = rows.findIndex((r) => r.id === row.id);
            return (
              <li key={row.id} className="adm-row">
                <div className="adm-row-main">
                  <a className="adm-row-title" href={`#/projetos/${row.id}`}>{row.title}</a>
                  <p className="mono muted">/{row.slug}/ · {KIND_LABEL[row.kind]} · {row.category || 'sem categoria'}</p>
                </div>
                <div className="adm-row-meta">
                  <StatusBadge status={row.status} />
                  {row.featured && <span className="adm-badge adm-badge--featured">Destaque</span>}
                </div>
                <div className="adm-row-actions">
                  <button type="button" className="btn adm-icon" disabled={index === 0 || busyId !== ''} onClick={() => move(row, -1)} aria-label={`Subir ${row.title}`}>↑</button>
                  <button type="button" className="btn adm-icon" disabled={index === rows.length - 1 || busyId !== ''} onClick={() => move(row, 1)} aria-label={`Descer ${row.title}`}>↓</button>
                  <a className="btn" href={`#/projetos/${row.id}`}>Editar</a>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

// =====================================================================
// Editor
// =====================================================================

const slugify = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

const problemsIn = (problems: string[], locale: Locale) => problems.filter((p) => p.includes(`(${locale.toUpperCase()})`)).length;

export function ProjectEditor({ id, onDone }: { id: string | null; onDone: () => void }) {
  const [form, setForm] = useState<ProjectForm | null>(id ? null : emptyProject());
  const [saved, setSaved] = useState<string>(id ? '' : JSON.stringify(emptyProject()));
  const [tax, setTax] = useState<Taxonomies | null>(null);
  const [locale, setLocale] = useState<Locale>('pt');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const slugTouched = useRef(Boolean(id));

  useEffect(() => {
    (async () => {
      try {
        const [taxonomies, project] = await Promise.all([loadTaxonomies(), id ? loadProject(id) : Promise.resolve(null)]);
        setTax(taxonomies);
        if (project) {
          setForm(project);
          setSaved(JSON.stringify(project));
        }
      } catch (e) {
        setMessage({ tone: 'error', text: describeError(e) });
      }
    })();
  }, [id]);

  const dirty = form !== null && JSON.stringify(form) !== saved;

  // Aviso ao fechar o separador com alterações por guardar.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  if (!form || !tax) {
    return (
      <section className="adm-section">
        {message ? <p className="adm-error" role="alert">{message.text}</p> : <p className="muted">A carregar…</p>}
      </section>
    );
  }

  const current = form;
  const techNames = (ids: string[]) => ids.map((tid) => tax.technologies.find((t) => t.id === tid)?.name ?? '').filter(Boolean);
  const problems = publishProblems(current, techNames);
  const update = (patch: Partial<ProjectForm>) => setForm({ ...current, ...patch });
  const updateText = (patch: Partial<TextFields>) => {
    const next = { ...current, translations: { ...current.translations, [locale]: { ...current.translations[locale], ...patch } } };
    if (!slugTouched.current && locale === 'pt' && patch.title !== undefined) next.slug = slugify(patch.title);
    setForm(next);
  };
  const text = current.translations[locale];
  const isCase = current.kind === 'case_study';

  function leave() {
    if (dirty && !window.confirm('Há alterações por guardar. Sair mesmo assim?')) return;
    onDone();
  }

  async function save(): Promise<string | null> {
    const found = draftErrors(current);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setMessage({ tone: 'error', text: 'Corrige os campos assinalados antes de guardar.' });
      return null;
    }
    setBusy(true);
    setMessage(null);
    try {
      const newId = await saveProject(current);
      const next = { ...current, id: newId };
      setForm(next);
      setSaved(JSON.stringify(next));
      setMessage({ tone: 'ok', text: 'Guardado. Usa "Publicar alterações no site" para atualizar o site.' });
      if (!current.id) window.history.replaceState(null, '', `#/projetos/${newId}`);
      return newId;
    } catch (e) {
      setMessage({ tone: 'error', text: describeError(e) });
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(status: Status) {
    const savedId = dirty || !current.id ? await save() : current.id;
    if (!savedId) return;
    setBusy(true);
    try {
      await setStatus(savedId, status);
      const next = { ...current, id: savedId, status };
      setForm(next);
      setSaved(JSON.stringify(next));
      setMessage({
        tone: 'ok',
        text:
          status === 'published'
            ? 'Projeto publicado. Usa "Publicar alterações no site" para o pôr online.'
            : 'Projeto despublicado. Sai do site na próxima publicação.',
      });
    } catch (e) {
      setMessage({ tone: 'error', text: describeError(e) });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!current.id) {
      onDone();
      return;
    }
    setBusy(true);
    try {
      await deleteProject(current.id);
      setSaved(JSON.stringify(current));
      onDone();
    } catch (e) {
      setMessage({ tone: 'error', text: describeError(e) });
      setBusy(false);
    }
  }

  return (
    <section className="adm-section adm-editor" aria-labelledby="editor-title">
      <div className="adm-section-head">
        <div>
          <button type="button" className="adm-back" onClick={leave}>Voltar à lista</button>
          <h1 id="editor-title">{current.translations.pt.title || 'Novo projeto'}</h1>
          <p className="adm-editor-status">
            <StatusBadge status={current.status} />
            {dirty && <span className="adm-badge adm-badge--dirty">Alterações por guardar</span>}
          </p>
        </div>
        <div className="adm-actions">
          <button type="button" className="btn" onClick={() => setPreview(true)}>Pré-visualizar</button>
          <button type="button" className="btn" onClick={() => void save()} disabled={busy || !dirty}>Guardar</button>
          {current.status === 'published' ? (
            <button type="button" className="btn" onClick={() => void changeStatus('unpublished')} disabled={busy}>Despublicar</button>
          ) : (
            <button type="button" className="btn btn--primary" onClick={() => void changeStatus('published')} disabled={busy || problems.length > 0}>Publicar</button>
          )}
        </div>
      </div>

      {message && (
        <p className={message.tone === 'ok' ? 'adm-ok' : 'adm-error'} role={message.tone === 'ok' ? 'status' : 'alert'}>{message.text}</p>
      )}

      {problems.length > 0 && (
        <div className="adm-problems" role="region" aria-labelledby="problems-title">
          <h2 id="problems-title">Para publicar, falta</h2>
          <ul>{problems.map((p) => <li key={p}>{p}</li>)}</ul>
          <p className="muted">Podes guardar como rascunho a qualquer momento.</p>
        </div>
      )}

      <form className="adm-grid" onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <Fieldset legend="Identificação">
          <div className="adm-radio" role="radiogroup" aria-label="Tipo de projeto">
            {(['case_study', 'showcase'] as const).map((kind) => (
              <label key={kind}>
                <input type="radio" name="kind" checked={current.kind === kind} onChange={() => update({ kind })} /> {KIND_LABEL[kind]}
              </label>
            ))}
          </div>
          <p className="adm-hint">Estudo de caso: aplicações e sites, com problema, solução e decisões. Peça visual: design e trabalhos mostrados sobretudo por imagens.</p>
          <Field label="Endereço no site (slug)" error={errors.slug} hint={`Fica em /projetos/${current.slug || 'endereco'}/`}>
            <input id="f-slug" value={current.slug} onChange={(e) => { slugTouched.current = true; update({ slug: e.target.value }); }} required />
          </Field>
          <Field label="Categoria">
            <select id="f-category" value={current.category_id} onChange={(e) => update({ category_id: e.target.value })}>
              <option value="">Escolher…</option>
              {tax.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <div className="adm-row2">
            <Field label="Ano" error={errors.year}>
              <input id="f-year" inputMode="numeric" value={current.year} onChange={(e) => update({ year: e.target.value })} placeholder="2025" />
            </Field>
            <Field label="Estado do projeto">
              <select id="f-state" value={current.project_state} onChange={(e) => update({ project_state: e.target.value })}>
                <option value="">Não indicar</option>
                {Object.entries(STATE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
          </div>
          {isCase && (
            <Field label="Código">
              <select id="f-code" value={current.code_visibility} onChange={(e) => update({ code_visibility: e.target.value as ProjectForm['code_visibility'] })}>
                <option value="public">Público (indica o link do repositório)</option>
                <option value="private">Privado</option>
                <option value="confidential">Confidencial</option>
              </select>
            </Field>
          )}
          <label className="adm-check">
            <input id="f-featured" type="checkbox" checked={current.featured} onChange={(e) => update({ featured: e.target.checked })} /> Destacar na página inicial
          </label>
        </Fieldset>

        <Fieldset legend="Ligações">
          <Field label="Demo" error={errors.demo_url}>
            <input id="f-demo" type="url" value={current.demo_url} onChange={(e) => update({ demo_url: e.target.value })} placeholder="https://" />
          </Field>
          <Field label="Repositório (se for público)" error={errors.repo_url}>
            <input id="f-repo" type="url" value={current.repo_url} onChange={(e) => update({ repo_url: e.target.value })} placeholder="https://github.com/..." />
          </Field>
          <Field label="Vídeo" error={errors.video_url}>
            <input id="f-video" type="url" value={current.video_url} onChange={(e) => update({ video_url: e.target.value })} placeholder="https://" />
          </Field>
        </Fieldset>

        <Fieldset legend="Tecnologias">
          {Object.entries(GROUP_LABEL).map(([group, label]) => {
            const items = tax.technologies.filter((t) => t.group === group);
            if (items.length === 0) return null;
            return (
              <div key={group} className="adm-techgroup">
                <p className="mono muted">{label}</p>
                <div className="adm-checks">
                  {items.map((tech) => (
                    <label key={tech.id} className="adm-check">
                      <input
                        type="checkbox"
                        checked={current.technology_ids.includes(tech.id)}
                        onChange={(e) =>
                          update({
                            technology_ids: e.target.checked
                              ? [...current.technology_ids, tech.id]
                              : current.technology_ids.filter((x) => x !== tech.id),
                          })
                        }
                      />{' '}
                      {tech.name}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </Fieldset>

        <Fieldset legend="Imagens">
          <MediaField label="Capa" items={current.cover ? [current.cover] : []} multiple={false} onChange={(items) => update({ cover: items[0] ?? null })} />
          <MediaField label="Galeria" items={current.gallery} multiple onChange={(gallery) => update({ gallery })} />
        </Fieldset>

        <div className="adm-span">
          <div className="adm-langs" role="group" aria-label="Idioma dos textos">
            {LOCALES.map((l) => (
              <button key={l} type="button" className="adm-chip" aria-pressed={locale === l} onClick={() => setLocale(l)}>
                {l === 'pt' ? 'Português' : 'English'}
                {problemsIn(problems, l) > 0 && <span className="adm-dot"><span className="visually-hidden"> (tem campos em falta)</span></span>}
              </button>
            ))}
          </div>

          <Fieldset legend={`Textos (${locale.toUpperCase()})`}>
            <Field label="Título">
              <input id={`f-title-${locale}`} value={text.title} onChange={(e) => updateText({ title: e.target.value })} />
            </Field>
            <Field label="Frase de resumo" hint="Uma frase: o que é e para quem.">
              <textarea id={`f-summary-${locale}`} rows={2} value={text.summary} onChange={(e) => updateText({ summary: e.target.value })} />
            </Field>
            {isCase && (
              <>
                <Field label="O meu papel">
                  <textarea id={`f-role-${locale}`} rows={2} value={text.role} onChange={(e) => updateText({ role: e.target.value })} />
                </Field>
                <Field label="Problema" hint="Separa parágrafos com uma linha em branco.">
                  <textarea id={`f-problem-${locale}`} rows={4} value={text.problem} onChange={(e) => updateText({ problem: e.target.value })} />
                </Field>
                <Field label="Para quem">
                  <input id={`f-audience-${locale}`} value={text.audience} onChange={(e) => updateText({ audience: e.target.value })} />
                </Field>
                <Field label="Solução">
                  <textarea id={`f-solution-${locale}`} rows={4} value={text.solution} onChange={(e) => updateText({ solution: e.target.value })} />
                </Field>
                <ListEditor
                  label="Funcionalidades principais"
                  items={text.features}
                  fields={[['title', 'Funcionalidade'], ['description', 'Descrição']]}
                  onChange={(features) => updateText({ features })}
                />
                <ListEditor
                  label="Decisões técnicas"
                  items={text.decisions}
                  fields={[['decision', 'Decisão'], ['reason', 'Porquê']]}
                  onChange={(decisions) => updateText({ decisions })}
                />
                <ListEditor
                  label="Desafios"
                  items={text.challenges}
                  fields={[['challenge', 'Desafio'], ['solution', 'Como resolvi']]}
                  onChange={(challenges) => updateText({ challenges })}
                />
                <Field label="Resultados" hint="Só factos reais. Sem métricas? Escreve o que aprendeste.">
                  <textarea id={`f-results-${locale}`} rows={3} value={text.results} onChange={(e) => updateText({ results: e.target.value })} />
                </Field>
                <Field label="Como usei IA (opcional)" hint="Exemplos concretos e o que foi decisão tua.">
                  <textarea id={`f-ai-${locale}`} rows={3} value={text.ai_usage} onChange={(e) => updateText({ ai_usage: e.target.value })} />
                </Field>
              </>
            )}
            <details className="adm-details">
              <summary>SEO (opcional)</summary>
              <Field label="Título para motores de busca">
                <input id={`f-seot-${locale}`} value={text.seo_title} onChange={(e) => updateText({ seo_title: e.target.value })} />
              </Field>
              <Field label="Descrição para motores de busca">
                <textarea id={`f-seod-${locale}`} rows={2} value={text.seo_description} onChange={(e) => updateText({ seo_description: e.target.value })} />
              </Field>
            </details>
          </Fieldset>
        </div>

        <div className="adm-span adm-danger">
          <h2>Eliminar projeto</h2>
          <p className="muted">Apaga o projeto e os textos. Não pode ser desfeito.</p>
          <button type="button" className="btn adm-btn-danger" onClick={() => setConfirmDelete(true)} disabled={busy}>Eliminar…</button>
        </div>
      </form>

      {confirmDelete && <ConfirmDelete slug={current.slug || 'novo'} onCancel={() => setConfirmDelete(false)} onConfirm={() => void remove()} />}
      {preview && (
        <Preview
          form={current}
          techNames={techNames}
          categoryName={tax.categories.find((c) => c.id === current.category_id)?.name ?? ''}
          onClose={() => setPreview(false)}
        />
      )}
    </section>
  );
}

// ---------- componentes de formulário ----------

export function Fieldset({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="adm-fieldset">
      <legend>{legend}</legend>
      {children}
    </fieldset>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className={`adm-field${error ? ' adm-field--error' : ''}`}>
      <span>{label}</span>
      {children}
      {hint && <small className="adm-hint">{hint}</small>}
      {error && <small className="adm-error" role="alert">{error}</small>}
    </label>
  );
}

export function ListEditor<T extends Record<string, string>>({ label, items, fields, onChange }: {
  label: string;
  items: T[];
  fields: [keyof T & string, string][];
  onChange: (items: T[]) => void;
}) {
  const blank = () => Object.fromEntries(fields.map(([key]) => [key, ''])) as T;
  const set = (index: number, patch: Partial<T>) => onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const move = (index: number, delta: number) => {
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    onChange(next);
  };
  const itemName = fields[0][1].toLowerCase();
  return (
    <div className="adm-listeditor">
      <p className="adm-listeditor-label">{label}</p>
      {items.map((item, index) => (
        <div key={index} className="adm-listitem">
          {fields.map(([key, fieldLabel]) => (
            <label key={key} className="adm-field">
              <span>{fieldLabel} {index + 1}</span>
              <textarea rows={2} value={item[key]} onChange={(e) => set(index, { [key]: e.target.value } as Partial<T>)} />
            </label>
          ))}
          <div className="adm-actions">
            <button type="button" className="btn adm-icon" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Subir ${itemName} ${index + 1}`}>↑</button>
            <button type="button" className="btn adm-icon" disabled={index === items.length - 1} onClick={() => move(index, 1)} aria-label={`Descer ${itemName} ${index + 1}`}>↓</button>
            <button type="button" className="btn" onClick={() => onChange(items.filter((_, i) => i !== index))}>Remover</button>
          </div>
        </div>
      ))}
      <button type="button" className="btn" onClick={() => onChange([...items, blank()])}>Adicionar</button>
    </div>
  );
}

export function MediaField({ label, items, multiple, onChange }: { label: string; items: MediaItem[]; multiple: boolean; onChange: (items: MediaItem[]) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState<Record<Locale, string>>({ pt: '', en: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const key = label.toLowerCase();

  async function upload() {
    if (!file) {
      setError('Escolhe uma imagem.');
      return;
    }
    if (!alt.pt.trim() || !alt.en.trim()) {
      setError('Descreve a imagem em PT e EN (texto alternativo, para leitores de ecrã).');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const media = await uploadImage(file, alt);
      onChange(multiple ? [...items, media] : [media]);
      setFile(null);
      setAlt({ pt: '', en: '' });
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  const move = (index: number, delta: number) => {
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    onChange(next);
  };

  return (
    <div className="adm-media">
      <p className="adm-listeditor-label">{label}</p>
      {items.length > 0 && (
        <ul className="adm-thumbs">
          {items.map((item, index) => (
            <li key={item.id}>
              {item.url ? <img src={item.url} alt={item.alt.pt} width={160} height={100} /> : <span className="adm-thumb-missing">Sem pré-visualização</span>}
              <p className="adm-hint">{item.alt.pt}</p>
              <div className="adm-actions">
                {multiple && (
                  <button type="button" className="btn adm-icon" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Mover imagem ${index + 1} para trás`}>←</button>
                )}
                {multiple && (
                  <button type="button" className="btn adm-icon" disabled={index === items.length - 1} onClick={() => move(index, 1)} aria-label={`Mover imagem ${index + 1} para a frente`}>→</button>
                )}
                <button type="button" className="btn" onClick={() => onChange(items.filter((_, i) => i !== index))}>Remover</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {(multiple || items.length === 0) && (
        <div className="adm-upload">
          <label className="adm-field">
            <span>{multiple ? 'Adicionar imagem' : 'Escolher imagem'}</span>
            <input id={`media-file-${key}`} type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <small className="adm-hint">É reduzida para 2560 px e convertida em WebP antes de enviar (também remove a localização GPS).</small>
          </label>
          <label className="adm-field">
            <span>Descrição da imagem (PT)</span>
            <input id={`media-alt-pt-${key}`} value={alt.pt} onChange={(e) => setAlt({ ...alt, pt: e.target.value })} />
          </label>
          <label className="adm-field">
            <span>Image description (EN)</span>
            <input id={`media-alt-en-${key}`} value={alt.en} onChange={(e) => setAlt({ ...alt, en: e.target.value })} />
          </label>
          {error && <p className="adm-error" role="alert">{error}</p>}
          <button type="button" className="btn" onClick={() => void upload()} disabled={busy}>{busy ? 'A enviar…' : 'Carregar imagem'}</button>
        </div>
      )}
    </div>
  );
}

// ---------- diálogos ----------

function Dialog({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className={`adm-dialog${wide ? ' adm-dialog--wide' : ''}`} aria-labelledby="dialog-title" onClose={onClose}>
      <div className="adm-dialog-head">
        <h2 id="dialog-title">{title}</h2>
        <button type="button" className="btn" onClick={() => ref.current?.close()}>Fechar</button>
      </div>
      {children}
    </dialog>
  );
}

function ConfirmDelete({ slug, onCancel, onConfirm }: { slug: string; onCancel: () => void; onConfirm: () => void }) {
  const [typed, setTyped] = useState('');
  return (
    <Dialog title="Eliminar projeto" onClose={onCancel}>
      <p>Para confirmar, escreve <code>{slug}</code>. Esta ação não pode ser desfeita.</p>
      <label className="adm-field">
        <span>Endereço do projeto</span>
        <input id="confirm-slug" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      </label>
      <div className="adm-actions">
        <button type="button" className="btn" onClick={onCancel}>Cancelar</button>
        <button type="button" className="btn adm-btn-danger" disabled={typed !== slug} onClick={onConfirm}>Eliminar definitivamente</button>
      </div>
    </Dialog>
  );
}

function Preview({ form, techNames, categoryName, onClose }: {
  form: ProjectForm;
  techNames: (ids: string[]) => string[];
  categoryName: string;
  onClose: () => void;
}) {
  const [locale, setLocale] = useState<Locale>('pt');
  const toImage = (m: MediaItem): ResolvedImage => ({ src: m.url ?? '', width: m.width ?? 1600, height: m.height ?? 1000, alt: m.alt[locale] });
  const cover = form.cover ? toImage(form.cover) : { src: '', width: 1600, height: 1000, alt: '' };
  const textFor = (l: Locale) => {
    const t = form.translations[l];
    return {
      title: t.title || '(sem título)',
      summary: t.summary || '(sem resumo)',
      role: t.role || undefined,
      problem: t.problem || undefined,
      audience: t.audience || undefined,
      solution: t.solution || undefined,
      features: t.features,
      decisions: t.decisions,
      challenges: t.challenges,
      results: t.results || undefined,
      aiUsage: t.ai_usage || undefined,
    };
  };
  const view = {
    locale,
    categoryLabel: categoryName || 'Sem categoria',
    cover,
    gallery: form.gallery.map(toImage),
    project: {
      kind: form.kind,
      year: form.year ? Number(form.year) : null,
      state: (form.project_state || null) as 'production' | 'in_development' | 'experimental' | 'completed' | null,
      codeVisibility: form.code_visibility,
      demoUrl: form.demo_url || null,
      repoUrl: form.repo_url || null,
      videoUrl: form.video_url || null,
      technologies: techNames(form.technology_ids),
      i18n: { pt: textFor('pt'), en: textFor('en') },
    },
  };
  return (
    <Dialog title="Pré-visualização" onClose={onClose} wide>
      <div className="adm-langs" role="group" aria-label="Idioma da pré-visualização">
        {LOCALES.map((l) => (
          <button key={l} type="button" className="adm-chip" aria-pressed={locale === l} onClick={() => setLocale(l)}>{l === 'pt' ? 'Português' : 'English'}</button>
        ))}
      </div>
      <p className="adm-hint">É o mesmo template da página pública. No site publicado as imagens aparecem otimizadas.</p>
      <div className="adm-preview">{form.kind === 'case_study' ? <CaseStudy {...view} /> : <Showcase {...view} />}</div>
    </Dialog>
  );
}
