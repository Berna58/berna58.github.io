/**
 * Carrega o conteúdo de supabase/seed/content.json numa base de dados VAZIA (local ou produção).
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run seed
 *
 * Recusa correr se já existir perfil, para nunca duplicar conteúdo.
 * Os projetos entram como rascunho e só depois são publicados, para passarem pelas mesmas
 * regras de publicação da base de dados que o painel.
 */
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const LOCALES = ['pt', 'en'];
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.pdf': 'application/pdf' };

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const seedDir = join(root, 'supabase/seed');

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Define SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de correr o seed.');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const content = JSON.parse(await readFile(join(seedDir, 'content.json'), 'utf8'));

/** Executa um pedido ao Supabase e falha com uma mensagem clara se der erro. */
async function must(request, what) {
  const { data, error } = await request;
  if (error) throw new Error(`${what}: ${error.message}${error.details ? ` (${error.details})` : ''}`);
  return data;
}

const existing = await must(db.from('profile').select('id').limit(1), 'verificar perfil');
if (existing.length > 0) {
  console.error('A base de dados já tem conteúdo. O seed só corre numa base de dados vazia.');
  process.exit(1);
}

// ---------- media ----------
const mediaIds = new Map();
async function uploadMedia(file, { width = null, height = null, i18n }) {
  if (mediaIds.has(file)) return mediaIds.get(file);
  const bytes = await readFile(join(seedDir, 'media', file));
  const contentType = MIME[extname(file).toLowerCase()];
  if (!contentType) throw new Error(`Tipo de ficheiro não suportado: ${file}`);
  const storagePath = `seed/${file}`;
  await must(db.storage.from('media').upload(storagePath, bytes, { contentType, upsert: true }), `enviar ${file}`);
  const row = await must(
    db.from('media').insert({ storage_path: storagePath, mime_type: contentType, width, height, byte_size: bytes.length }).select('id').single(),
    `registar ${file}`,
  );
  await must(
    db.from('media_translations').insert(LOCALES.map((locale) => ({ media_id: row.id, locale, alt: i18n[locale].alt, caption: i18n[locale].caption ?? null }))),
    `texto alternativo de ${file}`,
  );
  mediaIds.set(file, row.id);
  return row.id;
}

// ---------- taxonomias ----------
const categoryIds = new Map();
for (const category of content.categories) {
  const row = await must(db.from('categories').insert({ slug: category.slug, sort_order: category.sortOrder }).select('id').single(), `categoria ${category.slug}`);
  await must(
    db.from('category_translations').insert(LOCALES.map((locale) => ({ category_id: row.id, locale, name: category.i18n[locale].name }))),
    `nomes da categoria ${category.slug}`,
  );
  categoryIds.set(category.slug, row.id);
}

const techRows = await must(
  db.from('technologies').insert(content.technologies.map((t) => ({ name: t.name, tech_group: t.group, sort_order: t.sortOrder }))).select('id, name'),
  'tecnologias',
);
const techIds = new Map(techRows.map((row) => [row.name, row.id]));
const techId = (name) => {
  const id = techIds.get(name);
  if (!id) throw new Error(`Tecnologia desconhecida: ${name}`);
  return id;
};

// ---------- perfil e site ----------
const profile = content.profile;
await must(
  db.from('profile').insert({
    id: 1,
    full_name: profile.fullName,
    email: profile.email,
    available: profile.available,
    work_modes: profile.workModes,
    work_zones: profile.workZones,
    photo_media_id: profile.photo ? await uploadMedia(profile.photo.file, profile.photo) : null,
  }),
  'perfil',
);
await must(
  db.from('profile_translations').insert(
    LOCALES.map((locale) => {
      const t = profile.i18n[locale];
      return {
        locale,
        headline: t.headline,
        role_line: t.roleLine,
        location: t.location,
        bio_short: t.bioShort,
        bio_long: t.bioLong,
        ai_note: t.aiNote ?? null,
        principles: t.principles ?? [],
      };
    }),
  ),
  'textos do perfil',
);

await must(
  db.from('site_settings').insert({
    id: 1,
    og_media_id: content.site.ogImage ? await uploadMedia(content.site.ogImage.file, content.site.ogImage) : null,
  }),
  'definições do site',
);
await must(
  db.from('site_settings_translations').insert(
    LOCALES.map((locale) => ({ locale, title: content.site.i18n[locale].title, description: content.site.i18n[locale].description })),
  ),
  'textos do site',
);

// ---------- projetos ----------
for (const project of content.projects) {
  const row = await must(
    db.from('projects').insert({
      slug: project.slug,
      kind: project.kind,
      status: 'draft',
      featured: project.featured,
      sort_order: project.sortOrder,
      category_id: categoryIds.get(project.category),
      year: project.year,
      project_state: project.state,
      code_visibility: project.codeVisibility,
      demo_url: project.demoUrl,
      repo_url: project.repoUrl,
      video_url: project.videoUrl,
      cover_media_id: await uploadMedia(project.cover.file, project.cover),
    }).select('id').single(),
    `projeto ${project.slug}`,
  );

  await must(
    db.from('project_translations').insert(
      LOCALES.map((locale) => {
        const t = project.i18n[locale];
        return {
          project_id: row.id,
          locale,
          title: t.title,
          summary: t.summary,
          role: t.role ?? null,
          problem: t.problem ?? null,
          audience: t.audience ?? null,
          solution: t.solution ?? null,
          features: t.features ?? [],
          decisions: t.decisions ?? [],
          challenges: t.challenges ?? [],
          results: t.results ?? null,
          ai_usage: t.aiUsage ?? null,
          seo_title: t.seoTitle ?? null,
          seo_description: t.seoDescription ?? null,
        };
      }),
    ),
    `textos do projeto ${project.slug}`,
  );

  if (project.technologies.length > 0) {
    await must(
      db.from('project_technologies').insert(project.technologies.map((name, i) => ({ project_id: row.id, technology_id: techId(name), sort_order: i }))),
      `tecnologias do projeto ${project.slug}`,
    );
  }

  for (const [i, media] of project.gallery.entries()) {
    const mediaId = await uploadMedia(media.file, media);
    await must(db.from('project_media').insert({ project_id: row.id, media_id: mediaId, sort_order: i }), `galeria de ${project.slug}`);
  }

  await must(
    db.from('projects').update({ status: 'published', published_at: project.publishedAt }).eq('id', row.id),
    `publicar ${project.slug}`,
  );
}

// ---------- percurso ----------
for (const exp of content.experiences) {
  const row = await must(
    db.from('experiences').insert({
      organization: exp.organization,
      org_url: exp.orgUrl,
      employment_type: exp.employmentType,
      start_date: exp.start,
      end_date: exp.end,
      sort_order: exp.sortOrder,
    }).select('id').single(),
    `experiência ${exp.organization}`,
  );
  await must(
    db.from('experience_translations').insert(
      LOCALES.map((locale) => ({
        experience_id: row.id,
        locale,
        role: exp.i18n[locale].role,
        description: exp.i18n[locale].description ?? null,
        highlights: exp.i18n[locale].highlights ?? [],
      })),
    ),
    `textos da experiência ${exp.organization}`,
  );
  if (exp.technologies.length > 0) {
    await must(
      db.from('experience_technologies').insert(exp.technologies.map((name, i) => ({ experience_id: row.id, technology_id: techId(name), sort_order: i }))),
      `tecnologias da experiência ${exp.organization}`,
    );
  }
}

for (const edu of content.education) {
  const row = await must(
    db.from('education').insert({ institution: edu.institution, start_date: edu.start, end_date: edu.end, sort_order: edu.sortOrder }).select('id').single(),
    `formação ${edu.institution}`,
  );
  await must(
    db.from('education_translations').insert(
      LOCALES.map((locale) => ({ education_id: row.id, locale, degree: edu.i18n[locale].degree, description: edu.i18n[locale].description ?? null })),
    ),
    `textos da formação ${edu.institution}`,
  );
}

// ---------- ligações e CV ----------
await must(
  db.from('links').insert(content.links.map((l) => ({ kind: l.kind, url: l.url, label: l.label ?? null, placements: l.placements, sort_order: l.sortOrder }))),
  'ligações',
);

for (const locale of LOCALES) {
  const cv = content.cv[locale];
  if (!cv) continue;
  const mediaId = await uploadMedia(cv.file, {
    i18n: { pt: { alt: `CV de ${profile.fullName}` }, en: { alt: `${profile.fullName} CV` } },
  });
  await must(db.from('cv_files').insert({ locale, media_id: mediaId }), `CV ${locale}`);
}

console.log(`Seed concluído: ${content.projects.length} projetos, ${content.experiences.length} experiências, ${mediaIds.size} ficheiros.`);
