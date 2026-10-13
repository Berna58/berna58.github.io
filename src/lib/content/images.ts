import { getImage } from 'astro:assets';
import { imageOf } from './index';
import type { Locale, Media } from './schema';
import type { ResolvedImage } from '@/shared/types';

/** Gera as variantes WebP de uma imagem do CMS e devolve-a pronta para os componentes React partilhados. */
export async function resolveImage(media: Media, locale: Locale, sizes: string, widths = [480, 960, 1600]): Promise<ResolvedImage> {
  const source = imageOf(media);
  const usable = widths.filter((w) => w <= source.width);
  const result = await getImage({ src: source, widths: usable.length ? usable : [source.width], format: 'webp' });
  return {
    src: result.src,
    srcSet: result.srcSet.attribute,
    sizes,
    width: source.width,
    height: source.height,
    alt: media.i18n[locale].alt,
    caption: media.i18n[locale].caption,
  };
}

/** Imagem de partilha (Open Graph) 1200 px em JPEG. */
export async function ogImageOf(media: Media): Promise<string> {
  const result = await getImage({ src: imageOf(media), width: Math.min(1200, imageOf(media).width), format: 'jpg' });
  return result.src;
}
