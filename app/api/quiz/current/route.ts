import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_TIME_SECONDS = 20;

/**
 * Returns the question the participant should currently see.
 * ANTI-CHEAT: correct_option_index and explanation are NEVER included here —
 * the client only learns them from /api/answers/submit's response.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId") ?? "";
  const participantId = searchParams.get("participantId") ?? "";

  if (!UUID_RE.test(sessionId) || !UUID_RE.test(participantId)) {
    return NextResponse.json({ error: "invalid_ids" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Stale identity (e.g. the participant row was removed by a data reset):
  // tell the client explicitly so it can clear storage and re-join, instead
  // of letting the user answer and fail at submit time.
  const { data: participant } = await supabase
    .from("participants")
    .select("id, session_id")
    .eq("id", participantId)
    .maybeSingle();
  if (!participant || participant.session_id !== sessionId) {
    return NextResponse.json({ invalidParticipant: true });
  }

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, mode, status, current_question_index")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) {
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  }
  if (session.status === "ended") {
    return NextResponse.json({ finished: true, sessionStatus: "ended" });
  }
  if (session.status !== "live") {
    return NextResponse.json({ waiting: true, sessionStatus: session.status });
  }

  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select("id, type, text, image_url, time_seconds, sort_order")
    .eq("session_id", sessionId)
    .order("sort_order", { ascending: true });

  if (questionsError || !questions || questions.length === 0) {
    return NextResponse.json({ waiting: true, sessionStatus: "live" });
  }

  const { data: answered } = await supabase
    .from("answers")
    .select("question_id")
    .eq("participant_id", participantId);
  const answeredIds = new Set((answered ?? []).map((a) => a.question_id));

  let questionIndex: number;
  let alreadyAnswered = false;

  // HACK: Force self_paced mode for testing since the admin panel isn't built yet
  session.mode = "self_paced";

  if (session.mode === "self_paced") {
    questionIndex = questions.findIndex((q) => !answeredIds.has(q.id));
    if (questionIndex === -1) {
      return NextResponse.json({ finished: true, sessionStatus: "live" });
    }
  } else {
    const idx = session.current_question_index;
    if (idx === null || idx < 0) {
      return NextResponse.json({ waiting: true, sessionStatus: "live" });
    }
    if (idx >= questions.length) {
      return NextResponse.json({ finished: true, sessionStatus: "live" });
    }
    questionIndex = idx;
    alreadyAnswered = answeredIds.has(questions[idx].id);
  }

  const question = questions[questionIndex];

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
    timeSeconds: question.time_seconds ?? DEFAULT_TIME_SECONDS,
    questionNumber: questionIndex + 1,
    totalQuestions: questions.length,
    mode: session.mode,
    sessionStatus: session.status,
    alreadyAnswered,
  });
}
