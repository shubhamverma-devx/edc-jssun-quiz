"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "@/lib/m";
import { createClient } from "@/lib/supabase/client";
import { fadeUp, prefersReducedMotion, staggerParent } from "@/lib/motion";

type QuizOption = { id: string; text: string | null; imageUrl: string | null };

type CurrentQuestion = {
  questionId: string;
  type: "mcq" | "true_false" | "image_identify";
  text: string;
  imageUrl: string | null;
  options: QuizOption[];
  timeSeconds: number;
  questionNumber: number;
  totalQuestions: number;
  mode: "session_based" | "self_paced";
  sessionStatus: string;
  alreadyAnswered: boolean;
};

type SessionRow = {
  status: string;
  current_question_index: number | null;
  mode: string;
};

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const RING_RADIUS = 26;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** Wipes a stale quiz identity so the user can re-join from scratch. */
function clearQuizIdentity() {
  for (const key of [
    "edc-quiz-participant-id",
    "edc-quiz-session-id",
    "edc-quiz-score",
    "edc-quiz-streak",
    "edc-quiz-feedback",
    "edc-quiz-mode",
  ]) {
    sessionStorage.removeItem(key);
  }
}

export default function QuizPage() {
  const router = useRouter();
  const [ids, setIds] = useState<{ pid: string; sid: string } | null>(null);
  const [question, setQuestion] = useState<CurrentQuestion | null>(null);
  const [phase, setPhase] = useState<"loading" | "waiting" | "question" | "error">(
    "loading"
  );
  const [selection, setSelection] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [remainingMs, setRemainingMs] = useState(0);

  const startRef = useRef(0);
  const lockedRef = useRef(false);
  const questionRef = useRef<CurrentQuestion | null>(null);
  const lastIndexRef = useRef<number | null>(null);

  useEffect(() => {
    const pid = sessionStorage.getItem("edc-quiz-participant-id");
    const sid = sessionStorage.getItem("edc-quiz-session-id");
    if (!pid || !sid) {
      router.replace("/");
      return;
    }
    // sessionStorage is client-only; can't be a useState initializer under SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIds({ pid, sid });
  }, [router]);

  // All setState calls here happen after the await (async), so this is safe
  // to invoke from effects without triggering cascading-render lint rules.
  const loadQuestion = useCallback(async () => {
    if (!ids) return;
    try {
      const res = await fetch(
        `/api/quiz/current?sessionId=${ids.sid}&participantId=${ids.pid}`
      );
      const data = await res.json();

      if (data.invalidParticipant) {
        clearQuizIdentity();
        router.replace("/join");
        return;
      }
      if (data.finished) {
        router.replace("/result");
        return;
      }
      if (data.waiting) {
        setPhase("waiting");
        return;
      }
      if (data.alreadyAnswered) {
        // Answered this one already (session-based edge case) — hold on the
        // waiting screen; the realtime advance listener reloads on change.
        setPhase("waiting");
        return;
      }
      sessionStorage.setItem("edc-quiz-mode", data.mode);
      questionRef.current = data;
      lockedRef.current = false;
      startRef.current = Date.now();
      setQuestion(data);
      setSelection(null);
      setSubmitting(false);
      setRemainingMs(data.timeSeconds * 1000);
      setPhase("question");
    } catch {
      setPhase("error");
    }
  }, [ids, router]);

  useEffect(() => {
    // False positive: every setState in loadQuestion happens after the fetch
    // await resolves, never synchronously during effect execution.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadQuestion();
  }, [loadQuestion]);

  const submit = useCallback(
    async (chosen: number | null) => {
      const q = questionRef.current;
      if (!ids || !q || lockedRef.current) return;
      lockedRef.current = true;
      setSubmitting(true);

      const elapsed = Date.now() - startRef.current;
      const responseTimeMs =
        chosen === null
          ? q.timeSeconds * 1000
          : Math.min(elapsed, q.timeSeconds * 1000);

      try {
        const res = await fetch("/api/answers/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            participantId: ids.pid,
            questionId: q.questionId,
            chosenOptionIndex: chosen,
            responseTimeMs,
          }),
        });
        const data = await res.json().catch(() => null);

        if (res.ok) {
          sessionStorage.setItem("edc-quiz-score", String(data.newScore));
          sessionStorage.setItem("edc-quiz-streak", String(data.currentStreak));
          // Go directly to next question instead of feedback/interstitial
          setPhase("loading");
          loadQuestion();
          return;
        }
        if (res.status === 409 && data?.error === "already_answered") {
          // Double-submit race — this question is already claimed, so just
          // load the next unanswered one.
          setPhase("loading");
          loadQuestion();
          return;
        }
        if (res.status === 404) {
          // Participant no longer exists (data reset) — re-join cleanly.
          clearQuizIdentity();
          router.replace("/join");
          return;
        }
        throw new Error(data?.error ?? "submit_failed");
      } catch {
        lockedRef.current = false;
        setSubmitting(false);
        setPhase("error");
      }
    },
    [ids, router, loadQuestion]
  );

  // Timer: true remaining time derives from the start timestamp, not from
  // accumulating interval ticks (avoids drift). Display updates at 100ms.
  useEffect(() => {
    if (phase !== "question" || !question) return;
    const totalMs = question.timeSeconds * 1000;
    const tick = setInterval(() => {
      const left = Math.max(0, totalMs - (Date.now() - startRef.current));
      setRemainingMs(left);
      if (left === 0 && !lockedRef.current) {
        submit(null); // time up — auto-submit no answer
      }
    }, 100);
    return () => clearInterval(tick);
  }, [phase, question, submit]);

  // Realtime: session advance (session-based) and session end.
  useEffect(() => {
    if (!ids) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`quiz-${ids.sid}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${ids.sid}` },
        (payload) => {
          const s = payload.new as SessionRow;
          if (s.status === "ended") {
            router.replace("/result");
            return;
          }
          if (
            s.current_question_index !== null &&
            s.current_question_index !== lastIndexRef.current
          ) {
            lastIndexRef.current = s.current_question_index;
            setPhase("loading");
            loadQuestion();
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [ids, router, loadQuestion]);

  if (!ids || phase === "loading") {
    return (
      <Shell>
        <p className="mt-40 text-center text-[13px] text-foreground/40">
          Loading question…
        </p>
      </Shell>
    );
  }

  if (phase === "waiting") {
    return (
      <Shell>
        <div className="mt-40 text-center">
          <p className="text-lg font-bold">Hold tight</p>
          <p className="mt-2 text-[13px] text-foreground/50">
            The quiz will begin shortly. Watch the smart board.
          </p>
        </div>
      </Shell>
    );
  }

  if (phase === "error" || !question) {
    return (
      <Shell>
        <div className="mt-40 rounded-card border border-red-500/25 bg-red-500/10 p-5 text-center">
          <p className="text-[15px] font-bold text-red-400">Connection hiccup</p>
          <button
            type="button"
            onClick={loadQuestion}
            className="mt-4 rounded-card bg-gradient-to-r from-brand-cyan to-brand-purple px-6 py-2.5 text-[13px] font-bold text-background"
          >
            Retry
          </button>
        </div>
      </Shell>
    );
  }

  const totalMs = question.timeSeconds * 1000;
  const fraction = totalMs > 0 ? remainingMs / totalMs : 0;
  const secondsLeft = Math.ceil(remainingMs / 1000);
  const timerColor =
    fraction > 0.5 ? "#05b1de" : fraction > 0.2 ? "#f7cb48" : "#ff4b4b";
  const isImageOptions = question.options.some((o) => o.imageUrl);
  const timeCritical = secondsLeft <= 3 && !submitting;

  return (
    <Shell>
      {/* Red edge vignette pulsing with the timer in the last 3 seconds */}
      {timeCritical && <div aria-hidden className="vignette-critical" />}
      {/* Sticky header: counter · timer ring · brand — score is deliberately
          hidden from students; ranking stays with the organisers. */}
      <header className="sticky top-0 z-10 -mx-5 bg-background/90 backdrop-blur">
        <div className="flex items-center justify-between px-5 py-3">
          <span className="w-16 text-[12px] font-semibold text-foreground/45">
            Q {question.questionNumber}
            <span className="text-foreground/25"> / {question.totalQuestions}</span>
          </span>

          <div className={`relative h-16 w-16 ${fraction <= 0.2 ? "animate-pulse" : ""}`}>
            <svg viewBox="0 0 60 60" className="h-16 w-16 -rotate-90">
              <circle cx="30" cy="30" r={RING_RADIUS} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
              <circle
                cx="30"
                cy="30"
                r={RING_RADIUS}
                fill="none"
                stroke={timerColor}
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={RING_CIRCUMFERENCE * (1 - fraction)}
                style={{
                  transition:
                    "stroke-dashoffset 100ms linear, stroke 500ms ease",
                }}
              />
            </svg>
            <span
              className="absolute inset-0 flex items-center justify-center text-xl font-extrabold"
              style={{ color: timerColor, transition: "color 500ms ease" }}
            >
              {secondsLeft}
            </span>
          </div>

          <span className="w-16 text-right text-[11px] font-black tracking-[0.25em] text-foreground/30">
            EDC
          </span>
        </div>
        {/* Quiz progress under the header */}
        <div className="h-[3px] w-full bg-white/5">
          <div
            className="h-full bg-gradient-to-r from-brand-cyan to-brand-purple transition-[width] duration-500 ease-out"
            style={{
              width: `${((question.questionNumber - 1) / Math.max(1, question.totalQuestions)) * 100}%`,
            }}
          />
        </div>
      </header>

      {/* Question — card placed from above, options dealt in below */}
      <motion.div
        key={`q-${question.questionId}`}
        initial={
          prefersReducedMotion()
            ? { opacity: 0 }
            : { opacity: 0, y: -18, rotateX: 6 }
        }
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.45, ease: [0, 0, 0.2, 1] }}
        style={{ transformPerspective: 700 }}
        className="mt-6"
      >
        <h1 className="text-[24px] font-extrabold leading-snug tracking-tight">
          {question.text}
        </h1>
        {question.imageUrl && (
          <div className="mt-4 overflow-hidden rounded-card border border-border-soft">
            <Image
              src={question.imageUrl}
              alt="Question image"
              width={800}
              height={500}
              priority
              className="max-h-[220px] w-full object-contain bg-black/40"
            />
          </div>
        )}
      </motion.div>

      {/* Options */}
      <motion.div
        key={`opts-${question.questionId}`}
        variants={staggerParent(0.1, 0.15)}
        initial="hidden"
        animate="show"
        className="mt-6 flex-1"
      >
        {question.type === "true_false" ? (
          <div className="grid grid-cols-2 gap-3">
            {question.options.map((opt, i) => (
              <motion.button
                key={opt.id}
                variants={fadeUp}
                type="button"
                disabled={submitting}
                onClick={() => setSelection(i)}
                className={`rounded-card border py-8 text-[17px] font-extrabold uppercase tracking-wide transition-all duration-200 ${
                  selection === i
                    ? "scale-[1.02] border-brand-cyan bg-brand-cyan/15 text-brand-cyan"
                    : selection !== null
                      ? "border-border-soft bg-surface text-foreground/80 opacity-70"
                      : "border-border-soft bg-surface text-foreground/80"
                }`}
              >
                {opt.text}
              </motion.button>
            ))}
          </div>
        ) : isImageOptions ? (
          <div className="grid grid-cols-2 gap-3">
            {question.options.map((opt, i) => (
              <motion.button
                key={opt.id}
                variants={fadeUp}
                type="button"
                disabled={submitting}
                onClick={() => setSelection(i)}
                className={`overflow-hidden rounded-card border text-left transition-all duration-200 ${
                  selection === i
                    ? "scale-[1.02] border-brand-cyan bg-brand-cyan/10"
                    : selection !== null
                      ? "border-border-soft bg-surface opacity-70"
                      : "border-border-soft bg-surface"
                }`}
              >
                {opt.imageUrl && (
                  <Image
                    src={opt.imageUrl}
                    alt={opt.text ?? `Option ${LETTERS[i]}`}
                    width={300}
                    height={200}
                    className="h-24 w-full object-cover"
                  />
                )}
                <span className="block px-3 py-2 text-[13px] font-semibold">
                  <span className={selection === i ? "text-brand-cyan" : "text-foreground/50"}>
                    {LETTERS[i]}.
                  </span>{" "}
                  {opt.text}
                </span>
              </motion.button>
            ))}
          </div>
        ) : (
          // Full-width stack: these options are full sentences — a 2-col
          // grid makes them unreadable on a 390px viewport.
          <div className="flex flex-col gap-3">
            {question.options.map((opt, i) => (
              <motion.button
                key={opt.id}
                variants={fadeUp}
                type="button"
                disabled={submitting}
                onClick={() => setSelection(i)}
                className={`flex items-center gap-3 rounded-card border p-4 text-left text-[14px] font-semibold leading-snug transition-all duration-200 active:scale-[0.99] ${
                  selection === i
                    ? "border-brand-cyan bg-brand-cyan/12 shadow-[0_0_24px_rgba(5,177,222,0.18)]"
                    : selection !== null
                      ? "border-border-soft bg-surface opacity-60"
                      : "border-border-soft bg-surface"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-extrabold transition-colors duration-200 ${
                    selection === i
                      ? "border-brand-cyan bg-brand-cyan text-background"
                      : "border-border-soft text-foreground/40"
                  }`}
                >
                  {LETTERS[i]}
                </span>
                <span className="flex-1">{opt.text}</span>
              </motion.button>
            ))}
          </div>
        )}
      </motion.div>

      {/* Lock in */}
      <div className="sticky bottom-0 -mx-5 bg-background/90 px-5 pb-8 pt-3 backdrop-blur">
        <button
          type="button"
          disabled={selection === null || submitting}
          onClick={() => submit(selection)}
          className={`w-full rounded-card bg-gradient-to-r from-brand-cyan to-brand-purple py-4 text-[15px] font-bold text-background transition-opacity disabled:opacity-30 ${
            selection !== null && !submitting ? "sweep-in" : ""
          }`}
        >
          {submitting ? (
            <span className="dots" aria-label="Locking in">
              <span />
              <span />
              <span />
            </span>
          ) : selection === null ? (
            "Pick an answer"
          ) : (
            "Lock in answer"
          )}
        </button>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-grid flex-1">
      <div className="mx-auto flex min-h-dvh w-full max-w-[400px] flex-col px-5">
        {children}
      </div>
    </main>
  );
}
