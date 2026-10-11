import { auth } from './firebase';

export type UploadPurpose = 'gallery' | 'stylist' | 'product' | 'reference';

const MAX_INPUT_BYTES = 15 * 1024 * 1024;
const MAX_EDGE = 1600;

/**
 * Re-draws the photo on a canvas as a JPEG of at most 1600px. Besides keeping
 * uploads small, this drops all EXIF metadata (GPS location, camera, etc.).
 */
async function toJpeg(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Bitte ein Bild auswählen.');
  if (file.size > MAX_INPUT_BYTES) throw new Error('Bild ist zu groß (max. 15 MB).');

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Bild konnte nicht verarbeitet werden.'))), 'image/jpeg', 0.85)
  );
}

/** Uploads an image to Cloudinary and returns its https URL. */
export async function uploadImage(file: File, purpose: UploadPurpose): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Bitte melden Sie sich an.');
  const blob = await toJpeg(file);

  const signRes = await fetch('/api/cloudinary/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify({ purpose }),
  });
  const sig = await signRes.json().catch(() => ({}));
  if (!signRes.ok) throw new Error(sig.error || 'Upload nicht möglich.');

  const form = new FormData();
  form.append('file', blob, 'image.jpg');
  form.append('api_key', sig.apiKey);
  form.append('timestamp', String(sig.timestamp));
  form.append('folder', sig.folder);
  form.append('allowed_formats', sig.allowed_formats);
  form.append('signature', sig.signature);

  const upRes = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, { method: 'POST', body: form });
  const data = await upRes.json().catch(() => ({}));
  if (!upRes.ok || typeof data.secure_url !== 'string') {
    throw new Error(data.error?.message || 'Upload fehlgeschlagen.');
  }
  return data.secure_url;
}

/** Admin only: removes a site image from Cloudinary once it is no longer used. Best effort. */
export async function deleteSiteImage(url: string | undefined): Promise<void> {
  const user = auth.currentUser;
  if (!url || !user || !url.startsWith('https://res.cloudinary.com/')) return;
  await fetch('/api/cloudinary/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
    body: JSON.stringify({ url }),
  }).catch(() => {});
}
