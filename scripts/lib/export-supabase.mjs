/**
 * Exporta o conteúdo PUBLICADO do Supabase para o build.
 * Usa a função SQL public.export_published_content() (uma só chamada) e descarrega
 * as imagens e os CV do bucket privado "media".
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

export async function exportFromSupabase({ mediaDir, cvDir, cvFileName }) {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: content, error } = await supabase.rpc('export_published_content');
  if (error) throw new Error(`Não foi possível exportar o conteúdo: ${error.message}`);

  const images = [];
  const add = (media) => media && images.push(media);
  add(content.profile?.photo);
  add(content.site?.ogImage);
  for (const project of content.projects) {
    add(project.cover);
    project.gallery.forEach(add);
  }

  const download = async (media, dir) => {
    const { data, error: downloadError } = await supabase.storage.from('media').download(media.storagePath);
    if (downloadError) throw new Error(`Falha ao descarregar ${media.storagePath}: ${downloadError.message}`);
    await writeFile(join(dir, media.file), Buffer.from(await data.arrayBuffer()));
  };

  await Promise.all(images.map((media) => download(media, mediaDir)));
  for (const locale of ['pt', 'en']) {
    const cv = content.cv[locale];
    if (!cv) continue;
    cv.file = cvFileName(locale);
    await download(cv, cvDir);
  }

  return content;
}
