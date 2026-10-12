import 'server-only';
import nodemailer from 'nodemailer';

export function isMailConfigured(): boolean {
  return !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Sends a plain-text email (plus an escaped HTML copy) from the salon's own
 * mailbox. The sender is never caller-controlled, and message text — which
 * can contain customer input — is escaped before going into the HTML part.
 */
export async function sendSalonEmail(to: string, subject: string, message: string): Promise<void> {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  if (!emailUser || !emailPass) throw new Error('Email service not configured');

  // EMAIL_HOST selects any SMTP provider (e.g. one with an EU data processing
  // agreement); without it, Gmail is used as before.
  const host = process.env.EMAIL_HOST;
  const port = Number(process.env.EMAIL_PORT || 465);
  const transporter = nodemailer.createTransport({
    ...(host ? { host, port, secure: port === 465 } : { service: 'gmail' }),
    auth: { user: emailUser, pass: emailPass },
    tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
  });

  // Strip CR/LF from the subject to prevent header injection.
  const cleanSubject = subject.replace(/[\r\n]/g, ' ').trim();
  const cleanMessage = message.replace(/[\r\n]+/g, '\n').trim();

  await transporter.sendMail({
    from: `"Dhurdur" <${emailUser}>`,
    to,
    subject: cleanSubject,
    text: cleanMessage,
    html: escapeHtml(cleanMessage).replace(/\n/g, '<br>'),
  });
}
