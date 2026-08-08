"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion } from "@/lib/m";
import { createClient } from "@/lib/supabase/client";
import {
  countUp,
  fadeUp,
  staggerParent,
  useEntranceInitial,
} from "@/lib/motion";

type Stats = {
  name: string;
  photoUrl: string | null;
  score: number;
  correctCount: number;
  totalQuestions: number;
  maxStreak: number;
  avgResponseMs: number | null;
};

export default function ResultPage() {
  const router = useRouter();
  const entrance = useEntranceInitial();
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);
  const [shared, setShared] = useState(false);
  const scoreRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const pid = sessionStorage.getItem("edc-quiz-participant-id");
    const sid = sessionStorage.getItem("edc-quiz-session-id");
    if (!pid || !sid) {
      router.replace("/");
      return;
    }

    async function load(participantId: string, sessionId: string) {
      try {
        const supabase = createClient();
        const [meRes, answersRes, questionsRes] = await Promise.all([
          supabase
            .from("participants")
            .select("name, photo_url, score, correct_count, max_streak")
            .eq("id", participantId)
            .maybeSingle(),
          supabase
            .from("answers")
            .select("response_time_ms")
            .eq("participant_id", participantId),
          supabase.from("questions").select("id").eq("session_id", sessionId),
        ]);

        const me = meRes.data;
        if (!me) throw new Error("missing data");

        const times = (answersRes.data ?? []).map((a) => a.response_time_ms);
        setStats({
          name: me.name,
          photoUrl: me.photo_url,
          score: me.score,
          correctCount: me.correct_count,
          totalQuestions: (questionsRes.data ?? []).length,
          maxStreak: me.max_streak,
          avgResponseMs:
            times.length > 0
              ? times.reduce((a, b) => a + b, 0) / times.length
              : null,
        });
      } catch {
        setFailed(true);
      }
    }
    load(pid, sid);
  }, [router]);

  async function share(text: string) {
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        setShared(true);
      }
    } catch {
      // user dismissed the share sheet
    }
  }

  if (failed) {
    return (
      <main className="bg-grid flex-1">
        <div className="mx-auto flex min-h-dvh w-full max-w-[400px] flex-col items-center justify-center px-5">
          <p className="text-[14px] text-foreground/60">
            Couldn&apos;t load your result. Pull to refresh or re-open the link.
          </p>
        </div>
      </main>
    );
  }

  if (!stats) {
    return (
      <main className="bg-grid flex-1">
        <div className="mx-auto flex min-h-dvh w-full max-w-[400px] flex-col items-center justify-center px-5">
          <p className="animate-pulse text-[13px] text-foreground/40">
            Crunching the final numbers…
          </p>
        </div>
      </main>
    );
  }

  const accuracy =
    stats.totalQuestions > 0
      ? Math.round((stats.correctCount / stats.totalQuestions) * 100)
      : 0;

  return (
    <main className="bg-grid flex-1">
      <motion.div
        variants={staggerParent(0.1, 0.05)}
        initial={entrance}
        animate="show"
        className="mx-auto flex min-h-dvh w-full max-w-[400px] flex-col px-5 pb-10 pt-16"
      >
        <motion.div variants={fadeUp} className="text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.25em] text-foreground/40">
            Quiz complete
          </p>
          <h1 className="mt-3 text-[34px] font-black tracking-tight">
            Well played, {stats.name.split(" ")[0]}
          </h1>
        </motion.div>

        <motion.div
          variants={fadeUp}
          className="mt-8 rounded-card border border-border-soft bg-surface p-5"
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 text-center items-center">
            <div className="col-span-2 pb-2">
              <p ref={scoreRef} className="text-[44px] font-extrabold text-brand-cyan">
                <CountOnMount value={stats.score} />
              </p>
              <p className="mt-0.5 text-[12px] font-bold uppercase tracking-[0.1em] text-brand-cyan/70">
                Total Score
              </p>
            </div>
            <Stat
              label="Correct"
              value={`${stats.correctCount} / ${stats.totalQuestions}`}
            />
            <Stat label="Accuracy" value={`${accuracy}%`} />
            <Stat
              label="Max streak"
              value={<><span className="flame-flicker">🔥</span> {stats.maxStreak}</>}
            />
            <Stat
              label="Avg response"
              value={
                stats.avgResponseMs !== null
                  ? `${(stats.avgResponseMs / 1000).toFixed(1)}s`
                  : "—"
              }
            />
          </div>
        </motion.div>

        <motion.div variants={fadeUp} className="mt-auto pt-8">
          <button
            type="button"
            onClick={() =>
              share(
                `I scored ${stats.score} points in the EDC Orientation Quiz!`
              )
            }
            className="w-full rounded-card border border-brand-cyan/40 bg-brand-cyan/15 py-4 text-[14px] font-bold text-brand-cyan transition-colors hover:bg-brand-cyan/20"
          >
            {shared ? "Copied to clipboard ✓" : "Share your result"}
          </button>
        </motion.div>
      </motion.div>
    </main>
  );
}

function CountOnMount({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    countUp(ref.current, value, { duration: 1 });
  }, [value]);
  return <span ref={ref}>{value}</span>;
}

function Stat({
  label,
  value,
  sub,
  gold = false,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  gold?: boolean;
}) {
  return (
    <div className="flex flex-col justify-center h-full">
      <p
        className={`text-[22px] font-extrabold ${gold ? "text-award" : "text-foreground"}`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] font-medium text-foreground/45">
        {label}
        {sub ? ` · ${sub}` : ""}
      </p>
    </div>
  );
}
