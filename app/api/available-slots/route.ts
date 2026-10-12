import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

// Public, PII-free view of upcoming appointments — just enough to compute
// slot availability client-side. Uses the Admin SDK (bypasses Firestore
// rules) but deliberately returns only date/time/stylist/duration/status/proposal —
// never name, phone, notes, userId, or reference images.
const ACTIVE_STATUSES = ["confirmed", "pending", "proposed", "blocked"];

export async function GET() {
  // Yesterday (UTC) as the lower bound so a timezone offset never hides
  // today's bookings; the client only looks at the date it's rendering.
  const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  let snap;
  try {
    // Status is filtered in code: range + `in` on two fields would require a
    // composite index, and if that query fails every slot looks free.
    snap = await adminDb.collection("appointments").where("date", ">=", from).get();
  } catch (err) {
    console.error("[available-slots] query failed:", err);
    return NextResponse.json({ error: "Availability unavailable" }, { status: 503 });
  }

  const slots = snap.docs.filter((d) => ACTIVE_STATUSES.includes(d.data().status)).map((d) => {
    const data = d.data();
    return {
      date: data.date,
      time: data.time,
      stylist: data.stylist,
      totalDurationMins: data.totalDurationMins || 60,
      status: data.status,
      proposedDate: data.proposedDate || null,
      proposedTime: data.proposedTime || null,
    };
  });

  return NextResponse.json({ slots });
}