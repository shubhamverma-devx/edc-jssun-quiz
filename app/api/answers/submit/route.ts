import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Allow 50% slack over the question time for network latency; anything
// beyond that is treated as suspicious.
const TIMING_SLACK = 1.5;
const DEFAULT_TIME_SECONDS = 20;
// Personality-style weighted scoring: each option carries a weight
// (40/30/20/10, or equal weights when every choice is fine). Fallback when
// options.weight doesn't exist yet: top pick (correct_option_index) earns
// TOP_POINTS, any other answer OTHER_POINTS, no answer 0.
const TOP_POINTS = 40;
const OTHER_POINTS = 10;

/**
 * Validates and scores an answer entirely server-side (anti-cheat: the
 * client never sees option weights or correct_option_index until this
 * endpoint returns post-submission). Scores are never shown to students —
 * they exist for the organisers' final ranking (response time is the
 * tie-break).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const participantId =
    typeof body?.participantId === "string" ? body.participantId : "";
  const questionId =
    typeof body?.questionId === "string" ? body.questionId : "";
  const chosenOptionIndex =
    body?.chosenOptionIndex === null || body?.chosenOptionIndex === undefined
      ? null
      : Number(body.chosenOptionIndex);
  const responseTimeMs = Number(body?.responseTimeMs);

  if (!UUID_RE.test(participantId) || !UUID_RE.test(questionId)) {
    return NextResponse.json({ error: "invalid_ids" }, { status: 400 });
  }
  if (
    chosenOptionIndex !== null &&
    (!Number.isInteger(chosenOptionIndex) ||
      chosenOptionIndex < 0 ||
      chosenOptionIndex > 7)
  ) {
    return NextResponse.json({ error: "invalid_option" }, { status: 400 });
  }
  if (!Number.isFinite(responseTimeMs) || responseTimeMs < 0) {
    return NextResponse.json({ error: "invalid_response_time" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const [participantRes, questionRes] = await Promise.all([
    supabase
      .from("participants")
      .select("id, session_id, score, correct_count, current_streak, max_streak")
      .eq("id", participantId)
      .maybeSingle(),
    supabase
      .from("questions")
      .select("id, session_id, correct_option_index, time_seconds, explanation")
      .eq("id", questionId)
      .maybeSingle(),
  ]);

  const participant = participantRes.data;
  const question = questionRes.data;
  if (participantRes.error || questionRes.error) {
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }
  if (!participant || !question || participant.session_id !== question.session_id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("status")
    .eq("id", participant.session_id)
    .maybeSingle();
  if (session?.status !== "live") {
    return NextResponse.json({ error: "session_not_live" }, { status: 409 });
  }

  const timeLimitMs = (question.time_seconds ?? DEFAULT_TIME_SECONDS) * 1000;
  if (responseTimeMs > timeLimitMs * TIMING_SLACK) {
    return NextResponse.json({ error: "suspicious_timing" }, { status: 400 });
  }

  // Weighted scoring: read per-option weights; fall back to the
  // top-pick/other split if the weight column hasn't been added yet.
  let weights: number[] | null = null;
  const { data: optionRows, error: optionsError } = await supabase
    .from("options")
    .select("sort_order, weight")
    .eq("question_id", questionId)
    .order("sort_order", { ascending: true });
  if (!optionsError && optionRows?.some((o) => (o.weight ?? 0) > 0)) {
    weights = optionRows.map((o) => o.weight ?? 0);
  }

  let isCorrect: boolean;
  let pointsEarned: number;
  if (chosenOptionIndex === null) {
    isCorrect = false;
    pointsEarned = 0;
  } else if (weights) {
    const w = weights[chosenOptionIndex] ?? 0;
    isCorrect = w === Math.max(...weights);
    pointsEarned = w;
  } else {
    isCorrect =
      question.correct_option_index === null ||
      chosenOptionIndex === question.correct_option_index;
    pointsEarned = isCorrect ? TOP_POINTS : OTHER_POINTS;
  }
  const newStreak = isCorrect ? participant.current_streak + 1 : 0;

  // Insert first: the unique (participant_id, question_id) constraint is the
  // authoritative guard against double answers — claim the slot before
  // touching the score.
  const { error: insertError } = await supabase.from("answers").insert({
    participant_id: participantId,
    question_id: questionId,
    chosen_option_index: chosenOptionIndex,
    response_time_ms: Math.round(responseTimeMs),
    is_correct: isCorrect,
    points_earned: pointsEarned,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "already_answered" }, { status: 409 });
    }
    return NextResponse.json({ error: "submit_failed" }, { status: 500 });
  }

  const newScore = participant.score + pointsEarned;
  const { error: updateError } = await supabase
    .from("participants")
    .update({
      score: newScore,
      correct_count: participant.correct_count + (isCorrect ? 1 : 0),
      current_streak: newStreak,
      max_streak: Math.max(participant.max_streak, newStreak),
      last_active_at: new Date().toISOString(),
    })
    .eq("id", participantId);

  if (updateError) {
    return NextResponse.json({ error: "score_update_failed" }, { status: 500 });
  }

  return NextResponse.json({
    isCorrect,
    pointsEarned,
    newScore,
    currentStreak: newStreak,
  });
}
