import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOP_N = 20;

/** Top 20 by score plus the requesting participant's own rank. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId") ?? "";
  const participantId = searchParams.get("participantId") ?? "";

  if (!UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: rows, error } = await supabase
    .from("participants")
    .select("id, name, photo_url, score")
    .eq("session_id", sessionId)
    .order("score", { ascending: false })
    .order("joined_at", { ascending: true });

  if (error || !rows) {
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }

  const top = rows.slice(0, TOP_N).map((r, i) => ({
    participantId: r.id,
    name: r.name,
    photoUrl: r.photo_url,
    score: r.score,
    rank: i + 1,
  }));

  let you: { rank: number; score: number } | null = null;
  if (UUID_RE.test(participantId)) {
    const idx = rows.findIndex((r) => r.id === participantId);
    if (idx !== -1) you = { rank: idx + 1, score: rows[idx].score };
  }

  return NextResponse.json({
    top,
    you,
    totalParticipants: rows.length,
  });
}
