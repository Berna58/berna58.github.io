// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://berna58.github.io',
  output: 'static',
  trailingSlash: 'always',
  compressHTML: true,
  // CSS pequeno: vai dentro do HTML para não bloquear a primeira pintura
  build: { format: 'directory', inlineStylesheets: 'always' },
  integrations: [
    react(),
    sitemap({ filter: (page) => !page.includes('/admin/') }),
  ],
});
