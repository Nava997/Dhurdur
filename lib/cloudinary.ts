import 'server-only';
import { createHash } from 'crypto';

// Server-side Cloudinary helpers. The API secret never leaves the server:
// browsers get a short-lived signature for one folder (see /api/cloudinary/sign)
// and upload straight to Cloudinary with it.

export type UploadPurpose = 'gallery' | 'stylist' | 'product' | 'reference';
export const ADMIN_PURPOSES: UploadPurpose[] = ['gallery', 'stylist', 'product'];
export const ALLOWED_FORMATS = 'jpg,jpeg,png,webp';
const ROOT = 'dhurdur';

function config() {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

export const isCloudinaryConfigured = () => config() !== null;

/** Folder an upload lands in. Customer photos are kept per user so they can be erased together. */
export function folderFor(purpose: UploadPurpose, uid: string): string {
  return purpose === 'reference' ? `${ROOT}/reference/${uid}` : `${ROOT}/${purpose}`;
}

// https://cloudinary.com/documentation/authentication_signatures
function sign(params: Record<string, string | number>, apiSecret: string): string {
  const toSign = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  return createHash('sha1').update(toSign + apiSecret).digest('hex');
}

export function signUpload(folder: string) {
  const c = config();
  if (!c) throw new Error('Cloudinary not configured');
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { allowed_formats: ALLOWED_FORMATS, folder, timestamp };
  return { cloudName: c.cloudName, apiKey: c.apiKey, ...params, signature: sign(params, c.apiSecret) };
}

/**
 * public_id of an image in this account, or null if the URL is not one of ours.
 * e.g. https://res.cloudinary.com/<cloud>/image/upload/v1712345/dhurdur/gallery/abc.jpg -> dhurdur/gallery/abc
 */
export function publicIdFromUrl(url: string): string | null {
  const c = config();
  if (!c || typeof url !== 'string') return null;
  const prefix = `https://res.cloudinary.com/${c.cloudName}/image/upload/`;
  if (!url.startsWith(prefix)) return null;
  const rest = url.slice(prefix.length).replace(/^v\d+\//, '');
  const match = rest.match(new RegExp(`^(${ROOT}/[A-Za-z0-9_/-]+)\\.[a-z]+$`));
  return match ? match[1] : null;
}

async function adminDelete(query: string): Promise<void> {
  const c = config();
  if (!c) return;
  const res = await fetch(`https://api.cloudinary.com/v1_1/${c.cloudName}/resources/image/upload?${query}`, {
    method: 'DELETE',
    headers: { Authorization: `Basic ${Buffer.from(`${c.apiKey}:${c.apiSecret}`).toString('base64')}` },
  });
  if (!res.ok) throw new Error(`Cloudinary delete failed: ${res.status}`);
}

/** Deletes up to 100 images per call (Cloudinary Admin API limit). */
export async function deleteImages(publicIds: string[]): Promise<void> {
  for (let i = 0; i < publicIds.length; i += 100) {
    const q = publicIds.slice(i, i + 100).map(id => `public_ids[]=${encodeURIComponent(id)}`).join('&');
    await adminDelete(q);
  }
}

/** Deletes every image a customer uploaded (GDPR erasure). */
export async function deleteUserImages(uid: string): Promise<void> {
  await adminDelete(`prefix=${encodeURIComponent(`${ROOT}/reference/${uid}/`)}`);
}
