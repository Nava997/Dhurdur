import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, isAdminToken } from '@/lib/firebaseAdmin';
import { rateLimit } from '@/lib/rateLimit';
import { ADMIN_PURPOSES, folderFor, isCloudinaryConfigured, signUpload, type UploadPurpose } from '@/lib/cloudinary';

// Hands a logged-in browser a one-off signature for a direct Cloudinary upload.
// The folder is chosen here, not by the caller: customers can only ever upload
// into their own reference folder, and site images (gallery, team, products)
// are admin-only.
const PURPOSES: UploadPurpose[] = ['gallery', 'stylist', 'product', 'reference'];

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

  const body = await req.json().catch(() => null);
  const purpose = body?.purpose as UploadPurpose;
  if (!PURPOSES.includes(purpose)) {
    return NextResponse.json({ error: 'Invalid purpose' }, { status: 400 });
  }

  const isAdmin = await isAdminToken(decoded);
  if (ADMIN_PURPOSES.includes(purpose) && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!(await rateLimit('cloudinary-sign', decoded.uid, isAdmin ? 200 : 10, 60 * 60 * 1000))) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  if (!isCloudinaryConfigured()) {
    return NextResponse.json({ error: 'Image uploads not configured' }, { status: 503 });
  }

  return NextResponse.json(signUpload(folderFor(purpose, decoded.uid)));
}
