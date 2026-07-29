import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_TIME_SECONDS = 20;

/**
 * Board-only question fetch by (sessionId, index). The board is a trusted
 * projection display, so it MAY receive correct_option_index + explanation —
 * but only once the question's timer has expired, or when it explicitly
 * requests the reveal payload (?reveal=true) at its reveal beat. Phone
 * clients keep using /api/quiz/current, which never leaks these.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId") ?? "";
  const index = Number(searchParams.get("index"));
  const wantsReveal = searchParams.get("reveal") === "true";

  if (!UUID_RE.test(sessionId) || !Number.isInteger(index) || index < 0) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const [{ data: session }, { data: questions, error: questionsError }] =
    await Promise.all([
      supabase
        .from("sessions")
        .select("id, status, updated_at")
        .eq("id", sessionId)
        .maybeSingle(),
      supabase
        .from("questions")
        .select(
          "id, type, text, image_url, time_seconds, sort_order, correct_option_index, explanation"
        )
        .eq("session_id", sessionId)
        .order("sort_order", { ascending: true }),
    ]);

  if (!session) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }
  if (questionsError || !questions || index >= questions.length) {
    return NextResponse.json({ error: "question_not_found" }, { status: 404 });
  }

  const question = questions[index];
  const timeSeconds = question.time_seconds ?? DEFAULT_TIME_SECONDS;

  // Reveal guard: expired (vs the session's advance timestamp) or explicit.
  const startedAt = session.updated_at ? Date.parse(session.updated_at) : 0;
  const expired = Date.now() > startedAt + timeSeconds * 1000;
  const includeReveal = wantsReveal || expired;

  const { data: options, error: optionsError } = await supabase
    .from("options")
    .select("id, text, image_url, sort_order")
    .eq("question_id", question.id)
    .order("sort_order", { ascending: true });

  if (optionsError || !options) {
    return NextResponse.json({ error: "options_failed" }, { status: 500 });
  }

  return NextResponse.json({
    questionId: question.id,
    type: question.type,
    text: question.text,
    imageUrl: question.image_url,
    options: options.map((o) => ({
      id: o.id,
      text: o.text,
      imageUrl: o.image_url,
    })),
    timeSeconds,
    questionNumber: index + 1,
    totalQuestions: questions.length,
    startedAt,
    ...(includeReveal
      ? {
          correctIndex: question.correct_option_index,
          explanation: question.explanation,
        }
      : {}),
  });
}
