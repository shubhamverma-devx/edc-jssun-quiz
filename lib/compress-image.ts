/**
 * Downscales + re-encodes a photo on-device before upload. Phone camera
 * shots are 3–12MB; a 900px JPEG at q0.82 is typically under 150KB, which
 * makes uploads fast even on weak campus Wi-Fi. Falls back to the original
 * blob if decoding fails (e.g. an exotic format) — Cloudinary handles those.
 */
const MAX_EDGE = 900;
const QUALITY = 0.82;

export async function compressImage(file: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY)
    );
    // A failed or *larger* re-encode means the original was already small.
    if (!blob || blob.size >= file.size) return file;
    return blob;
  } catch {
    return file;
  }
}
