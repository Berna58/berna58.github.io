// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// Endereço público: SITE_URL (domínio próprio, se existir) ou o domínio de produção que o Vercel indica.
const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const site = process.env.SITE_URL ?? (productionHost ? `https://${productionHost}` : 'https://bernardo-azevedo-portfolio.vercel.app');

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'always',
  compressHTML: true,
  // CSS pequeno: vai dentro do HTML para não bloquear a primeira pintura
  build: { format: 'directory', inlineStylesheets: 'always' },
  // A integração Supabase do Vercel cria variáveis NEXT_PUBLIC_*; também as expomos ao painel.
  vite: { envPrefix: ['PUBLIC_', 'NEXT_PUBLIC_'] },
  integrations: [
    react(),
    sitemap({ filter: (page) => !page.includes('/admin/') }),
  ],
});
