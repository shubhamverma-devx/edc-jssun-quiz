"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion } from "@/lib/m";
import { createClient } from "@/lib/supabase/client";
import { countUp, fadeDown, fadeUp, staggerParent, useEntranceInitial } from "@/lib/motion";

/** Score that counts up from 0 when the row lands. */
function CountedScore({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    countUp(ref.current, value, { duration: 0.8 });
  }, [value]);
  return (
    <span ref={ref} className="text-[14px] font-extrabold text-brand-cyan">
      {value}
    </span>
  );
}

type LeaderboardEntry = {
  participantId: string;
  name: string;
  photoUrl: string | null;
  score: number;
  rank: number;
};

type Leaderboard = {
  top: LeaderboardEntry[];
  you: { rank: number; score: number } | null;
  totalParticipants: number;
};

const SELF_PACED_COUNTDOWN = 3;

export default function InterstitialPage() {
  const router = useRouter();
  const entrance = useEntranceInitial();
  const [ids, setIds] = useState<{ pid: string; sid: string } | null>(null);
  const [mode, setMode] = useState<"session_based" | "self_paced">("session_based");
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [countdown, setCountdown] = useState(SELF_PACED_COUNTDOWN);
  const lastIndexRef = useRef<number | null>(null);

  useEffect(() => {
    const pid = sessionStorage.getItem("edc-quiz-participant-id");
    const sid = sessionStorage.getItem("edc-quiz-session-id");
    if (!pid || !sid) {
      router.replace("/");
      return;
    }
    // sessionStorage is client-only; can't be a useState initializer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIds({ pid, sid });
    const storedMode = sessionStorage.getItem("edc-quiz-mode");
    if (storedMode === "self_paced") setMode("self_paced");
  }, [router]);

  // Leaderboard fetch.
  useEffect(() => {
    if (!ids) return;
    fetch(`/api/quiz/leaderboard?sessionId=${ids.sid}&participantId=${ids.pid}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.top) setBoard(data);
      })
      .catch(() => {});
  }, [ids]);

  // Self-paced: short countdown then next question.
  useEffect(() => {
    if (!ids || mode !== "self_paced") return;
    const started = Date.now();
    const tick = setInterval(() => {
      const left =
        SELF_PACED_COUNTDOWN - Math.floor((Date.now() - started) / 1000);
      setCountdown(Math.max(0, left));
      if (left <= 0) {
        clearInterval(tick);
        router.replace("/quiz"); // /quiz routes to /result when out of questions
      }
    }, 250);
    return () => clearInterval(tick);
  }, [ids, mode, router]);

  // Session-based: realtime advance/end + one safety check on mount in case
  // the host advanced while we were on the feedback screen.
  useEffect(() => {
    if (!ids || mode !== "session_based") return;

    fetch(`/api/quiz/current?sessionId=${ids.sid}&participantId=${ids.pid}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.finished) router.replace("/result");
        else if (data.questionId && !data.alreadyAnswered) router.replace("/quiz");
      })
      .catch(() => {});

    const supabase = createClient();
    const channel = supabase
      .channel(`interstitial-${ids.sid}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${ids.sid}` },
        (payload) => {
          const s = payload.new as { status: string; current_question_index: number | null };
          if (s.status === "ended") {
            router.replace("/result");
            return;
          }
          if (
            s.current_question_index !== null &&
            s.current_question_index !== lastIndexRef.current
          ) {
            lastIndexRef.current = s.current_question_index;
            router.replace("/quiz");
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [ids, mode, router]);

  if (!ids) return null;

  const inTop5 = board?.you && board.you.rank <= 5;

  return (
    <main className="bg-grid flex-1">
      <div className="mx-auto flex min-h-dvh w-full max-w-[400px] flex-col px-5 pb-10 pt-14">
        <motion.p
          variants={fadeDown}
          initial={entrance}
          animate="show"
          className="text-[11px] font-bold uppercase tracking-[0.25em] text-foreground/40"
        >
          Leaderboard
        </motion.p>

        <motion.div
          variants={staggerParent(0.09, 0.1)}
          initial={entrance}
          animate={board ? "show" : "hidden"}
          className="mt-5 space-y-2.5"
        >
          {(board?.top.slice(0, 5) ?? []).map((entry) => (
            <motion.div
              key={entry.participantId}
              variants={fadeUp}
              className={`flex items-center gap-3 rounded-card border p-3 ${
                entry.participantId === ids.pid
                  ? "glow-pulse border-brand-cyan/50 bg-brand-cyan/10"
                  : "border-border-soft bg-surface"
              }`}
            >
              <span
                className={`w-6 text-center text-[14px] font-extrabold ${
                  entry.rank <= 3 ? "text-award" : "text-foreground/40"
                }`}
              >
                {entry.rank}
              </span>
              {entry.photoUrl ? (
                <Image
                  src={entry.photoUrl}
                  alt={entry.name}
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface text-sm font-bold text-brand-purple">
                  {entry.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="flex-1 truncate text-[14px] font-semibold">
                {entry.name}
              </span>
              <CountedScore value={entry.score} />
            </motion.div>
          ))}
          {!board && (
            <p className="py-8 text-center text-[13px] text-foreground/40">
              Loading standings…
            </p>
          )}
        </motion.div>

        {board?.you && !inTop5 && (
          <p className="mt-5 text-center text-[14px] font-semibold text-foreground/70">
            You&apos;re{" "}
            <span className="font-extrabold text-brand-cyan">
              #{board.you.rank}
            </span>{" "}
            out of {board.totalParticipants}
          </p>
        )}

        <div className="mt-auto pt-10 text-center">
          {mode === "self_paced" ? (
            <p className="text-[14px] font-semibold text-foreground/60">
              Next question in{" "}
              <motion.span
                key={countdown}
                initial={{ scale: 1.35 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
                className="inline-block text-xl font-extrabold text-brand-cyan"
              >
                {countdown}
              </motion.span>
              …
            </p>
          ) : (
            <p className="text-[13px] text-foreground/50">
              Next question when the host advances
              <span className="dots ml-1 inline-flex align-baseline">
                <span />
                <span />
                <span />
              </span>
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
