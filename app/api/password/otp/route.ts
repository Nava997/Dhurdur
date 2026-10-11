import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { sendSalonEmail, isMailConfigured } from '@/lib/mailer';
import { rateLimit, clientIp } from '@/lib/rateLimit';
import { createAuditLog, logAudit } from '@/lib/validation';
import { OTP_TTL_MS, hashOtp } from '@/lib/otp';

// Issues the e-mail confirmation code for a password change. The code is
// generated and stored (hashed) on the server, so it can't be read or
// skipped from the browser; /api/password/change checks it.

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

  if (!decoded.email) {
    return NextResponse.json({ error: 'No email on this account' }, { status: 400 });
  }
  if (!isMailConfigured()) {
    return NextResponse.json({ error: 'Email service not configured' }, { status: 503 });
  }

  // 3 codes per 10 minutes per account, 10 per IP.
  const allowed =
    (await rateLimit('password-otp-uid', decoded.uid, 3, OTP_TTL_MS)) &&
    (await rateLimit('password-otp-ip', clientIp(req), 10, OTP_TTL_MS));
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please wait a few minutes.' }, { status: 429 });
  }

  const code = String(randomInt(100000, 1000000));
  await adminDb.collection('otpCodes').doc(decoded.uid).set({
    hash: hashOtp(decoded.uid, code),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  });

  try {
    await sendSalonEmail(
      decoded.email,
      'Dhurdur: Password Change Confirmation',
      `Hi,\n\nYour confirmation code for the password change is: ${code}\n\nThe code is valid for 10 minutes. If you did not request this change, please ignore this email.\n\nThe Dhurdur Team`
    );
  } catch (err: any) {
    logAudit(createAuditLog(req, decoded.uid, undefined, 'password_otp', undefined, 'user', false, err?.message));
    return NextResponse.json({ error: 'Failed to send code' }, { status: 500 });
  }

  logAudit(createAuditLog(req, decoded.uid, undefined, 'password_otp', undefined, 'user', true));
  return NextResponse.json({ success: true });
}
