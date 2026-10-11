import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { adminAuth, isAdminToken } from '@/lib/firebaseAdmin';
import { rateLimit } from '@/lib/rateLimit';
import { validateRequest, emailRequestSchema, createAuditLog, logAudit } from '@/lib/validation';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let userId: string | undefined;
  let userRole: string | undefined;

  try {
    // Verify Firebase ID Token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const auditLog = createAuditLog(req, undefined, undefined, 'email_send', undefined, 'notification', false, 'Missing or invalid Authorization header');
      logAudit(auditLog);
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch {
      const auditLog = createAuditLog(req, undefined, undefined, 'email_send', undefined, 'notification', false, 'Invalid token');
      logAudit(auditLog);
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    userId = decodedToken.uid;
    userRole = (await isAdminToken(decodedToken)) ? 'admin' : 'user';

    // Shared across all server instances (the proxy limiter is per-instance).
    if (userRole !== 'admin' && !(await rateLimit('email', userId, 10, 10 * 60 * 1000))) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Validate request body
    const body = await req.json();
    const validation = validateRequest(emailRequestSchema, body);

    if (!validation.success) {
      const auditLog = createAuditLog(req, userId, userRole, 'email_send', undefined, 'notification', false, 'Validation failed', { errors: validation.errors.flatten() });
      logAudit(auditLog);
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors.flatten() },
        { status: 400 }
      );
    }

    const { email, subject, message } = validation.data;

    // Non-admins may only trigger an email to their OWN verified address —
    // never an arbitrary third party. Admin notifications still go through
    // this same route (the app sends them to a fixed admin inbox), so we
    // also allow the configured admin address specifically.
    const isSelf = email.toLowerCase() === (decodedToken.email || '').toLowerCase();
    const isConfiguredAdmin = email.toLowerCase() === (process.env.NEXT_PUBLIC_ADMIN_EMAIL || '').toLowerCase();
    if (userRole !== 'admin' && !isSelf && !isConfiguredAdmin) {
      const auditLog = createAuditLog(req, userId, userRole, 'email_send', undefined, 'notification', false, 'Recipient not permitted for non-admin caller');
      logAudit(auditLog);
      return NextResponse.json({ error: 'Forbidden: cannot email this recipient' }, { status: 403 });
    }

    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (!emailUser || !emailPass) {
      const auditLog = createAuditLog(req, userId, userRole, 'email_send', undefined, 'notification', false, 'Email credentials not configured');
      logAudit(auditLog);
      return NextResponse.json({ error: 'Email service not configured' }, { status: 503 });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      // Security: enforce TLS
      tls: {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
      },
    });

    // Sanitize inputs to prevent header injection
    const sanitizedSubject = subject.replace(/[\r\n]/g, ' ').trim();
    const sanitizedMessage = message.replace(/[\r\n]+/g, '\n').trim();
    // Escape before building the HTML part: messages contain customer-supplied
    // text (names, special requests) that would otherwise be rendered as HTML
    // in the salon's inbox.
    const escapedHtml = sanitizedMessage
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/\n/g, '<br>');

    // Sender is always the salon's own mailbox, never caller-controlled.
    await transporter.sendMail({
      from: `"Dhurdur" <${emailUser}>`,
      to: email,
      subject: sanitizedSubject,
      text: sanitizedMessage,
      html: escapedHtml,
    });

    const auditLog = createAuditLog(req, userId, userRole, 'email_send', undefined, 'notification', true, undefined, {
      to: email.replace(/(.{2})(.*)(@.*)/, '$1***$3'), // Mask email in logs
      durationMs: Date.now() - startTime,
    });
    logAudit(auditLog);

    return NextResponse.json({ success: true, message: 'Email sent successfully' }, { status: 200 });
  } catch (error) {
    const auditLog = createAuditLog(req, userId, userRole, 'email_send', undefined, 'notification', false, error instanceof Error ? error.message : 'Failed to send email', {
      durationMs: Date.now() - startTime,
    });
    logAudit(auditLog);

    // Don't expose internal error details
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}