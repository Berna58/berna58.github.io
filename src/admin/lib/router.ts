import { useEffect, useState } from 'react';

/**
 * Router mínimo baseado no hash (#/projetos/123): o GitHub Pages não tem reescrita de rotas,
 * por isso todo o painel vive em /admin/ e a navegação interna usa o hash.
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
