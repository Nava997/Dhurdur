import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from 'firebase-admin/storage';
import { adminAuth, adminDb, getAdminAuth } from '@/lib/firebaseAdmin';
import { createAuditLog, logAudit } from '@/lib/validation';
import { rateLimit } from '@/lib/rateLimit';

// Art. 17 GDPR (right to erasure). Runs server-side because customers are
// (correctly) not allowed to delete appointment records via Firestore rules,
// and because it must also remove data the client can't reach: staff notes,
// waitlist entries and uploaded reference images.
const MAX_AUTH_AGE_SECONDS = 5 * 60;

async function deleteQuery(collection: string, uid: string): Promise<number> {
  const snap = await adminDb.collection(collection).where('userId', '==', uid).get();
  for (let i = 0; i < snap.docs.length; i += 500) {
    const batch = adminDb.batch();
    snap.docs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  return snap.size;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let decoded;
  try {
    // checkRevoked: a token from a signed-out/revoked session can't delete the account.
    decoded = await adminAuth.verifyIdToken(authHeader.slice(7), true);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Require a fresh sign-in so a stolen long-lived session can't wipe the account.
  const authAge = Math.floor(Date.now() / 1000) - (decoded.auth_time || 0);
  if (authAge > MAX_AUTH_AGE_SECONDS) {
    return NextResponse.json({ error: 'requires-recent-login' }, { status: 403 });
  }

  const uid = decoded.uid;
  if (!(await rateLimit('account-delete', uid, 3, 10 * 60 * 1000))) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  try {
    const appointments = await deleteQuery('appointments', uid);
    const alerts = await deleteQuery('alerts', uid);
    const waitlist = await deleteQuery('waitlist', uid);
    await adminDb.collection('clientNotes').doc(uid).delete();
    await adminDb.collection('users').doc(uid).delete();

    const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    if (bucketName) {
      try {
        await getStorage().bucket(bucketName).deleteFiles({ prefix: `reference-images/${uid}/` });
      } catch (storageErr) {
        console.error('[account-delete] storage cleanup failed:', storageErr);
      }
    }

    await getAdminAuth().deleteUser(uid);

    logAudit(createAuditLog(req, uid, undefined, 'account_delete', uid, 'user', true, undefined, { appointments, alerts, waitlist }));
    return NextResponse.json({ success: true });
  } catch (err: any) {
    logAudit(createAuditLog(req, uid, undefined, 'account_delete', uid, 'user', false, err?.message || 'failed'));
    return NextResponse.json({ error: 'Deletion failed' }, { status: 500 });
  }
}
