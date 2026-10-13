# 0003 · Português e inglês

- Estado: aceite (2026-10-13)

## Decisão

- **Português na raiz** (`/`, `/projetos/`, `/percurso/`) e **inglês em `/en/`**
  (`/en/projects/`, `/en/about/`). O slug de cada projeto é o mesmo nos dois idiomas.
- **Conteúdo** traduzível vive em tabelas `*_translations`, com uma linha por idioma. Publicar
  exige os dois idiomas preenchidos.
- **Textos de interface** (botões, rótulos) ficam no código, em `src/i18n/ui.ts`, porque mudam
  com o design e não com o conteúdo.
- Cada página indica a versão no outro idioma (`hreflang`) e o seletor de idioma leva à página
  equivalente, não à home.
- Sem redirecionamento automático pelo idioma do browser: o GitHub Pages não o permite sem
  JavaScript e confunde motores de busca.
