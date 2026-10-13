import type { APIRoute } from 'astro';

// Gerado no build para usar o endereço real do site (domínio do Vercel ou domínio próprio).
export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nDisallow: /admin/\n\nSitemap: ${new URL('/sitemap-index.xml', site).href}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
