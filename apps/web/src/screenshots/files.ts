import { MAX_SCREENSHOTS, MAX_IMAGE_BYTES, MAX_TOTAL_IMAGE_BYTES, MAX_IMAGE_PIXELS, MAX_TOTAL_IMAGE_PIXELS, MAX_IMAGE_EDGE } from '@fuzl/planning';
export interface ScreenshotFile { id: string; file: File; url: string; width: number; height: number }
export const selectionKey = (files: Pick<ScreenshotFile, 'id'>[]) => files.map((file) => file.id).join('|');
export function selectionError(files: Pick<File, 'type' | 'size'>[]): string | null {
  if (files.length > MAX_SCREENSHOTS) return 'Select up to 5 screenshots. Remove some before adding more.';
  if (files.some((file) => !['image/png', 'image/jpeg'].includes(file.type))) return 'Only PNG and JPEG are supported. Export HEIC, WebP, GIF, or other formats as PNG/JPEG first.';
  if (files.some((file) => file.size === 0 || file.size > MAX_IMAGE_BYTES)) return 'Each screenshot must be nonempty and at most 5 MiB.';
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_IMAGE_BYTES) return 'Use at most 15 MiB of screenshots in total.';
  return null;
}
export function moveImage<T>(items: T[], index: number, delta: number): T[] {
  const to = index + delta;
  if (index < 0 || index >= items.length || to < 0 || to >= items.length) return items;
  const next = [...items]; [next[index], next[to]] = [next[to], next[index]]; return next;
}
// Inspect bounded headers before asking the browser to decode pixel data.
export function imageDimensions(bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 24 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) return { width: view.getUint32(16), height: view.getUint32(20) };
  if (bytes[0] === 255 && bytes[1] === 216) {
    for (let at = 2; at + 9 < bytes.length;) {
      if (bytes[at] !== 255) break;
      const marker = bytes[at + 1]; if (marker === 255) { at += 1; continue; }
      if (marker === 217 || marker === 218) break;
      const size = view.getUint16(at + 2); if (size < 2) break;
      if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)) return { width: view.getUint16(at + 7), height: view.getUint16(at + 5) };
      at += 2 + size;
    }
  }
  throw new Error('The image header is unreadable. Select an intact PNG or JPEG.');
}
export async function prepareFiles(files: File[], existing: ScreenshotFile[]): Promise<ScreenshotFile[]> {
  const error = selectionError([...existing.map((item) => item.file), ...files]); if (error) throw new Error(error);
  const added: ScreenshotFile[] = [];
  let pixels = existing.reduce((sum, image) => sum + image.width * image.height, 0);
  try {
    for (const file of files) {
      const { width, height } = imageDimensions(new Uint8Array(await file.arrayBuffer())); pixels += width * height;
      if (!width || !height || width > MAX_IMAGE_EDGE || height > MAX_IMAGE_EDGE || width * height > MAX_IMAGE_PIXELS || pixels > MAX_TOTAL_IMAGE_PIXELS) throw new Error('Crop or resize to at most 4096 pixels per side, 8 megapixels each, and 20 megapixels total.');
      const bitmap = await createImageBitmap(file); bitmap.close();
      added.push({ id: crypto.randomUUID(), file, width, height, url: URL.createObjectURL(file) });
    }
    return added;
  } catch (failure) { for (const item of added) URL.revokeObjectURL(item.url); throw failure; }
}
export function fileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read the selected screenshot. Reselect it.'));
    reader.readAsDataURL(file);
  });
}

export function releaseRemovedUrls(previous: ScreenshotFile[], next: ScreenshotFile[], revoke = URL.revokeObjectURL) {
  const kept = new Set(next.map((file) => file.id));
  for (const file of previous) if (!kept.has(file.id)) revoke(file.url);
}
export function readStillCurrent(submitted: { revision: number; key: string }, revision: number, files: Pick<ScreenshotFile, 'id'>[]) {
  return submitted.revision === revision && submitted.key === selectionKey(files);
}
