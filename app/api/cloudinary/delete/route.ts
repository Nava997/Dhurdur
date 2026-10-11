import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, isAdminToken } from '@/lib/firebaseAdmin';
import { deleteImages, publicIdFromUrl } from '@/lib/cloudinary';

// Admin-only: removes a site image (gallery, team, product) from Cloudinary
// when it is taken off the website, so unused photos don't pile up.
// Customer reference photos are removed by account deletion and the nightly cleanup.
const SITE_FOLDERS = /^dhurdur\/(gallery|stylist|product)\//;

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
  if (!(await isAdminToken(decoded))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const publicId = publicIdFromUrl(body?.url);
  if (!publicId || !SITE_FOLDERS.test(publicId)) {
    return NextResponse.json({ error: 'Not a site image' }, { status: 400 });
  }
  try {
    await deleteImages([publicId]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[cloudinary-delete]', err);
    return NextResponse.json({ error: 'Delete failed' }, { status: 502 });
  }
}
