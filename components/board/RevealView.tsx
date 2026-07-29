"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "@/lib/m";
import type { BoardState } from "@/lib/board/state";
import { easing, prefersReducedMotion } from "@/lib/motion";
import BoardAmbient, { BoardChrome } from "./BoardAmbient";

type RevealState = Extract<BoardState, { kind: "reveal" }>;

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
// The beat: black hold, then the truth hits the room.
const HOLD_MS = 200;

export default function RevealView({ state }: { state: RevealState }) {
  const params = useParams<{ sessionId: string }>();
  const [revealed, setRevealed] = useState(false);
  const { question, correctIndex, explanation, distribution, fastest } = state;

  useEffect(() => {
    const hold = prefersReducedMotion() ? 0 : HOLD_MS;
    const t = setTimeout(() => setRevealed(true), hold);
    return () => clearTimeout(t);
  }, []);

  const correctOption = question.options[correctIndex];
  const maxCount = Math.max(1, ...Object.values(distribution));
  const reduced = prefersReducedMotion();

  return (
    <div className="relative h-full w-full overflow-hidden">
      <BoardAmbient />
      <BoardChrome sessionId={params.sessionId ?? ""} />

      {/* Black hold that lifts at the reveal */}
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: revealed ? 0 : 1 }}
        transition={{ duration: 0.35 }}
        className="pointer-events-none absolute inset-0 z-40 bg-black"
      />
      {/* Cyan radial flash expanding from center */}
      {revealed && !reduced && (
        <motion.div
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 4, opacity: 0 }}
          transition={{ duration: 0.9, ease: easing.entrance }}
          className="pointer-events-none absolute left-1/2 top-1/2 z-30 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(5,177,222,0.35) 0%, transparent 70%)",
          }}
        />
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: revealed ? 1 : 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 flex h-full flex-col items-center justify-center px-24"
      >
        <p className="text-[26px] font-semibold text-foreground/40">
          Question {question.questionNumber} / {question.totalQuestions}
        </p>

        <motion.h1
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
          animate={revealed ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.5, ease: easing.overshoot, delay: 0.25 }}
          className="mt-4 text-center text-[96px] font-black leading-tight tracking-tight"
        >
          The correct answer was{" "}
          <span className="text-brand-cyan">
            {LETTERS[correctIndex]}: {correctOption?.text ?? ""}
          </span>
        </motion.h1>

        {explanation && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={revealed ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.45, delay: 0.7 }}
            className="mt-8 max-w-[1100px] rounded-card border border-brand-purple/25 bg-brand-purple/10 px-10 py-6"
          >
            <p className="text-center text-[40px] leading-relaxed text-foreground/75">
              {explanation}
            </p>
          </motion.div>
        )}

        {/* Final distribution, correct bar bright, wrong bars dimmed */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={revealed ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.9 }}
          className="mt-12 grid w-full max-w-[1300px] grid-cols-2 gap-x-10 gap-y-4"
        >
          {question.options.map((opt, i) => {
            const count = distribution[i] ?? 0;
            const isCorrect = i === correctIndex;
            return (
              <div
                key={opt.id}
                className={`flex items-center gap-4 ${isCorrect ? "" : "opacity-40"}`}
              >
                <span
                  className={`w-10 text-[28px] font-bold ${
                    isCorrect ? "text-brand-cyan" : "text-foreground/50"
                  }`}
                >
                  {isCorrect ? "✓" : LETTERS[i]}
                </span>
                <div className="h-7 flex-1 overflow-hidden rounded-full bg-white/5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={
                      revealed ? { width: `${(count / maxCount) * 100}%` } : {}
                    }
                    transition={{ type: "spring", stiffness: 100, damping: 20, delay: 1 }}
                    className={`h-full rounded-full ${
                      isCorrect ? "bg-brand-cyan" : "bg-white/25"
                    }`}
                  />
                </div>
                <span className="w-14 text-right text-[28px] font-bold text-foreground/70">
                  {count}
                </span>
              </div>
            );
          })}
        </motion.div>

        {/* Fastest-correct chip */}
        {fastest && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={revealed ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: 1.4 }}
            className="absolute bottom-10 right-12 rounded-card border border-award/30 bg-award/10 px-8 py-4"
          >
            <p className="text-[28px] font-semibold text-award">
              ⚡ Fastest correct: {fastest.name} in{" "}
              {(fastest.timeMs / 1000).toFixed(1)}s
            </p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
