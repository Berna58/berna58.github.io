/**
 * Visão geral: o estado dos projetos e o que falta fazer, só com dados que o painel já tem
 * (lista de projetos e CV por idioma). Sem métricas inventadas.
 */
import { useEffect, useState } from 'react';
import { supabase, describeError } from './lib/supabase';
import { LOCALES, listProjects, type ProjectRow, type Status } from './lib/projects';
import { StatusBadge } from './projects';
import { EmptyState, Icon, LoadingState, NoticeLine, PageHeader } from './ui';
import type { Locale } from '@/lib/content/schema';

const RECENT = 5;
const COUNTS: [Status, string][] = [['published', 'Publicados'], ['draft', 'Rascunhos'], ['unpublished', 'Despublicados']];
const LOCALE_NAME: Record<Locale, string> = { pt: 'português', en: 'inglês' };

const when = (iso: string) => new Date(iso).toLocaleString('pt-PT', { dateStyle: 'medium', timeStyle: 'short' });

export function Overview() {
  const [projects, setProjects] = useState<ProjectRow[] | null>(null);
  const [cvLocales, setCvLocales] = useState<Locale[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [rows, cv] = await Promise.all([listProjects(), supabase.from('cv_files').select('locale')]);
        if (cv.error) throw cv.error;
        setCvLocales(cv.data.map((c) => c.locale));
        setProjects(rows);
      } catch (e) {
        setError(describeError(e));
      }
    })();
  }, []);

  return (
    <section className="adm-section" aria-labelledby="page-title">
      <PageHeader
        title="Visão geral"
        description="O estado dos projetos e o que ainda falta antes de publicar."
        actions={<a className="btn btn--primary" href="#/projetos/novo"><Icon name="plus" />Novo projeto</a>}
      />
      {error && <NoticeLine notice={{ tone: 'error', text: error }} />}
      {!projects ? !error && <LoadingState rows={4} /> : <Summary projects={projects} cvLocales={cvLocales} />}
    </section>
  );
}

function Summary({ projects, cvLocales }: { projects: ProjectRow[]; cvLocales: Locale[] }) {
  const count = (status: Status) => projects.filter((p) => p.status === status).length;
  const featured = projects.filter((p) => p.featured).length;
  const drafts = projects.filter((p) => p.status === 'draft');
  const missingCv = LOCALES.filter((l) => !cvLocales.includes(l));
  const recent = [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, RECENT);
  const pending = drafts.length + missingCv.length;

  return (
    <div className="adm-overview">
      <section className="adm-panel adm-overview-todo" aria-labelledby="todo-title">
        <h2 id="todo-title" className="adm-panel-title">Por terminar</h2>
        {pending === 0 ? (
          <EmptyState title="Nada por terminar.">Não há rascunhos e os dois CV estão carregados.</EmptyState>
        ) : (
          <ul className="adm-todo">
            {drafts.map((p) => (
              <li key={p.id}>
                <a href={`#/projetos/${p.id}`}>{p.title}</a>
                <span className="muted">Rascunho por publicar</span>
              </li>
            ))}
            {missingCv.map((l) => (
              <li key={l}>
                <a href="#/cv-seo">Carregar o CV em {LOCALE_NAME[l]}</a>
                <span className="muted">{l === 'pt' ? 'Sem ele, o site mostra o CV em inglês.' : 'O site ainda não tem CV neste idioma.'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="adm-panel adm-overview-stats" aria-labelledby="stats-title">
        <div className="adm-panel-head">
          <h2 id="stats-title" className="adm-panel-title">Projetos</h2>
          <a href="#/projetos">Gerir projetos</a>
        </div>
        <dl className="adm-stats">
          {COUNTS.map(([status, label]) => (
            <div key={status}>
              <dt>{label}</dt>
              <dd>{count(status)}</dd>
            </div>
          ))}
          <div>
            <dt>Em destaque</dt>
            <dd>{featured}</dd>
          </div>
        </dl>
        {featured < 3 && projects.length > 0 && (
          <p className="adm-hint">
            {featured === 0 ? 'Nenhum projeto em destaque' : `Só ${featured} em destaque`}: o carrossel da página inicial completa-se com os restantes, pela ordem da lista.
          </p>
        )}
      </section>

      <section className="adm-panel adm-overview-recent" aria-labelledby="recent-title">
        <h2 id="recent-title" className="adm-panel-title">Alterados recentemente</h2>
        {recent.length === 0 ? (
          <EmptyState title="Ainda não há projetos." action={<a className="btn" href="#/projetos/novo">Criar o primeiro projeto</a>}>
            Cada projeto começa como rascunho e só aparece no site depois de publicado.
          </EmptyState>
        ) : (
          <ol className="adm-recent">
            {recent.map((p) => (
              <li key={p.id}>
                <a href={`#/projetos/${p.id}`}>{p.title}</a>
                <StatusBadge status={p.status} />
                <time className="mono muted" dateTime={p.updatedAt}>{when(p.updatedAt)}</time>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="adm-panel adm-overview-shortcuts" aria-labelledby="shortcuts-title">
        <h2 id="shortcuts-title" className="adm-panel-title">Atalhos</h2>
        <ul className="adm-shortcuts">
          <li><a href="#/perfil"><Icon name="profile" />Atualizar a apresentação e a disponibilidade</a></li>
          <li><a href="#/percurso"><Icon name="path" />Acrescentar experiência ou formação</a></li>
          <li><a href="#/cv-seo"><Icon name="file" />Substituir o CV</a></li>
        </ul>
      </section>
    </div>
  );
}
