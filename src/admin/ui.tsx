/**
 * Peças partilhadas do painel: ícones, cabeçalho de página, estados (a carregar, vazio, aviso),
 * campos de formulário, diálogos e confirmações. Só apresentação; a lógica vive nas secções.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

// ---------- ícones (SVG próprio, traço único de 1,75 px, desenhados a 24 px) ----------

const PATHS = {
  overview: <><rect width="7" height="9" x="3" y="3" rx="1" /><rect width="7" height="5" x="14" y="3" rx="1" /><rect width="7" height="9" x="14" y="12" rx="1" /><rect width="7" height="5" x="3" y="16" rx="1" /></>,
  projects: <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />,
  profile: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  path: <><circle cx="6" cy="19" r="3" /><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" /><circle cx="18" cy="5" r="3" /></>,
  tag: <><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" /><circle cx="7.5" cy="7.5" r="1" /></>,
  link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>,
  file: <><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H8" /></>,
  external: <><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>,
  menu: <><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></>,
  close: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  panel: <><rect width="18" height="18" x="3" y="3" rx="2" /><path d="M9 3v18" /></>,
  chevron: <path d="m9 18 6-6-6-6" />,
  up: <><path d="m5 12 7-7 7 7" /><path d="M12 19V5" /></>,
  down: <><path d="M12 5v14" /><path d="m19 12-7 7-7-7" /></>,
  left: <><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></>,
  right: <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
  edit: <><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" /><path d="m15 5 4 4" /></>,
  trash: <><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></>,
  plus: <><path d="M5 12h14" /><path d="M12 5v14" /></>,
  eye: <><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" /></>,
  warning: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /><path d="M12 9v4" /><path d="M12 17h.01" /></>,
  check: <><path d="M21.801 10A10 10 0 1 1 17 3.335" /><path d="m9 11 3 3L22 4" /></>,
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5" /><path d="M12 3v12" /></>,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = '' }: { name: IconName; className?: string }) {
  return (
    <svg className={`adm-ico ${className}`} viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}

// ---------- cabeçalhos ----------

export function PageHeader({ title, titleId = 'page-title', description, actions, meta, before, sticky = false, children }: {
  title: string;
  titleId?: string;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  before?: ReactNode;
  sticky?: boolean;
  children?: ReactNode;
}) {
  return (
    <header className={`adm-page-head${sticky ? ' adm-page-head--sticky' : ''}`}>
      <div className="adm-page-head-row">
        <div className="adm-page-head-text">
          {before}
          <h1 id={titleId}>{title}</h1>
          {meta && <div className="adm-page-meta">{meta}</div>}
          {description && <p className="adm-page-desc">{description}</p>}
        </div>
        {actions && <div className="adm-actions">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

export function SubHeader({ title, id, actions }: { title: string; id?: string; actions?: ReactNode }) {
  return (
    <div className="adm-subhead">
      <h2 id={id}>{title}</h2>
      {actions && <div className="adm-actions">{actions}</div>}
    </div>
  );
}

// ---------- estados ----------

export type Notice = { tone: 'ok' | 'error'; text: string } | null;

export function NoticeLine({ notice }: { notice: Notice }) {
  if (!notice) return null;
  const ok = notice.tone === 'ok';
  return (
    <p className={`adm-notice adm-notice--${notice.tone}`} role={ok ? 'status' : 'alert'}>
      <Icon name={ok ? 'check' : 'warning'} />
      <span>{notice.text}</span>
    </p>
  );
}

/** Linhas-esqueleto com a forma aproximada do conteúdo; o texto fica para leitores de ecrã. */
export function LoadingState({ rows = 3, label = 'A carregar…' }: { rows?: number; label?: string }) {
  return (
    <div className="adm-loading" role="status">
      <span className="visually-hidden">{label}</span>
      {Array.from({ length: rows }, (_, i) => <span key={i} className="adm-skeleton" aria-hidden="true" />)}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="adm-empty">
      <p className="adm-empty-title">{title}</p>
      {children && <p className="muted">{children}</p>}
      {action}
    </div>
  );
}

// ---------- formulários ----------

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

// ---------- diálogos ----------

export function Dialog({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    // O React não escreve o atributo autofocus no HTML: dar o foco à mão ao elemento marcado.
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, []);
  return (
    <dialog ref={ref} className={`adm-dialog${wide ? ' adm-dialog--wide' : ''}`} aria-labelledby="dialog-title" onClose={onClose}>
      <div className="adm-dialog-head">
        <h2 id="dialog-title">{title}</h2>
        <button type="button" className="btn btn--quiet adm-icon" onClick={() => ref.current?.close()} aria-label="Fechar">
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}

interface ConfirmOptions { title: string; message: ReactNode; confirmLabel: string; danger?: boolean }
type ConfirmRequest = ConfirmOptions & { resolve: (ok: boolean) => void };

const ConfirmContext = createContext<(options: ConfirmOptions) => Promise<boolean>>(async () => false);

/** Confirmações com o mesmo diálogo em todo o painel (em vez do window.confirm do browser). */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => setRequest({ ...options, resolve })), []);
  const finish = (ok: boolean) => {
    request?.resolve(ok);
    setRequest(null);
  };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && (
        <Dialog title={request.title} onClose={() => finish(false)}>
          <p>{request.message}</p>
          <div className="adm-actions adm-dialog-actions">
            <button type="button" className="btn" onClick={() => finish(false)} data-autofocus>Cancelar</button>
            <button type="button" className={`btn ${request.danger ? 'adm-btn-danger' : 'btn--primary'}`} onClick={() => finish(true)}>
              {request.confirmLabel}
            </button>
          </div>
        </Dialog>
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);

// ---------- localização na barra de topo ----------

/** O editor indica o nome do que está aberto, para os breadcrumbs da barra de topo. */
export const CrumbContext = createContext<(label: string | null) => void>(() => {});

export function useCrumb(label: string | null) {
  const setCrumb = useContext(CrumbContext);
  useEffect(() => {
    setCrumb(label);
    return () => setCrumb(null);
  }, [label, setCrumb]);
}
