/**
 * Painel de administração: autenticação (palavra-passe + autenticador TOTP).
 * Fluxo de entrada: login -> registar ou confirmar o autenticador -> confirmar que a conta é admin.
 * Depois de entrar, a estrutura do painel e a publicação vivem em shell.tsx.
 */
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { supabase, isConfigured, describeError } from './lib/supabase';
import { Shell } from './shell';

type Gate = 'loading' | 'login' | 'enroll' | 'verify' | 'forbidden' | 'ready';

const IDLE_LIMIT_MS = 30 * 60 * 1000;

export default function App() {
  const [gate, setGate] = useState<Gate>('loading');
  const [email, setEmail] = useState('');
  const [notice, setNotice] = useState('');

  const evaluate = useCallback(async () => {
    if (!isConfigured) return;
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) {
      setGate('login');
      return;
    }
    setEmail(session.user.email ?? '');
    const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (level?.currentLevel !== 'aal2') {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      setGate(factors?.totp?.some((f) => f.status === 'verified') ? 'verify' : 'enroll');
      return;
    }
    const { data: admin } = await supabase.from('admins').select('user_id').eq('user_id', session.user.id).maybeSingle();
    setGate(admin ? 'ready' : 'forbidden');
  }, []);

  useEffect(() => {
    void evaluate();
    // Não chamar o Supabase diretamente dentro do callback (recomendação da biblioteca): adiar com setTimeout.
    const { data } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => void evaluate(), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [evaluate]);

  const onIdle = useCallback(() => setNotice('A sessão terminou após 30 minutos sem atividade.'), []);
  useIdleLogout(gate === 'ready', onIdle);

  if (!isConfigured) {
    return (
      <Card title="Painel por configurar">
        <p>Faltam as variáveis PUBLIC_SUPABASE_URL e PUBLIC_SUPABASE_ANON_KEY no build do site.</p>
      </Card>
    );
  }

  switch (gate) {
    case 'loading':
      return <Card title="A carregar"><p className="muted">A verificar a sessão…</p></Card>;
    case 'login':
      return <Login notice={notice} />;
    case 'enroll':
      return <EnrollMfa />;
    case 'verify':
      return <VerifyMfa />;
    case 'forbidden':
      return (
        <Card title="Sem acesso">
          <p>A conta {email} não tem permissão para gerir este site.</p>
          <button className="btn" type="button" onClick={() => supabase.auth.signOut()}>Sair</button>
        </Card>
      );
    case 'ready':
      return <Shell email={email} />;
  }
}

// ---------- autenticação ----------

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="adm-auth">
      <section className="adm-card" aria-labelledby="auth-title">
        <p className="adm-auth-brand"><span className="adm-brand-mark" aria-hidden="true">B</span> Painel do portefólio</p>
        <h1 id="auth-title">{title}</h1>
        {children}
      </section>
    </main>
  );
}

function Login({ notice }: { notice: string }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: String(form.get('email')),
      password: String(form.get('password')),
    });
    setBusy(false);
    if (signInError) setError(signInError.status === 400 ? 'Email ou palavra-passe incorretos.' : describeError(signInError));
  }

  return (
    <Card title="Entrar">
      {notice && <p className="adm-alert" role="status">{notice}</p>}
      <form className="adm-form" onSubmit={submit}>
        <label>Email<input id="login-email" name="email" type="email" autoComplete="username" required /></label>
        <label>Palavra-passe<input id="login-password" name="password" type="password" autoComplete="current-password" required /></label>
        {error && <p className="adm-error" role="alert">{error}</p>}
        <button className="btn btn--primary" type="submit" disabled={busy}>{busy ? 'A entrar…' : 'Entrar'}</button>
      </form>
    </Card>
  );
}

function CodeForm({ onSubmit, busy, error, label }: { onSubmit: (code: string) => void; busy: boolean; error: string; label: string }) {
  return (
    <form
      className="adm-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(String(new FormData(event.currentTarget).get('code')).replace(/\s/g, ''));
      }}
    >
      <label>
        Código de 6 dígitos
        <input id="mfa-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" required />
      </label>
      {error && <p className="adm-error" role="alert">{error}</p>}
      <button className="btn btn--primary" type="submit" disabled={busy}>{busy ? 'A confirmar…' : label}</button>
      <button className="btn" type="button" onClick={() => supabase.auth.signOut()}>Cancelar e sair</button>
    </form>
  );
}

function EnrollMfa() {
  const [factor, setFactor] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      // Remove tentativas anteriores que ficaram por confirmar, para não acumular fatores.
      const { data: existing } = await supabase.auth.mfa.listFactors();
      for (const f of existing?.all ?? []) if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Painel do portefólio' });
      if (enrollError) setError(describeError(enrollError));
      else setFactor({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    })();
  }, []);

  async function verify(code: string) {
    if (!factor) return;
    setBusy(true);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    setBusy(false);
    if (verifyError) setError('Código inválido ou expirado. Usa o código que aparece agora na aplicação.');
  }

  return (
    <Card title="Ativar o autenticador">
      <p>Para proteger o painel, cada entrada pede também um código de uma aplicação autenticadora (por exemplo, Google Authenticator, Microsoft Authenticator ou 1Password).</p>
      <ol className="adm-steps">
        <li>Na aplicação, adiciona uma conta lendo este código QR.</li>
        <li>Escreve abaixo o código de 6 dígitos que aparece.</li>
      </ol>
      {factor ? (
        <>
          <img className="adm-qr" src={factor.qr} width={200} height={200} alt="Código QR para configurar o autenticador" />
          <p className="muted">Sem câmara? Introduz esta chave à mão: <code className="adm-secret">{factor.secret}</code></p>
          <CodeForm onSubmit={verify} busy={busy} error={error} label="Ativar e entrar" />
        </>
      ) : (
        <p className={error ? 'adm-error' : 'muted'} role={error ? 'alert' : undefined}>{error || 'A preparar…'}</p>
      )}
    </Card>
  );
}

function VerifyMfa() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function verify(code: string) {
    setBusy(true);
    setError('');
    const { data } = await supabase.auth.mfa.listFactors();
    const factor = data?.totp?.find((f) => f.status === 'verified');
    if (!factor) {
      setBusy(false);
      setError('Não há nenhum autenticador ativo nesta conta.');
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    setBusy(false);
    if (verifyError) setError('Código inválido ou expirado. Usa o código que aparece agora na aplicação.');
  }

  return (
    <Card title="Confirmar entrada">
      <p>Abre a aplicação autenticadora e escreve o código do painel do portefólio.</p>
      <CodeForm onSubmit={verify} busy={busy} error={error} label="Confirmar" />
    </Card>
  );
}

/** Termina a sessão após 30 minutos sem interação. */
function useIdleLogout(active: boolean, onLogout: () => void) {
  useEffect(() => {
    if (!active) return;
    let timer = window.setTimeout(expire, IDLE_LIMIT_MS);
    function expire() {
      onLogout();
      void supabase.auth.signOut();
    }
    function reset() {
      window.clearTimeout(timer);
      timer = window.setTimeout(expire, IDLE_LIMIT_MS);
    }
    const events = ['pointerdown', 'keydown', 'scroll'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [active, onLogout]);
}
