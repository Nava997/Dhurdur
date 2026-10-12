import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { deleteImages, listReferenceImages, publicIdFromUrl } from '@/lib/cloudinary';
import { adminDb } from '@/lib/firebaseAdmin';

// GDPR storage-limitation cleanup (Art. 5(1)(e)): purges old appointments,
// waitlist entries, alerts, client notes, retired consent records and reference images
// past the retention windows stated in the privacy policy (app/privacy).
// Triggered by Vercel Cron (see vercel.json) or manually with the CRON_SECRET bearer token.
const APPOINTMENT_RETENTION_MONTHS = Number(
  process.env.APPOINTMENT_RETENTION_MONTHS ?? 36
);
const ORPHAN_IMAGE_GRACE_DAYS = 7;
const ALERT_RETENTION_DAYS = Number(
  process.env.ALERT_RETENTION_DAYS ?? 30
);
const WAITLIST_RETENTION_MONTHS = Number(
  process.env.WAITLIST_RETENTION_MONTHS ?? 6
);
const CLIENT_NOTES_RETENTION_MONTHS = Number(
  process.env.CLIENT_NOTES_RETENTION_MONTHS ?? 36
);

// Firestore batches are capped at 500 writes, so commit deletes in chunks.
async function deleteDocs(docs: FirebaseFirestore.QueryDocumentSnapshot[]): Promise<number> {
  for (let i = 0; i < docs.length; i += 500) {
    const batch = adminDb.batch();
    docs.slice(i, i + 500).forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }
  return docs.length;
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = req.headers.get('authorization') || '';
  const expected = `Bearer ${secret}`;
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const appointmentCutoff = new Date();
  appointmentCutoff.setMonth(appointmentCutoff.getMonth() - APPOINTMENT_RETENTION_MONTHS);

  const alertCutoff = new Date();
  alertCutoff.setDate(alertCutoff.getDate() - ALERT_RETENTION_DAYS);

  const waitlistCutoff = new Date();
  waitlistCutoff.setMonth(waitlistCutoff.getMonth() - WAITLIST_RETENTION_MONTHS);

  const clientNotesCutoff = new Date();
  clientNotesCutoff.setMonth(clientNotesCutoff.getMonth() - CLIENT_NOTES_RETENTION_MONTHS);

  // Delete old appointments (cancelled/confirmed older than retention)
  // Status is filtered in code: a range + `in` query on two fields would need
  // a composite Firestore index, and without it the whole cron run fails.
  const appointmentsSnap = await adminDb
    .collection('appointments')
    .where('date', '<', appointmentCutoff.toISOString().split('T')[0])
    .get();
  const expiredAppointments = appointmentsSnap.docs.filter(d => ['cancelled', 'confirmed', 'blocked', 'pending', 'proposed'].includes(d.data().status));
  // Customer reference photos (Cloudinary) go with their appointment.
  const referenceIds = expiredAppointments
    .map(d => publicIdFromUrl(d.data().referenceImage))
    .filter((id): id is string => id !== null);
  try {
    await deleteImages(referenceIds);
  } catch (err) {
    console.error('[cron-cleanup] reference image delete failed:', err);
  }
  const deletedAppointments = await deleteDocs(expiredAppointments);

  // Delete old alerts
  const alertsSnap = await adminDb
    .collection('alerts')
    .where('createdAt', '<', alertCutoff.getTime())
    .get();
  const deletedAlerts = await deleteDocs(alertsSnap.docs);

  // Delete old waitlist entries
  const waitlistSnap = await adminDb
    .collection('waitlist')
    .where('createdAt', '<', waitlistCutoff.getTime())
    .get();
  const deletedWaitlist = await deleteDocs(waitlistSnap.docs);

  // Delete old client notes (by updatedAt)
  const clientNotesSnap = await adminDb
    .collection('clientNotes')
    .where('updatedAt', '<', clientNotesCutoff.getTime())
    .get();
  const deletedClientNotes = await deleteDocs(clientNotesSnap.docs);

  // The cookie banner and its consent log were retired (the site sets no
  // consent-requiring storage), so any leftover records are purged entirely.
  const deletedConsentLogs = await deleteDocs((await adminDb.collection('consentLogs').get()).docs);

  // Reference photos uploaded but never attached to a booking (customer
  // abandoned the form, or swapped the photo) — remove after a grace period.
  let deletedOrphanImages = 0;
  try {
    const orphanCutoff = Date.now() - ORPHAN_IMAGE_GRACE_DAYS * 24 * 60 * 60 * 1000;
    const inUse = new Set(
      (await adminDb.collection('appointments').select('referenceImage').get()).docs
        .map(d => publicIdFromUrl(d.data().referenceImage))
        .filter((id): id is string => id !== null)
    );
    const orphans = (await listReferenceImages())
      .filter(img => Date.parse(img.createdAt) < orphanCutoff && !inUse.has(img.publicId))
      .map(img => img.publicId);
    await deleteImages(orphans);
    deletedOrphanImages = orphans.length;
  } catch (err) {
    console.error('[cron-cleanup] orphan image cleanup failed:', err);
  }

  // Expired rate-limit counters and password codes (housekeeping, not PII-bearing).
  const now = Date.now();
  const deletedRateLimits = await deleteDocs(
    (await adminDb.collection('rateLimits').where('expiresAt', '<', now).get()).docs
  );
  const deletedOtpCodes = await deleteDocs(
    (await adminDb.collection('otpCodes').where('expiresAt', '<', now).get()).docs
  );

  return NextResponse.json({
    ok: true,
    deletedRateLimits,
    deletedOtpCodes,
    deletedAppointments,
    deletedAlerts,
    deletedWaitlist,
    deletedClientNotes,
    deletedConsentLogs,
    deletedOrphanImages,
  });
}