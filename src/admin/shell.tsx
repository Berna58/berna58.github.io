/**
 * Estrutura do painel depois de entrar: menu lateral, barra de topo (localização e publicação) e conteúdo.
 * Em ecrãs largos o menu pode recolher para uma coluna de ícones; em ecrãs estreitos abre como gaveta.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, describeError, CONTENT_CHANGED } from './lib/supabase';
import { useHashRoute, navigate, hasUnsavedChanges, setUnsavedChanges } from './lib/router';
import { buildStatus, siteSyncStatus, type BuildState, type SyncState } from './lib/projects';
import { ProjectList, ProjectEditor } from './projects';
import { ProfileSection, PathSection, TaxonomySection, LinksSection, CvSeoSection } from './content';
import { Overview } from './overview';
import { ConfirmProvider, CrumbContext, Icon, useConfirm, type IconName } from './ui';

type SectionKey = 'inicio' | 'projetos' | 'perfil' | 'percurso' | 'taxonomias' | 'ligacoes' | 'cv-seo';

const OVERVIEW = { key: 'inicio', label: 'Visão geral', icon: 'overview' } as const;
const GROUPS: { label: string; items: { key: SectionKey; label: string; icon: IconName }[] }[] = [
  {
    label: 'Conteúdo',
    items: [
      { key: 'projetos', label: 'Projetos', icon: 'projects' },
      { key: 'perfil', label: 'Perfil', icon: 'profile' },
      { key: 'percurso', label: 'Percurso', icon: 'path' },
    ],
  },
  {
    label: 'Definições',
    items: [
      { key: 'taxonomias', label: 'Categorias e tecnologias', icon: 'tag' },
      { key: 'ligacoes', label: 'Ligações', icon: 'link' },
      { key: 'cv-seo', label: 'CV e SEO', icon: 'file' },
    ],
  },
];
const LABELS = Object.fromEntries([OVERVIEW, ...GROUPS.flatMap((g) => g.items)].map((s) => [s.key, s.label])) as Record<SectionKey, string>;

const RAIL_KEY = 'admin-sidebar';
const DESKTOP = '(min-width: 64rem)';

function readRail() {
  try {
    return localStorage.getItem(RAIL_KEY) === 'rail';
  } catch {
    return false;
  }
}

export function Shell({ email }: { email: string }) {
  return (
    <ConfirmProvider>
      <Layout email={email} />
    </ConfirmProvider>
  );
}

function Layout({ email }: { email: string }) {
  const route = useHashRoute();
  const section: SectionKey = (route[0] && route[0] in LABELS ? route[0] : 'inicio') as SectionKey;
  const id = route[1];
  const confirm = useConfirm();
  const [rail, setRail] = useState(readRail);
  const [open, setOpen] = useState(false);
  const [crumb, setCrumb] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const topbar = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const main = useRef<HTMLElement>(null);
  const openRef = useRef(open);
  openRef.current = open;

  const closeDrawer = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) menuButton.current?.focus();
  }, []);

  // A altura real da barra de topo (muda quando o texto quebra) serve de margem aos cabeçalhos fixos.
  useEffect(() => {
    const bar = topbar.current;
    if (!bar) return;
    const observer = new ResizeObserver(() => root.current?.style.setProperty('--adm-topbar-h', `${bar.offsetHeight}px`));
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  // Mudar de página: voltar ao topo e, se veio da gaveta, fechá-la e pôr o foco no conteúdo.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    if (openRef.current) {
      setOpen(false);
      main.current?.focus();
    }
  }, [section, id]);

  // A gaveta só existe em ecrãs estreitos: fechar se o ecrã alargar e fechar com Esc.
  useEffect(() => {
    if (!open) return;
    const wide = window.matchMedia(DESKTOP);
    const onWide = () => wide.matches && setOpen(false);
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && closeDrawer(true);
    wide.addEventListener('change', onWide);
    window.addEventListener('keydown', onKey);
    document.querySelector<HTMLElement>('#adm-sidebar .adm-nav a')?.focus();
    return () => {
      wide.removeEventListener('change', onWide);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, closeDrawer]);

  // Ligações internas com alterações por guardar: confirmar antes de sair do editor.
  useEffect(() => {
    async function onClick(event: MouseEvent) {
      if (!hasUnsavedChanges() || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.('a[href^="#/"]');
      const href = link?.getAttribute('href');
      if (!href || href === window.location.hash) return;
      event.preventDefault();
      const leave = await confirm({
        title: 'Sair sem guardar?',
        message: 'Há alterações por guardar neste projeto. Se saíres agora, perdem-se.',
        confirmLabel: 'Sair sem guardar',
        danger: true,
      });
      if (leave) {
        setUnsavedChanges(false);
        window.location.hash = href;
      }
    }
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [confirm]);

  function toggleRail() {
    const next = !rail;
    setRail(next);
    try {
      localStorage.setItem(RAIL_KEY, next ? 'rail' : 'full');
    } catch {
      // sem armazenamento: a preferência dura só esta visita
    }
  }

  const navLink = (key: SectionKey, label: string, icon: IconName) => (
    <a className="adm-nav-link" href={`#/${key}`} aria-current={section === key ? 'page' : undefined} title={rail ? label : undefined}>
      <Icon name={icon} />
      <span className="adm-label">{label}</span>
    </a>
  );

  return (
    <div ref={root} className={`adm${rail ? ' adm--rail' : ''}${open ? ' adm--open' : ''}`}>
      <a className="skip-link" href="#conteudo" onClick={(e) => { e.preventDefault(); main.current?.focus(); }}>Saltar para o conteúdo</a>

      <div id="adm-sidebar" className="adm-sidebar">
        <div className="adm-sidebar-head">
          <a className="adm-brand" href="#/inicio" title={rail ? 'Painel do portefólio' : undefined}>
            <span className="adm-brand-mark" aria-hidden="true">B</span>
            <span className="adm-label">Painel <span className="adm-brand-sub">do portefólio</span></span>
          </a>
          <button type="button" className="btn btn--quiet adm-icon adm-drawer-close" onClick={() => closeDrawer(true)} aria-label="Fechar menu">
            <Icon name="close" />
          </button>
        </div>

        <nav className="adm-nav" aria-label="Secções do painel">
          <ul className="adm-nav-list">
            <li>{navLink(OVERVIEW.key, OVERVIEW.label, OVERVIEW.icon)}</li>
          </ul>
          {GROUPS.map((group) => (
            <div key={group.label} className="adm-nav-group">
              <p className="adm-nav-label" id={`nav-${group.label}`}>{group.label}</p>
              <ul className="adm-nav-list" aria-labelledby={`nav-${group.label}`}>
                {group.items.map((item) => <li key={item.key}>{navLink(item.key, item.label, item.icon)}</li>)}
              </ul>
            </div>
          ))}
        </nav>

        <div className="adm-sidebar-foot">
          <a className="adm-nav-link" href="/" target="_blank" rel="noopener" title={rail ? 'Ver site' : undefined}>
            <Icon name="external" />
            <span className="adm-label">Ver site</span>
            <span className="visually-hidden"> (abre num novo separador)</span>
          </a>
          <button type="button" className="adm-nav-link adm-rail-toggle" onClick={toggleRail} aria-pressed={rail} title={rail ? 'Expandir menu' : undefined}>
            <Icon name="panel" />
            <span className="adm-label">Recolher menu</span>
          </button>
          <div className="adm-account" title={email}>
            <span className="adm-avatar" aria-hidden="true">{(email[0] ?? '?').toUpperCase()}</span>
            <span className="adm-label adm-email mono">{email}</span>
          </div>
          <button type="button" className="adm-nav-link adm-signout" onClick={() => supabase.auth.signOut()} title={rail ? 'Sair' : undefined}>
            <Icon name="logout" />
            <span className="adm-label">Sair</span>
          </button>
        </div>
      </div>
      <div className="adm-scrim" aria-hidden="true" onClick={() => closeDrawer(true)} />

      <div className="adm-column" inert={open}>
        <header ref={topbar} className="adm-topbar">
          <button
            ref={menuButton}
            type="button"
            className="btn btn--quiet adm-icon adm-menu-button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls="adm-sidebar"
            aria-label="Abrir menu"
          >
            <Icon name="menu" />
          </button>
          {crumb && section === 'projetos' && id ? (
            <nav className="adm-crumbs" aria-label="Localização">
              <ol>
                <li><a href="#/projetos">{LABELS.projetos}</a></li>
                <li aria-hidden="true"><Icon name="chevron" /></li>
                <li aria-current="page">{crumb}</li>
              </ol>
            </nav>
          ) : (
            <span className="adm-topbar-spacer" />
          )}
          <SiteStatus />
        </header>
        <main id="conteudo" ref={main} className="adm-main" tabIndex={-1}>
          <CrumbContext.Provider value={setCrumb}>
            {section === 'inicio' && <Overview />}
            {section === 'projetos' && !id && <ProjectList />}
            {section === 'projetos' && id && <ProjectEditor key={id} id={id === 'novo' ? null : id} onDone={() => navigate('projetos')} />}
            {section === 'perfil' && <ProfileSection />}
            {section === 'percurso' && <PathSection />}
            {section === 'taxonomias' && <TaxonomySection />}
            {section === 'ligacoes' && <LinksSection />}
            {section === 'cv-seo' && <CvSeoSection />}
          </CrumbContext.Provider>
        </main>
      </div>
    </div>
  );
}

// ---------- publicação (automática) ----------

const shortTime = (iso: string) => new Date(iso).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' });

/**
 * Não há botão: a base de dados pede o deploy sozinha depois de cada alteração (job site_sync).
 * Aqui só se mostra o estado: alterações a caminho, site a atualizar, atualizado ou falhou.
 */
function SiteStatus() {
  const [sync, setSync] = useState<SyncState | null>(null);
  const [build, setBuild] = useState<BuildState | null>(null);
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    if (document.hidden) return;
    const [nextSync, nextBuild] = await Promise.allSettled([siteSyncStatus(), buildStatus()]);
    if (nextSync.status === 'fulfilled') setSync(nextSync.value);
    if (nextBuild.status === 'fulfilled') setBuild(nextBuild.value);
    const failed = [nextSync, nextBuild].find((r): r is PromiseRejectedResult => r.status === 'rejected');
    setMessage(failed ? describeError(failed.reason) : '');
  }, []);

  // O Vercel ainda não mostra o deploy pedido (ou está a construí-lo).
  const building =
    build?.status === 'queued' || build?.status === 'in_progress' ||
    (!!sync?.requestedAt && build?.status === 'completed' && (!build.createdAt || build.createdAt < sync.requestedAt) &&
      Date.now() - Date.parse(sync.requestedAt) < 10 * 60_000);
  const busy = !!sync?.pending || building;

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), busy ? 8000 : 30000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener(CONTENT_CHANGED, refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener(CONTENT_CHANGED, refresh);
    };
  }, [refresh, busy]);

  let label = 'O site atualiza-se sozinho depois de cada alteração.';
  let tone = 'neutral';
  if (sync?.error) {
    label = `${sync.error} O site anterior continua online.`;
    tone = 'fail';
  } else if (sync?.pending) {
    label = 'Alterações guardadas. O site atualiza-se sozinho dentro de 1 a 3 minutos.';
    tone = 'progress';
  } else if (building) {
    label = 'A atualizar o site…';
    tone = 'progress';
  } else if (build?.status === 'completed' && build.createdAt) {
    const ok = build.conclusion === 'success';
    label = ok ? `Site atualizado (${shortTime(build.createdAt)}).` : `A última atualização falhou (${shortTime(build.createdAt)}). O site anterior continua online.`;
    tone = ok ? 'ok' : 'fail';
  } else if (sync?.requestedAt) {
    label = `Última atualização pedida: ${shortTime(sync.requestedAt)}.`;
    tone = 'ok';
  }

  return (
    <div className="adm-publish">
      <p className={`adm-build adm-build--${tone}`} role="status" aria-live="polite">
        <span>{label}</span> {build?.url && <a href={build.url} target="_blank" rel="noopener">Ver detalhes</a>}
      </p>
      {message && <p className="adm-notice adm-notice--error adm-publish-error" role="alert"><Icon name="warning" /><span>{message}</span></p>}
    </div>
  );
}
