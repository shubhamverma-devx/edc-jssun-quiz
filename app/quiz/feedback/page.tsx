"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion } from "@/lib/m";
import {
  countUp,
  easing,
  fadeUp,
  prefersReducedMotion,
  staggerParent,
} from "@/lib/motion";

type FeedbackPayload = {
  result: {
    isCorrect: boolean;
    pointsEarned: number;
    breakdown: { base: number; speedBonus: number; streakBonus: number };
    newScore: number;
    currentStreak: number;
    correctOptionIndex: number | null;
    explanation: string | null;
  };
  chosenOptionIndex: number | null;
  question: {
    text: string;
    type: string;
    options: { id: string; text: string | null; imageUrl: string | null }[];
    questionNumber: number;
    totalQuestions: number;
  };
  mode: "session_based" | "self_paced";
};

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const AUTO_CONTINUE_SECONDS = 4;
// The dramatic pause before the reveal.
const REVEAL_HOLD_MS = 100;

export default function FeedbackPage() {
  const router = useRouter();
  const [payload, setPayload] = useState<FeedbackPayload | null>(null);
  const [revealed, setRevealed] = useState(false);
  const scoreRef = useRef<HTMLSpanElement>(null);
  const totalRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("edc-quiz-feedback");
    if (!raw) {
      router.replace("/quiz");
      return;
    }
    try {
      // sessionStorage is client-only; can't be a useState initializer.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPayload(JSON.parse(raw));
    } catch {
      router.replace("/quiz");
    }
  }, [router]);

  // Hold black for a beat, then reveal.
  useEffect(() => {
    if (!payload) return;
    const hold = prefersReducedMotion() ? 0 : REVEAL_HOLD_MS;
    const t = setTimeout(() => setRevealed(true), hold);
    return () => clearTimeout(t);
  }, [payload]);

  // Numbers count up once revealed.
  useEffect(() => {
    if (!revealed || !payload) return;
    countUp(scoreRef.current, payload.result.newScore, {
      from: payload.result.newScore - payload.result.pointsEarned,
      duration: 0.9,
    });
    if (payload.result.isCorrect) {
      countUp(totalRef.current, payload.result.pointsEarned, {
        duration: 0.8,
        format: (v) => `+${v} points`,
      });
    }
  }, [revealed, payload]);

  // Auto-continue after the read time.
  useEffect(() => {
    if (!revealed) return;
    const t = setTimeout(
      () => router.replace("/quiz/interstitial"),
      AUTO_CONTINUE_SECONDS * 1000
    );
    return () => clearTimeout(t);
  }, [revealed, router]);

  if (!payload) return null;

  const { result, chosenOptionIndex, question } = payload;
  const variant: "correct" | "wrong" | "timeup" = result.isCorrect
    ? "correct"
    : chosenOptionIndex === null
      ? "timeup"
      : "wrong";

  const correctOption =
    result.correctOptionIndex !== null
      ? question.options[result.correctOptionIndex]
      : null;

  const theme = {
    correct: {
      wash: "from-brand-cyan/25",
      heading: "CORRECT",
      headingColor: "text-brand-cyan",
      flash: "rgba(5,177,222,0.28)",
    },
    wrong: {
      wash: "from-red-500/15",
      heading: "WRONG",
      headingColor: "text-red-400",
      flash: "rgba(255,75,75,0.16)",
    },
    timeup: {
      wash: "from-award/20",
      heading: "TIME'S UP",
      headingColor: "text-award",
      flash: "rgba(247,203,72,0.2)",
    },
  }[variant];

  const reduced = prefersReducedMotion();

  return (
    <main className="flex-1">
      {/* Black hold that lifts at the reveal */}
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: revealed ? 0 : 1 }}
        transition={{ duration: reduced ? 0.2 : 0.3 }}
        className="pointer-events-none fixed inset-0 z-50 bg-black"
      />
      {/* Radial flash sweeping outward from center at reveal */}
      {revealed && !reduced && (
        <motion.div
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 3, opacity: 0 }}
          transition={{ duration: 0.7, ease: easing.entrance }}
          className="pointer-events-none fixed left-1/2 top-1/3 z-40 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: `radial-gradient(circle, ${theme.flash} 0%, transparent 70%)`,
          }}
        />
      )}

      <div
        className={`min-h-dvh bg-gradient-to-b ${theme.wash} via-background to-background`}
      >
        <motion.div
          variants={staggerParent(0.12, 0.05)}
          initial="hidden"
          animate={revealed ? "show" : "hidden"}
          className="mx-auto flex min-h-dvh w-full max-w-[400px] flex-col px-5 pb-10 pt-16"
        >
          <motion.p
            variants={fadeUp}
            className="text-[12px] font-semibold text-foreground/40"
          >
            Question {question.questionNumber} / {question.totalQuestions}
          </motion.p>

          <motion.div
            variants={{
              hidden: { opacity: 0, scale: reduced ? 1 : 0.7 },
              show: {
                opacity: 1,
                scale: 1,
                transition: { duration: 0.45, ease: easing.overshoot },
              },
            }}
            className="mt-2 flex items-center gap-3"
          >
            <ResultMark variant={variant} animate={revealed && !reduced} />
            <h1
              className={`text-[34px] font-black tracking-tight ${theme.headingColor}`}
            >
              {theme.heading}
            </h1>
          </motion.div>

          {variant === "correct" ? (
            <>
              <motion.div
                variants={fadeUp}
                className="mt-6 rounded-card border border-border-soft bg-surface p-5"
              >
                <motion.div variants={staggerParent(0.15, 0.2)} initial="hidden" animate={revealed ? "show" : "hidden"}>
                  <motion.div variants={fadeUp}>
                    <Row label="Base" value={`+${result.breakdown.base}`} />
                  </motion.div>
                  {result.breakdown.speedBonus > 0 && (
                    <motion.div variants={fadeUp}>
                      <Row
                        label="Speed bonus"
                        value={`+${result.breakdown.speedBonus}`}
                      />
                    </motion.div>
                  )}
                  {result.breakdown.streakBonus > 0 && (
                    <motion.div variants={fadeUp}>
                      <Row
                        label={
                          <>
                            Streak{" "}
                            <span className="flame-flicker">🔥</span> x
                            {result.currentStreak}
                          </>
                        }
                        value={`+${result.breakdown.streakBonus}`}
                      />
                    </motion.div>
                  )}
                  <motion.div
                    variants={fadeUp}
                    className="mt-3 border-t border-border-soft pt-3"
                  >
                    <div className="flex items-center justify-between py-1">
                      <span className="text-[13px] font-bold">Total</span>
                      <span
                        ref={totalRef}
                        className="text-[14px] font-bold text-brand-cyan"
                      >
                        +{result.pointsEarned} points
                      </span>
                    </div>
                  </motion.div>
                </motion.div>
              </motion.div>
              {result.currentStreak >= 2 && (
                <motion.p
                  variants={fadeUp}
                  className="mt-4 text-center text-[14px] font-bold text-award"
                >
                  <span className="flame-flicker">🔥</span>{" "}
                  {result.currentStreak} in a row!
                </motion.p>
              )}
            </>
          ) : (
            <motion.div
              variants={fadeUp}
              className="mt-6 rounded-card border border-border-soft bg-surface p-5"
            >
              {correctOption && (
                <p className="text-[14px] leading-relaxed">
                  <span className="text-foreground/50">The correct answer was: </span>
                  <motion.span
                    initial={reduced ? false : { backgroundColor: "rgba(5,177,222,0)" }}
                    animate={{
                      backgroundColor: [
                        "rgba(5,177,222,0)",
                        "rgba(5,177,222,0.18)",
                        "rgba(5,177,222,0)",
                      ],
                    }}
                    transition={{ duration: 1.4, delay: 0.7 }}
                    className="rounded px-1 font-bold"
                  >
                    {LETTERS[result.correctOptionIndex ?? 0]}.{" "}
                    {correctOption.text ?? "(image option)"}
                  </motion.span>
                </p>
              )}
              {variant === "wrong" && (
                <p className="mt-3 text-[13px] text-foreground/50">
                  {result.currentStreak === 0 && "Streak broken."}
                </p>
              )}
            </motion.div>
          )}

          {result.explanation && (
            <motion.div
              variants={fadeUp}
              className="mt-4 rounded-card border border-brand-purple/25 bg-brand-purple/10 p-4"
            >
              <p className="text-[12px] font-bold uppercase tracking-[0.15em] text-brand-purple">
                Why
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-foreground/80">
                {result.explanation}
              </p>
            </motion.div>
          )}

          <motion.p
            variants={fadeUp}
            className="mt-6 text-center text-lg font-extrabold"
          >
            Score:{" "}
            <span ref={scoreRef} className="text-brand-cyan">
              {result.newScore}
            </span>
          </motion.p>

          <motion.div variants={fadeUp} className="mt-auto pt-10">
            <button
              type="button"
              onClick={() => router.replace("/quiz/interstitial")}
              className="relative w-full overflow-hidden rounded-card border border-border-soft bg-surface py-4 text-[14px] font-bold text-foreground/80"
            >
              Continue
              {/* Auto-continue countdown bar */}
              {revealed && (
                <motion.span
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{
                    duration: AUTO_CONTINUE_SECONDS,
                    ease: "linear",
                  }}
                  className="absolute bottom-0 left-0 h-0.5 w-full origin-left bg-brand-cyan"
                />
              )}
            </button>
          </motion.div>
        </motion.div>
      </div>
    </main>
  );
}

/** Self-drawing ✓ / ✗ / ⏱ mark. */
function ResultMark({
  variant,
  animate,
}: {
  variant: "correct" | "wrong" | "timeup";
  animate: boolean;
}) {
  const stroke =
    variant === "correct" ? "#05b1de" : variant === "wrong" ? "#ff4b4b" : "#f7cb48";
  const paths = {
    correct: ["M10 22 L18 30 L32 12"],
    wrong: ["M12 12 L30 30", "M30 12 L12 30"],
    timeup: ["M21 10 L21 22 L29 26", "M21 4 A17 17 0 1 1 20.9 4"],
  }[variant];

  return (
    <svg viewBox="0 0 42 42" className="h-10 w-10 shrink-0">
      {paths.map((d, i) => (
        <motion.path
          key={i}
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth="4"
          strokeLinecap="round"
          initial={animate ? { pathLength: 0 } : { pathLength: 1 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: 0.15 + i * 0.15, ease: [0, 0, 0.2, 1] }}
        />
      ))}
    </svg>
  );
}

function Row({
  label,
  value,
}: {
  label: React.ReactNode;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[13px] text-foreground/60">{label}</span>
      <span className="text-[14px] font-bold">{value}</span>
    </div>
  );
}
