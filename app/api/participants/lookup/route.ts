import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const PHONE_RE = /^[+]?[0-9\-\s]{10,20}$/;

/**
 * Checks whether this email or phone has already joined the current live
 * session. Lets the join flow skip photo/create for returning students:
 * finished → straight to /result, mid-quiz → resume at their next question.
 * Returns only the caller's own participant identity — never other rows.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const phoneRaw = typeof body?.phone === "string" ? body.phone.trim() : "";

  if (!EMAIL_RE.test(email) || !PHONE_RE.test(phoneRaw)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  // Same normalization as participant create — stored numbers have no
  // spaces/dashes, so compare in that form.
  const phone = phoneRaw.replace(/[\s-]/g, "");

  const supabase = createAdminClient();

  const { data: session } = await supabase
    .from("sessions")
    .select("id")
    .eq("status", "live")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!session) {
    return NextResponse.json({ found: false });
  }

  const [byEmail, byPhone] = await Promise.all([
    supabase
      .from("participants")
      .select("id, name")
      .eq("session_id", session.id)
      .ilike("email", email.replace(/[%_]/g, "\\$&"))
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("participants")
      .select("id, name")
      .eq("session_id", session.id)
      .eq("phone", phone)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  if (byEmail.error || byPhone.error) {
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }
  const existing = byEmail.data ?? byPhone.data;
  if (!existing) {
    return NextResponse.json({ found: false });
  }

  const [{ count: answered }, { count: total }] = await Promise.all([
    supabase
      .from("answers")
      .select("id", { count: "exact", head: true })
      .eq("participant_id", existing.id),
    supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("session_id", session.id),
  ]);

  return NextResponse.json({
    found: true,
    participantId: existing.id,
    sessionId: session.id,
    name: existing.name,
    finished: (total ?? 0) > 0 && (answered ?? 0) >= (total ?? 0),
  });
}
