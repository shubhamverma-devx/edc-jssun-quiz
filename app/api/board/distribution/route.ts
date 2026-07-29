import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Answer distribution for the board's live bars, plus the fastest correct
 * answer (revealed on the board's reveal beat). Names/photos only — no
 * contact info ever leaves this endpoint.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const questionId = searchParams.get("questionId") ?? "";

  if (!UUID_RE.test(questionId)) {
    return NextResponse.json({ error: "invalid_question" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: answers, error } = await supabase
    .from("answers")
    .select("chosen_option_index, response_time_ms, is_correct, participant_id")
    .eq("question_id", questionId);

  if (error || !answers) {
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }

  const counts: Record<number, number> = {};
  for (const a of answers) {
    if (a.chosen_option_index !== null) {
      counts[a.chosen_option_index] = (counts[a.chosen_option_index] ?? 0) + 1;
    }
  }

  let fastest: { name: string; timeMs: number } | null = null;
  const correct = answers
    .filter((a) => a.is_correct)
    .sort((a, b) => a.response_time_ms - b.response_time_ms)[0];
  if (correct) {
    const { data: p } = await supabase
      .from("participants")
      .select("name")
      .eq("id", correct.participant_id)
      .maybeSingle();
    if (p) fastest = { name: p.name, timeMs: correct.response_time_ms };
  }

  return NextResponse.json({
    counts,
    totalAnswered: answers.length,
    fastest,
  });
}
