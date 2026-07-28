import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLOUDINARY_URL_PREFIX = "https://res.cloudinary.com/";
// Intentionally basic — we only reject obvious typos, not enforce RFC 5322.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const PHONE_RE = /^[+]?[0-9\-\s]{10,20}$/;

/**
 * Creates (or reconnects) a participant for the current live session.
 * Uses the service-role client so the flow is reliable regardless of RLS
 * policy details; the same constraints RLS would enforce (session must be
 * live) are enforced in code below.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const phoneRaw = typeof body?.phone === "string" ? body.phone.trim() : "";
  const photoUrl = typeof body?.photoUrl === "string" ? body.photoUrl : "";
  const photoPublicId =
    typeof body?.photoPublicId === "string" ? body.photoPublicId.trim() : "";
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId : "";

  if (name.length < 1 || name.length > 60) {
    return NextResponse.json(
      { error: "invalid_input", field: "name" },
      { status: 400 }
    );
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json(
      { error: "invalid_input", field: "email" },
      { status: 400 }
    );
  }
  if (!PHONE_RE.test(phoneRaw)) {
    return NextResponse.json(
      { error: "invalid_input", field: "phone" },
      { status: 400 }
    );
  }
  // Normalize: strip spaces/dashes, keep a leading + — consistent storage
  // makes contacting winners later painless.
  const phone = phoneRaw.replace(/[\s-]/g, "");
  if (!photoUrl.startsWith(CLOUDINARY_URL_PREFIX)) {
    return NextResponse.json({ error: "invalid_photo_url" }, { status: 400 });
  }
  if (!photoPublicId) {
    return NextResponse.json({ error: "missing_photo_public_id" }, { status: 400 });
  }
  if (!UUID_RE.test(deviceId)) {
    return NextResponse.json({ error: "invalid_device_id" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // The current live session = most recently updated one with status 'live'.
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id")
    .eq("status", "live")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessionError) {
    return NextResponse.json({ error: "session_lookup_failed" }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ error: "no_live_session" }, { status: 409 });
  }

  // Reconnect case: same device already joined this session.
  const { data: existing, error: existingError } = await supabase
    .from("participants")
    .select("id")
    .eq("session_id", session.id)
    .eq("device_id", deviceId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }
  if (existing) {
    // Reconnect: refresh contact info in case the user corrected a typo.
    await supabase
      .from("participants")
      .update({ email, phone, last_active_at: new Date().toISOString() })
      .eq("id", existing.id);
    return NextResponse.json({
      participantId: existing.id,
      sessionId: session.id,
      reconnected: true,
    });
  }

  const { data: inserted, error: insertError } = await supabase
    .from("participants")
    .insert({
      session_id: session.id,
      name,
      email,
      phone,
      photo_url: photoUrl,
      photo_public_id: photoPublicId,
      device_id: deviceId,
    })
    .select("id")
    .single();

  if (insertError) {
    // Unique violation on (session_id, device_id) — a concurrent request
    // from the same device won the race; return the existing row.
    if (insertError.code === "23505") {
      const { data: raced } = await supabase
        .from("participants")
        .select("id")
        .eq("session_id", session.id)
        .eq("device_id", deviceId)
        .maybeSingle();
      if (raced) {
        return NextResponse.json({
          participantId: raced.id,
          sessionId: session.id,
          reconnected: true,
        });
      }
    }
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({
    participantId: inserted.id,
    sessionId: session.id,
    reconnected: false,
  });
}
