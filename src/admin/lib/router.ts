import { useEffect, useState } from 'react';

/**
 * Router mínimo baseado no hash (#/projetos/123): todo o painel vive em /admin/
 * e a navegação interna usa o hash.
 */
export function useHashRoute(): string[] {
  const read = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [parts, setParts] = useState(read);
  useEffect(() => {
    const onChange = () => setParts(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return parts;
}

export const navigate = (path: string) => {
  window.location.hash = `#/${path}`;
};

/**
 * Alterações por guardar no ecrã aberto (hoje, só o editor de projetos).
 * A estrutura do painel pede confirmação antes de seguir uma ligação interna enquanto isto estiver ativo.
 */
let unsaved = false;
export const setUnsavedChanges = (value: boolean) => {
  unsaved = value;
};
export const hasUnsavedChanges = () => unsaved;
