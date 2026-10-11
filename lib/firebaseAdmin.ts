import 'server-only';
import { initializeApp, getApps, cert, App, ServiceAccount } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let adminApp: App | null = null;
let adminAuthInstance: Auth | null = null;
let adminDbInstance: Firestore | null = null;

/**
 * Initialize Firebase Admin SDK (singleton pattern)
 * Safe to call multiple times during Next.js hot-reloading
 */
function getAdminApp(): App {
  if (adminApp) return adminApp;

  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp;
  }

  const base64Key = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!base64Key) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_BASE64 is not set in environment variables');
  }

  let serviceAccount: ServiceAccount;
  try {
    const decoded = Buffer.from(base64Key, 'base64').toString('utf-8');
    serviceAccount = JSON.parse(decoded);
  } catch {
    throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_BASE64: failed to decode/parse');
  }

  adminApp = initializeApp({
    credential: cert(serviceAccount),
    // Set region for GDPR compliance
    projectId: serviceAccount.projectId,
  });

  return adminApp;
}

/**
 * Get Firebase Admin Auth instance
 */
export function getAdminAuth(): Auth {
  if (!adminAuthInstance) {
    adminAuthInstance = getAuth(getAdminApp());
  }
  return adminAuthInstance;
}

/**
 * Get Firebase Admin Firestore instance
 */
function getAdminDb(): Firestore {
  if (!adminDbInstance) {
    adminDbInstance = getFirestore(getAdminApp());
  }
  return adminDbInstance;
}

/**
 * Backward compatibility exports.
 * IMPORTANT: these are lazy proxies, not eager instances. Previously these
 * called getAdminAuth()/getAdminDb() directly at module load, which meant
 * a missing or malformed FIREBASE_SERVICE_ACCOUNT_BASE64 would throw the
 * moment *any* route imported this file - even routes that only needed
 * adminAuth and never touched adminDb (or vice versa) - crashing the whole
 * request with an opaque 500 before the route's own code ever ran. Wrapping
 * in a Proxy defers initialization until a property is actually accessed,
 * so the error (if any) surfaces at the real point of use, in that route's
 * own try/catch, instead of taking down unrelated routes.
 */
export const adminAuth: Auth = new Proxy({} as Auth, {
  get(_target, prop) {
    const real = getAdminAuth();
    const value = Reflect.get(real, prop);
    return typeof value === 'function' ? value.bind(real) : value;
  },
});

export const adminDb: Firestore = new Proxy({} as Firestore, {
  get(_target, prop) {
    const real = getAdminDb();
    const value = Reflect.get(real, prop);
    return typeof value === 'function' ? value.bind(real) : value;
  },
});

/**
 * Custom Claims Management
 * Use custom claims for admin authorization instead of trusting user document's role field
 */

/**
 * Server-side admin check for API routes. Mirrors isAdmin() in firestore.rules:
 * an admin custom claim, a VERIFIED allow-listed email, or role 'admin' on the
 * user's Firestore profile (which customers cannot set — see firestore.rules).
 */
export async function isAdminToken(decoded: {
  uid: string;
  admin?: unknown;
  email?: string;
  email_verified?: boolean;
}): Promise<boolean> {
  if (decoded.admin === true) return true;

  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAIL || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  if (decoded.email_verified && decoded.email && adminEmails.includes(decoded.email.toLowerCase())) {
    return true;
  }

  const snap = await getAdminDb().collection('users').doc(decoded.uid).get();
  return snap.exists && snap.data()?.role === 'admin';
}
