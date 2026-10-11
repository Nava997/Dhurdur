import 'server-only';
import { createHash } from 'crypto';
import { adminDb } from '@/lib/firebaseAdmin';

/**
 * Fixed-window rate limiter shared across all serverless instances, backed by
 * Firestore (`rateLimits` collection, server-only via firestore.rules). The
 * in-memory limiter in proxy.ts is only a cheap first layer: each Vercel
 * instance has its own memory, so on its own it is easy to get around.
 *
 * Fails open if Firestore is unreachable so a database hiccup doesn't take
 * down bookings/emails; the proxy limiter still applies in that case.
 */
export async function rateLimit(
  bucket: string,
  identity: string,
  maxRequests: number,
  windowMs: number
): Promise<boolean> {
  const id = createHash('sha256').update(`${bucket}:${identity}`).digest('hex');
  const ref = adminDb.collection('rateLimits').doc(id);
  const now = Date.now();

  try {
    return await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.data() as { count: number; resetAt: number } | undefined;

      if (!data || now > data.resetAt) {
        tx.set(ref, { bucket, count: 1, resetAt: now + windowMs, expiresAt: now + windowMs });
        return true;
      }
      if (data.count >= maxRequests) return false;
      tx.update(ref, { count: data.count + 1 });
      return true;
    });
  } catch (err) {
    console.error('[rateLimit] check failed, allowing request:', err);
    return true;
  }
}

export function clientIp(req: Request): string {
  return req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';
}
