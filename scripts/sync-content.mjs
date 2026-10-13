/**
 * Prepara o conteúdo antes de `astro dev` / `astro build`.
 *
 * - Com SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY definidos: exporta o conteúdo PUBLICADO do Supabase
 *   (ver scripts/lib/export-supabase.mjs) e descarrega as imagens e os CV.
 * - Sem essas variáveis: usa o seed local (supabase/seed), para desenvolvimento e CI sem segredos.
 *
 * Saída (fora do Git): src/generated/content.json, src/generated/media/*, public/cv/*.
 * O conteúdo é validado com o mesmo esquema que o site usa; se falhar, o build pára.
 */
import { mkdir, rm, copyFile, writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { siteContentSchema } from '../src/lib/content/schema.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'src/generated');
const mediaOut = join(out, 'media');
const cvOut = join(root, 'public/cv');

const useSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

// Em produção (workflow de deploy) é obrigatório usar o Supabase: nunca publicar o seed local por engano.
if (process.env.REQUIRE_SUPABASE === '1' && !useSupabase) {
  console.error('REQUIRE_SUPABASE=1, mas faltam SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY. O build foi interrompido.');
  process.exit(1);
}

await rm(out, { recursive: true, force: true });
await rm(cvOut, { recursive: true, force: true });
await mkdir(mediaOut, { recursive: true });
await mkdir(cvOut, { recursive: true });

/** Nome legível para o PDF descarregado pelos visitantes. */
const cvFileName = (locale) => `Bernardo_Azevedo_CV_${locale.toUpperCase()}.pdf`;

let content;

if (useSupabase) {
  const { exportFromSupabase } = await import('./lib/export-supabase.mjs');
  content = await exportFromSupabase({ mediaDir: mediaOut, cvDir: cvOut, cvFileName });
} else {
  const seedDir = join(root, 'supabase/seed');
  content = JSON.parse(await readFile(join(seedDir, 'content.json'), 'utf8'));
  content.generatedAt = new Date().toISOString();
  const files = new Set();
  const collect = (m) => m && files.add(m.file);
  collect(content.profile.photo);
  collect(content.site.ogImage);
  for (const p of content.projects) { collect(p.cover); p.gallery.forEach(collect); }
  for (const f of files) await copyFile(join(seedDir, 'media', f), join(mediaOut, f));
  for (const locale of ['pt', 'en']) {
    const cv = content.cv[locale];
    if (!cv) continue;
    await copyFile(join(seedDir, 'media', cv.file), join(cvOut, cvFileName(locale)));
    cv.file = cvFileName(locale);
  }
}

const parsed = siteContentSchema.safeParse(content);
if (!parsed.success) {
  console.error('Conteúdo inválido — o build foi interrompido:');
  for (const issue of parsed.error.issues) console.error(`  • ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

await writeFile(join(out, 'content.json'), JSON.stringify(parsed.data, null, 2));
console.log(`Conteúdo preparado a partir de ${useSupabase ? 'Supabase' : 'seed local'}: ${parsed.data.projects.length} projetos.`);
