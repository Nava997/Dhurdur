import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, getAdminAuth, isAdminToken } from '@/lib/firebaseAdmin';
import { createAuditLog, logAudit } from '@/lib/validation';
import { rateLimit } from '@/lib/rateLimit';
import { listUserImages, type StoredImage } from '@/lib/cloudinary';

// Art. 15 / Art. 20 GDPR (access + portability). Server-side because a full
// copy must include data the customer can't read through Firestore rules:
// staff notes and account metadata. Customers export themselves; admins can
// pass { uid } to answer a request that arrived by email or phone.
async function byUser(collection: string, uid: string) {
  const snap = await adminDb.collection(collection).where('userId', '==', uid).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

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
  if (!(await rateLimit('account-export', decoded.uid, 10, 10 * 60 * 1000))) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const requested = typeof body?.uid === 'string' && body.uid ? body.uid : decoded.uid;
  const isAdmin = await isAdminToken(decoded);
  if (requested !== decoded.uid && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const [profileSnap, notesSnap, appointments, alerts, waitlist] = await Promise.all([
      adminDb.collection('users').doc(requested).get(),
      adminDb.collection('clientNotes').doc(requested).get(),
      byUser('appointments', requested),
      byUser('alerts', requested),
      byUser('waitlist', requested),
    ]);

    let account: Record<string, unknown> | null = null;
    try {
      const u = await getAdminAuth().getUser(requested);
      account = {
        email: u.email ?? null,
        emailVerified: u.emailVerified,
        signInMethods: u.providerData.map(p => p.providerId),
        createdAt: u.metadata.creationTime,
        lastSignInAt: u.metadata.lastSignInTime,
      };
    } catch {
      // No login account (e.g. already deleted) — export what's in the database.
    }

    // Reference photos live in Cloudinary, not Firestore — include the full list.
    let images: StoredImage[] | { error: string } = [];
    try {
      images = await listUserImages(requested);
    } catch (err) {
      console.error('[account-export] Cloudinary listing failed:', err);
      images = { error: 'Bildliste vorübergehend nicht abrufbar — bitte erneut versuchen.' };
    }

    if (!account && !profileSnap.exists) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    logAudit(createAuditLog(req, decoded.uid, isAdmin ? 'admin' : 'user', 'data_export', requested, 'user', true));
    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      controller: 'Dhurdur, Schweinfurt — siehe /impressum',
      information: {
        purposes: 'Terminbuchung und -verwaltung, Kundenkonto, Treuepunkte, Benachrichtigungen (Art. 6 Abs. 1 lit. b DSGVO)',
        recipients: 'Salon-Team; Auftragsverarbeiter: Google (Firebase), Vercel, Cloudinary (Referenzbilder), E-Mail-Anbieter — Details in der Datenschutzerklärung (/privacy)',
        retention: 'Termine 3 Jahre nach Termindatum, Benachrichtigungen 30 Tage, Warteliste 6 Monate, Konto bis zur Löschung',
        source: 'Von Ihnen selbst angegeben bzw. bei Nutzung der Website entstanden; interne Notizen vom Salon-Team',
        automatedDecisions: 'Keine',
        rights: 'Berichtigung, Löschung, Einschränkung, Widerspruch, Datenübertragbarkeit, Beschwerde beim BayLDA',
      },
      account,
      profile: profileSnap.exists ? { id: profileSnap.id, ...profileSnap.data() } : null,
      appointments,
      alerts,
      waitlist,
      staffNotes: notesSnap.exists ? notesSnap.data() : null,
      referenceImages: images,
    });
  } catch (err) {
    logAudit(createAuditLog(req, decoded.uid, isAdmin ? 'admin' : 'user', 'data_export', requested, 'user', false, err instanceof Error ? err.message : 'failed'));
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
