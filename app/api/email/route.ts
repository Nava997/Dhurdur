import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, isAdminToken } from '@/lib/firebaseAdmin';
import { sendSalonEmail, isMailConfigured } from '@/lib/mailer';
import { validateRequest, emailRequestSchema, createAuditLog, logAudit } from '@/lib/validation';

// Admin-only free-text e-mail (appointment confirmations, proposals, waitlist
// notices). Customers never send free text: their booking e-mails are
// composed server-side by /api/appointments/notify.
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let userId: string | undefined;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logAudit(createAuditLog(req, undefined, undefined, 'email_send', undefined, 'notification', false, 'Missing or invalid Authorization header'));
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(authHeader.slice(7));
    } catch {
      logAudit(createAuditLog(req, undefined, undefined, 'email_send', undefined, 'notification', false, 'Invalid token'));
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    userId = decodedToken.uid;
    if (!(await isAdminToken(decodedToken))) {
      logAudit(createAuditLog(req, userId, 'user', 'email_send', undefined, 'notification', false, 'Non-admin caller'));
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const validation = validateRequest(emailRequestSchema, await req.json().catch(() => null));
    if (!validation.success) {
      logAudit(createAuditLog(req, userId, 'admin', 'email_send', undefined, 'notification', false, 'Validation failed', { errors: validation.errors.flatten() }));
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors.flatten() },
        { status: 400 }
      );
    }

    if (!isMailConfigured()) {
      logAudit(createAuditLog(req, userId, 'admin', 'email_send', undefined, 'notification', false, 'Email credentials not configured'));
      return NextResponse.json({ error: 'Email service not configured' }, { status: 503 });
    }

    const { email, subject, message } = validation.data;
    await sendSalonEmail(email, subject, message);

    logAudit(createAuditLog(req, userId, 'admin', 'email_send', undefined, 'notification', true, undefined, {
      to: email.replace(/(.{2})(.*)(@.*)/, '$1***$3'), // Mask email in logs
      durationMs: Date.now() - startTime,
    }));
    return NextResponse.json({ success: true, message: 'Email sent successfully' }, { status: 200 });
  } catch (error) {
    logAudit(createAuditLog(req, userId, 'admin', 'email_send', undefined, 'notification', false, error instanceof Error ? error.message : 'Failed to send email', {
      durationMs: Date.now() - startTime,
    }));
    // Don't expose internal error details
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}
