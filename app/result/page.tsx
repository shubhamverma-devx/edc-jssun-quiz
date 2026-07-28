"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "@/lib/m";
import gsap from "gsap";
import { createClient } from "@/lib/supabase/client";
import {
  countUp,
  fadeUp,
  prefersReducedMotion,
  staggerParent,
  useEntranceInitial,
} from "@/lib/motion";

type Stats = {
  rank: number;
  totalParticipants: number;
  name: string;
  photoUrl: string | null;
  score: number;
  correctCount: number;
  totalQuestions: number;
  maxStreak: number;
  avgResponseMs: number | null;
};

const MEDALS = ["🥇", "🥈", "🥉"];
const PLACES = ["1st place", "2nd place", "3rd place"];
const CONFETTI_COLORS = ["#f7cb48", "#05b1de", "#b585f0", "#4ade80"];
const BURST_COLORS = ["#f7cb48", "#b585f0", "#05b1de"];

export default function ResultPage() {
  const router = useRouter();
  const entrance = useEntranceInitial();
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);
  const [shared, setShared] = useState(false);
  const [contact, setContact] = useState<{ email: string; phone: string } | null>(
    null
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const burstRef = useRef<HTMLDivElement>(null);
  const scoreRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const pid = sessionStorage.getItem("edc-quiz-participant-id");
    const sid = sessionStorage.getItem("edc-quiz-session-id");
    if (!pid || !sid) {
      router.replace("/");
      return;
    }
    const email = sessionStorage.getItem("edc-quiz-email");
    const phone = sessionStorage.getItem("edc-quiz-phone");
    if (email && phone) {
      // sessionStorage is client-only; can't be a useState initializer.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setContact({ email, phone });
    }

    async function load(participantId: string, sessionId: string) {
      try {
        const supabase = createClient();
        const [lbRes, meRes, answersRes, questionsRes] = await Promise.all([
          fetch(
            `/api/quiz/leaderboard?sessionId=${sessionId}&participantId=${participantId}`
          ).then((r) => r.json()),
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
        if (!me || !lbRes?.you) throw new Error("missing data");

        const times = (answersRes.data ?? []).map((a) => a.response_time_ms);
        setStats({
          rank: lbRes.you.rank,
          totalParticipants: lbRes.totalParticipants,
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

  const isWinner = stats !== null && stats.rank <= 3;
  const reduced = prefersReducedMotion();

  /** Physics-ish burst: 40 particles fan upward from the badge, then fall. */
  function burst() {
    const host = burstRef.current;
    if (!host) return;
    for (let i = 0; i < 40; i++) {
      const p = document.createElement("span");
      const size = 5 + Math.random() * 6;
      p.style.cssText = `position:absolute;left:50%;top:0;width:${size}px;height:${size * 0.62}px;border-radius:2px;background:${BURST_COLORS[i % BURST_COLORS.length]};will-change:transform;`;
      host.appendChild(p);
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
      const velocity = 220 + Math.random() * 260;
      const vx = Math.cos(angle) * velocity;
      const vy = Math.sin(angle) * velocity;
      const drift = (Math.random() - 0.5) * 60;
      gsap.to(p, {
        duration: 2.2 + Math.random(),
        ease: "none",
        rotation: (Math.random() - 0.5) * 720,
        opacity: 0,
        onComplete: () => p.remove(),
        keyframes: [
          { x: vx * 0.35, y: vy * 0.35, duration: 0.35, ease: "power2.out" },
          {
            x: vx * 0.35 + drift,
            y: 480,
            duration: 1.85 + Math.random(),
            ease: "power1.in",
          },
        ],
      });
    }
  }

  // Winner reveal choreography — the moment of the whole app.
  useLayoutEffect(() => {
    if (!stats || !isWinner || reduced) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: 0.4 }); // pre-reveal black hold
      tl.to(".wr-black", { opacity: 0, duration: 0.35 })
        .fromTo(
          ".wr-badge",
          { scale: 0, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.7, ease: "back.out(1.8)" },
          "<"
        )
        .fromTo(
          ".wr-glow",
          { scale: 0.2, opacity: 0 },
          { scale: 1.6, opacity: 1, duration: 0.9, ease: "power2.out" },
          "<"
        )
        .add(() => burst(), "<0.25")
        .from(
          ".wr-place",
          { opacity: 0, y: 8, duration: 0.4 },
          ">-0.3"
        )
        .from(".wr-letter", {
          y: -46,
          opacity: 0,
          rotation: (i) => (i % 2 === 0 ? -9 : 9),
          duration: 0.5,
          stagger: 0.05,
          ease: "back.out(1.6)",
        })
        .from(".wr-sub", { opacity: 0, y: 8, duration: 0.4 }, ">-0.1")
        .from(
          ".wr-stats",
          { opacity: 0, x: -28, duration: 0.5, ease: "power2.out" },
          ">-0.05"
        )
        .add(() => {
          countUp(scoreRef.current, stats.score, { duration: 1 });
        }, "<0.1")
        .from(".wr-card", {
          opacity: 0,
          y: 24,
          rotation: -1.2,
          duration: 0.5,
          ease: "power2.out",
        })
        .fromTo(
          ".wr-underline",
          { scaleX: 0 },
          { scaleX: 1, duration: 0.4, stagger: 0.15, ease: "power1.out" }
        )
        .from(".wr-share", { opacity: 0, y: 10, duration: 0.4 });
    }, rootRef);
    return () => ctx.revert();
  }, [stats, isWinner, reduced]);

  // Deterministic index-derived "randomness" — pure (render-safe) and
  // identical on server and client, so no hydration mismatch.
  const confetti = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        id: i,
        left: (i * 61) % 100,
        delay: ((i * 37) % 25) / 10,
        duration: 2.5 + ((i * 17) % 20) / 10,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 6 + ((i * 29) % 6),
      })),
    []
  );

  async function share(text: string) {
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        setShared(true);
      }
    } catch {
      // user dismissed the share sheet — nothing to do
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

  if (isWinner) {
    return (
      <main ref={rootRef} className="flex-1">
        <div className="relative min-h-dvh overflow-hidden bg-gradient-to-b from-award/15 via-background to-brand-purple/10">
          {/* pre-reveal black hold (GSAP lifts it) */}
          {!reduced && (
            <div className="wr-black pointer-events-none fixed inset-0 z-50 bg-black" />
          )}

          {confetti.map((c) => (
            <span
              key={c.id}
              className="confetti-piece"
              style={{
                left: `${c.left}%`,
                width: c.size,
                height: c.size * 0.6,
                backgroundColor: c.color,
                animationDelay: `${c.delay}s`,
                animationDuration: `${c.duration}s`,
              }}
            />
          ))}

          <div className="mx-auto flex min-h-dvh w-full max-w-[400px] flex-col px-5 pb-10 pt-16">
            <div className="relative text-center">
              {/* expanding glow behind the badge */}
              <div
                className="wr-glow pointer-events-none absolute left-1/2 top-2 h-40 w-40 -translate-x-1/2 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle, rgba(5,177,222,0.25) 0%, rgba(181,133,240,0.18) 45%, transparent 70%)",
                }}
              />
              {/* burst particle host, anchored at the badge */}
              <div
                ref={burstRef}
                aria-hidden
                className="pointer-events-none absolute left-0 right-0 top-8 z-10"
              />
              <p className="wr-badge relative text-6xl">
                {MEDALS[stats.rank - 1]}
              </p>
              <p className="wr-place mt-2 text-[13px] font-bold uppercase tracking-[0.25em] text-award">
                {PLACES[stats.rank - 1]}
              </p>
              <h1
                aria-label="You're in"
                className="mt-4 text-[44px] font-black leading-none tracking-tight"
              >
                {"YOU'RE".split("").map((ch, i) => (
                  <span key={i} aria-hidden className="wr-letter inline-block">
                    {ch}
                  </span>
                ))}
                <span aria-hidden className="inline-block w-3" />
                {"IN".split("").map((ch, i) => (
                  <span
                    key={`in-${i}`}
                    aria-hidden
                    className="wr-letter inline-block bg-gradient-to-r from-award to-brand-cyan bg-clip-text text-transparent"
                  >
                    {ch}
                  </span>
                ))}
              </h1>
              <p className="wr-sub mt-3 text-[14px] leading-relaxed text-foreground/70">
                Direct entry to the EDC personal interview round
              </p>
            </div>

            <div className="wr-stats mt-8 rounded-card border border-award/30 bg-award/5 p-5">
              <div className="grid grid-cols-2 gap-x-4 gap-y-5 text-center">
                <Stat
                  label="Final rank"
                  value={`#${stats.rank}`}
                  sub={`of ${stats.totalParticipants}`}
                  gold
                />
                <div>
                  <p ref={scoreRef} className="text-[22px] font-extrabold text-award">
                    {stats.score}
                  </p>
                  <p className="mt-0.5 text-[11px] font-medium text-foreground/45">
                    Score
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
            </div>

            <div className="wr-card mt-4 rounded-card border border-border-soft bg-surface p-4">
              <p className="text-[13px] leading-relaxed text-foreground/75">
                {contact ? (
                  <>
                    The EDC team will reach out to you at{" "}
                    <span className="relative inline-block font-bold text-foreground">
                      {contact.email}
                      <span className="wr-underline absolute -bottom-0.5 left-0 h-px w-full origin-left bg-brand-cyan" />
                    </span>{" "}
                    and{" "}
                    <span className="relative inline-block font-bold text-foreground">
                      {contact.phone}
                      <span className="wr-underline absolute -bottom-0.5 left-0 h-px w-full origin-left bg-brand-cyan" />
                    </span>{" "}
                    within 48 hours.
                  </>
                ) : (
                  "The EDC team will reach out via email or phone within 48 hours."
                )}
              </p>
              <p className="mt-2 text-[13px] leading-relaxed text-foreground/75">
                Show this screen at the interview to confirm your entry.
              </p>
            </div>

            <div className="wr-share mt-auto pt-8">
              <button
                type="button"
                onClick={() =>
                  share(
                    `I just won direct entry to EDC's interview! ${MEDALS[stats.rank - 1]} #${stats.rank} in the EDC Orientation Quiz with ${stats.score} points.`
                  )
                }
                className="shimmer w-full rounded-card bg-gradient-to-r from-award via-brand-cyan to-award py-4 text-[14px] font-bold text-background"
              >
                {shared ? "Copied to clipboard ✓" : "Share your result"}
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Regular finish
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
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 text-center">
            <Stat
              label="Final rank"
              value={`#${stats.rank}`}
              sub={`of ${stats.totalParticipants}`}
            />
            <div>
              <p ref={scoreRef} className="text-[22px] font-extrabold">
                <CountOnMount value={stats.score} />
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-foreground/45">
                Score
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

        <motion.p
          variants={fadeUp}
          className="mt-5 text-center text-[13px] text-foreground/50"
        >
          Thanks for playing — see you at EDC events all year.
        </motion.p>

        <motion.div variants={fadeUp} className="mt-auto pt-8">
          <button
            type="button"
            onClick={() =>
              share(
                `I scored ${stats.score} in the EDC Orientation Quiz! Ranked #${stats.rank} of ${stats.totalParticipants}.`
              )
            }
            className="w-full rounded-card border border-border-soft bg-surface py-4 text-[14px] font-bold text-foreground/80"
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
    <div>
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
