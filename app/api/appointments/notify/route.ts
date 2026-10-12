import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { sendSalonEmail, isMailConfigured } from '@/lib/mailer';
import { rateLimit } from '@/lib/rateLimit';
import { createAuditLog, logAudit } from '@/lib/validation';

// Side effects of a customer's own booking actions: confirmation e-mails and
// loyalty points. Both happen here, not in the browser, so a customer can't
// send arbitrary text from the salon's mailbox or award themselves points.
// Each event runs at most once per appointment.
const bodySchema = z.object({
  appointmentId: z.string().min(1).max(128),
  event: z.enum(['booked', 'cancelled', 'accepted']),
});
type NotifyEvent = z.infer<typeof bodySchema>['event'];

const EXPECTED_STATUS: Record<NotifyEvent, string> = {
  booked: 'pending',
  cancelled: 'cancelled',
  accepted: 'confirmed',
};

type Appt = {
  userId: string; name: string; phone: string; services: string[]; totalDurationMins: number;
  stylist: string; date: string; time: string; status: string; usedReward: boolean;
  specialRequests?: string; loyaltyCounted?: boolean; notified?: Partial<Record<NotifyEvent, boolean>>;
};

function emailsFor(event: NotifyEvent, a: Appt) {
  const services = (a.services || []).join(', ');
  switch (event) {
    case 'booked':
      return {
        user: ['Dhurdur: Buchungsanfrage erhalten', `Hallo ${a.name},\n\nDeine Anfrage für ${services} am ${a.date} um ${a.time} Uhr wurde an den Salon übermittelt.\n\nWir prüfen derzeit die Verfügbarkeit und werden deinen Termin in Kürze bestätigen.\n\nDein Dhurdur Team`],
        admin: ['🚨 Neuer Termin eingegangen!', `Hallo Admin,\n\nEs gibt eine neue Buchung:\nKunde: ${a.name} (${a.phone})\nLeistungen: ${services} (${a.totalDurationMins} Min)\nDatum: ${a.date} um ${a.time} Uhr\nStylist: ${a.stylist}\nWünsche: ${a.specialRequests || '-'}\n\nBitte logge dich im Admin-Panel ein, um den Termin zu bestätigen, abzulehnen oder zu verschieben.`],
      };
    case 'cancelled':
      return {
        user: ['Dhurdur: Termin storniert', `Hallo ${a.name},\n\ndein Termin am ${a.date} um ${a.time} Uhr bei ${a.stylist} wurde wie gewünscht storniert.\n\nDu kannst jederzeit einen neuen Termin auf unserer Webseite buchen.\n\nDein Dhurdur Team`],
        admin: ['Kunde hat Termin storniert', `${a.name} (${a.phone}) hat den Termin am ${a.date} um ${a.time} Uhr bei ${a.stylist} storniert.\nLeistungen: ${services}\n\nDer Zeitraum ist wieder frei.`],
      };
    case 'accepted':
      return {
        user: ['Dhurdur: Terminbestätigung', `Hallo ${a.name},\n\nDein Termin am ${a.date} um ${a.time} Uhr bei ${a.stylist} ist offiziell bestätigt!\n\nWir freuen uns auf dich.\nDhurdur`],
        admin: ['Admin Info: Termin Bestätigt', `Der Termin für ${a.name} am ${a.date} um ${a.time} Uhr wurde erfolgreich bestätigt.`],
      };
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const { appointmentId, event } = parsed.data;

  if (!(await rateLimit('appointment-notify', decoded.uid, 20, 10 * 60 * 1000))) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const apptRef = adminDb.collection('appointments').doc(appointmentId);
  const outcome = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(apptRef);
    const appt = snap.data() as Appt | undefined;
    if (!appt || appt.userId !== decoded.uid) return { error: 'not-found' as const };
    if (appt.status !== EXPECTED_STATUS[event]) return { error: 'wrong-status' as const };
    if (appt.notified?.[event]) return { error: 'already-done' as const };

    const userRef = adminDb.collection('users').doc(appt.userId);
    const user = await tx.get(userRef);
    const points = Number(user.data()?.haircutCount) || 0;
    // Bookings made before this flag existed were counted by the browser.
    const counted = appt.loyaltyCounted ?? !appt.usedReward;

    const updates: Record<string, unknown> = { [`notified.${event}`]: true };
    if (event === 'booked' && !appt.usedReward && appt.loyaltyCounted !== true) {
      if (user.exists) tx.update(userRef, { haircutCount: points + 1 });
      updates.loyaltyCounted = true;
    }
    if (event === 'cancelled' && counted) {
      if (user.exists) tx.update(userRef, { haircutCount: Math.max(0, points - 1) });
      updates.loyaltyCounted = false;
    }
    tx.update(apptRef, updates);
    return { appt };
  });

  if ('error' in outcome) {
    logAudit(createAuditLog(req, decoded.uid, 'user', `appointment_${event}`, appointmentId, 'appointment', false, outcome.error));
    const status = outcome.error === 'not-found' ? 404 : 409;
    return NextResponse.json({ error: outcome.error }, { status });
  }

  let emailed = false;
  if (isMailConfigured()) {
    const { user, admin } = emailsFor(event, outcome.appt);
    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
    const sends = [
      decoded.email ? sendSalonEmail(decoded.email, user[0], user[1]) : null,
      adminEmail ? sendSalonEmail(adminEmail, admin[0], admin[1]) : null,
    ].filter(Boolean);
    const results = await Promise.allSettled(sends);
    emailed = results.every(r => r.status === 'fulfilled');
    results.forEach(r => { if (r.status === 'rejected') console.error('[appointment-notify] email failed:', r.reason); });
  }

  logAudit(createAuditLog(req, decoded.uid, 'user', `appointment_${event}`, appointmentId, 'appointment', true, undefined, { emailed }));
  return NextResponse.json({ success: true, emailed });
}
