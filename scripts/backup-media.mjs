/**
 * Copia todos os ficheiros do bucket privado "media" para uma pasta local (espelho).
 * Usado pelo workflow de backup semanal; ficheiros que já não existem no bucket são removidos
 * da pasta (o histórico do repositório de backups guarda as versões antigas).
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backup-media.mjs <pasta>
 */
import { mkdir, writeFile, readdir, rm, stat } from 'node:fs/promises';
import { join, dirname, relative, sep } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const target = process.argv[2];
if (!target || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Uso: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backup-media.mjs <pasta>');
  process.exit(1);
}

const storage = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
}).storage.from('media');

/** Lista recursivamente o bucket. As pastas aparecem sem id. */
async function listAll(prefix = '') {
  const files = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await storage.list(prefix, { limit: 1000, offset });
    if (error) throw new Error(`Não foi possível listar "${prefix}": ${error.message}`);
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) files.push(...(await listAll(path)));
      else files.push({ path, size: entry.metadata?.size ?? -1 });
    }
    if (data.length < 1000) return files;
  }
}

async function localFiles(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await localFiles(full)));
    else out.push(full);
  }
  return out;
}

const remote = await listAll();
let downloaded = 0;
for (const file of remote) {
  const destination = join(target, ...file.path.split('/'));
  const current = await stat(destination).catch(() => null);
  if (current && current.size === file.size) continue;
  const { data, error } = await storage.download(file.path);
  if (error) throw new Error(`Falha ao descarregar ${file.path}: ${error.message}`);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, Buffer.from(await data.arrayBuffer()));
  downloaded += 1;
}

const wanted = new Set(remote.map((f) => f.path));
let removed = 0;
for (const full of await localFiles(target)) {
  const path = relative(target, full).split(sep).join('/');
  if (!wanted.has(path)) {
    await rm(full);
    removed += 1;
  }
}

console.log(`Media: ${remote.length} ficheiros no bucket, ${downloaded} descarregados, ${removed} removidos.`);
