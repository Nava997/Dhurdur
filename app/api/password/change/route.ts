import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { createAuditLog, logAudit } from '@/lib/validation';
import { OTP_MAX_ATTEMPTS, hashOtp } from '@/lib/otp';

// Completes a password change. Requires (1) a fresh sign-in — the client
// re-authenticates with the current password right before calling this —
// and (2) the e-mailed code from /api/password/otp. The password is then set
// server-side, so neither check can be skipped from the browser.
const MAX_AUTH_AGE_SECONDS = 5 * 60;

const bodySchema = z.object({
  code: z.string().regex(/^\d{6}$/),
  newPassword: z.string().min(8).max(128)
    .refine(p => /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p),
      'Password must contain upper- and lowercase letters, a number and a special character'),
});

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(authHeader.slice(7), true);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!(await rateLimit('password-change-ip', clientIp(req), 10, 10 * 60 * 1000))) {
    return NextResponse.json({ error: 'Too many requests. Please wait a few minutes.' }, { status: 429 });
  }

  const authAge = Math.floor(Date.now() / 1000) - (decoded.auth_time || 0);
  if (authAge > MAX_AUTH_AGE_SECONDS) {
    return NextResponse.json({ error: 'requires-recent-login' }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid request' }, { status: 400 });
  }
  const { code, newPassword } = parsed.data;

  const otpRef = adminDb.collection('otpCodes').doc(decoded.uid);
  const verdict = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(otpRef);
    const data = snap.data() as { hash: string; expiresAt: number; attempts: number } | undefined;
    if (!data || Date.now() > data.expiresAt) return 'expired';
    if (data.attempts >= OTP_MAX_ATTEMPTS) return 'locked';

    const given = Buffer.from(hashOtp(decoded.uid, code));
    const expected = Buffer.from(data.hash);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      tx.update(otpRef, { attempts: data.attempts + 1 });
      return 'wrong';
    }
    tx.delete(otpRef);
    return 'ok';
  });

  if (verdict !== 'ok') {
    logAudit(createAuditLog(req, decoded.uid, undefined, 'password_change', undefined, 'user', false, `otp ${verdict}`));
    const message = verdict === 'wrong'
      ? 'Invalid code. Please try again.'
      : 'Code expired or too many attempts. Please request a new code.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await adminAuth.updateUser(decoded.uid, { password: newPassword });
  await adminDb.collection('users').doc(decoded.uid).set({ hasUpdatedPassword: true }, { merge: true });

  logAudit(createAuditLog(req, decoded.uid, undefined, 'password_change', undefined, 'user', true));
  return NextResponse.json({ success: true });
}
