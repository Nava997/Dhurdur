import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { rateLimit, clientIp } from "@/lib/rateLimit";

// Proof-of-consent log (Art. 7(1) GDPR: "the controller shall be able to
// demonstrate that the data subject has consented"). Server-only write via
// the Admin SDK — see firestore.rules for the matching deny-all client rule.
export async function POST(req: NextRequest) {
  try {
    if (!(await rateLimit("consent-log", clientIp(req), 20, 60 * 60 * 1000))) {
      return NextResponse.json({ ok: false }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    // Public endpoint: store only well-typed, length-capped values so it
    // can't be used to dump arbitrary data into Firestore.
    const str = (v: unknown, max: number) =>
      typeof v === "string" ? v.slice(0, max) : null;

    await adminDb.collection("consentLogs").add({
      necessary: true,
      analytics: body.analytics === true,
      consentVersion: str(body.version, 32),
      consentedAt: str(body.timestamp, 40) ?? new Date().toISOString(),
      userAgent: str(body.userAgent, 300),
      url: str(body.url, 300),
      loggedAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Never let a logging failure be visible to the visitor — consent was
    // still saved locally regardless of whether this audit copy succeeds.
    console.error("[consent-log] failed to write:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}