import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, getAdminAuth, isAdminToken } from '@/lib/firebaseAdmin';
import { createAuditLog, logAudit } from '@/lib/validation';
import { rateLimit } from '@/lib/rateLimit';
import { deleteUserImages } from '@/lib/cloudinary';

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

  if (!(await rateLimit('account-delete', decoded.uid, 3, 10 * 60 * 1000))) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  // Admins may erase a customer's account on request (e.g. by email). Admin
  // accounts can't be removed this way.
  const body = await req.json().catch(() => ({}));
  const uid: string = typeof body?.uid === 'string' && body.uid ? body.uid : decoded.uid;
  if (uid !== decoded.uid) {
    if (!(await isAdminToken(decoded))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const target = await adminDb.collection('users').doc(uid).get();
    if (target.data()?.role === 'admin') {
      return NextResponse.json({ error: 'Cannot delete an admin account' }, { status: 400 });
    }
  }
  try {
    const appointments = await deleteQuery('appointments', uid);
    const alerts = await deleteQuery('alerts', uid);
    const waitlist = await deleteQuery('waitlist', uid);
    await adminDb.collection('clientNotes').doc(uid).delete();
    await adminDb.collection('users').doc(uid).delete();

    try {
      await deleteUserImages(uid);
    } catch (imageErr) {
      console.error('[account-delete] reference image cleanup failed:', imageErr);
    }

    await getAdminAuth().deleteUser(uid);

    logAudit(createAuditLog(req, decoded.uid, uid === decoded.uid ? 'user' : 'admin', 'account_delete', uid, 'user', true, undefined, { appointments, alerts, waitlist }));
    return NextResponse.json({ success: true });
  } catch (err) {
    logAudit(createAuditLog(req, decoded.uid, uid === decoded.uid ? 'user' : 'admin', 'account_delete', uid, 'user', false, err instanceof Error ? err.message : 'failed'));
    return NextResponse.json({ error: 'Deletion failed' }, { status: 500 });
  }
}
