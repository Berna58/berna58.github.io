/**
 * Prepara uma imagem antes do upload: reduz para no máximo 2560 px no lado maior e converte para WebP.
 * Reencodar também remove metadados EXIF (por exemplo, a localização GPS das fotografias).
 */
export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
}

export async function prepareImage(file: File, maxSide = 2560, quality = 0.85): Promise<PreparedImage> {
  if (!file.type.startsWith('image/')) throw new Error('O ficheiro não é uma imagem.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('O browser não conseguiu processar a imagem.');
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality));
  if (!blob) throw new Error('Não foi possível converter a imagem.');
  return { blob, width, height };
}
