"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "@/lib/m";
import type { BoardState } from "@/lib/board/state";
import { sfx } from "@/lib/board/sound";
import { fadeUp, prefersReducedMotion, staggerParent } from "@/lib/motion";
import BoardAmbient, { BoardChrome } from "./BoardAmbient";

type QuestionState = Extract<BoardState, { kind: "question" }>;

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
// Alternating option accents — projection-legible, on-palette.
const ACCENTS = ["text-brand-cyan", "text-brand-purple", "text-brand-cyan", "text-brand-purple"];

export default function QuestionView({ state }: { state: QuestionState }) {
  const params = useParams<{ sessionId: string }>();
  const { question, distribution, totalAnswered } = state;
  const [remainingMs, setRemainingMs] = useState(question.timeSeconds * 1000);

  // Drift-free shared timer: derived from the session's advance timestamp,
  // so the board and every phone tick down together.
  useEffect(() => {
    const totalMs = question.timeSeconds * 1000;
    const tick = setInterval(() => {
      setRemainingMs(
        Math.max(0, totalMs - (Date.now() - question.startedAt))
      );
    }, 100);
    return () => clearInterval(tick);
  }, [question.startedAt, question.timeSeconds]);

  const fraction =
    question.timeSeconds > 0
      ? remainingMs / (question.timeSeconds * 1000)
      : 0;
  const timerColor =
    fraction > 0.5 ? "#05b1de" : fraction > 0.2 ? "#f7cb48" : "#ff4b4b";
  const maxCount = Math.max(1, ...Object.values(distribution));
  const secondsLeft = Math.ceil(remainingMs / 1000);

  // Last-5-seconds clock tick.
  useEffect(() => {
    if (secondsLeft <= 5 && secondsLeft > 0) sfx("tick");
  }, [secondsLeft]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <BoardAmbient />
      <BoardChrome sessionId={params.sessionId ?? ""} count={state.count} />

      {/* Full-width timer bar */}
      <div className="absolute inset-x-0 top-0 z-20 h-2 bg-white/5">
        <div
          className={`h-full origin-left ${fraction <= 0.2 ? "animate-pulse" : ""}`}
          style={{
            width: `${fraction * 100}%`,
            backgroundColor: timerColor,
            transition: "width 100ms linear, background-color 500ms ease",
          }}
        />
      </div>

      <div className="absolute left-10 top-24 z-10 text-[24px] font-semibold text-foreground/40">
        Question {question.questionNumber} / {question.totalQuestions}
      </div>

      {/* Big countdown — punches every second once it matters */}
      <div className="absolute right-12 top-20 z-10 flex h-28 w-28 items-center justify-center">
        <motion.span
          key={secondsLeft}
          initial={
            prefersReducedMotion() || secondsLeft > 5
              ? false
              : { scale: 1.5 }
          }
          animate={{ scale: 1 }}
          transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
          className={`text-[84px] font-black tabular-nums ${
            secondsLeft <= 5 ? "animate-pulse" : ""
          }`}
          style={{ color: timerColor, transition: "color 500ms ease" }}
        >
          {secondsLeft}
        </motion.span>
      </div>

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-24 pt-10">
        {/* Question card — placed from above with a slight tilt */}
        <motion.div
          initial={
            prefersReducedMotion()
              ? { opacity: 0 }
              : { opacity: 0, y: -40, rotateX: 8 }
          }
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 0.5, ease: [0, 0, 0.2, 1] }}
          style={{ transformPerspective: 1200 }}
          className="flex w-full max-w-[1500px] flex-col items-center"
        >
          {question.imageUrl && (
            <div className="mb-8 overflow-hidden rounded-card border-2 border-brand-cyan/40">
              <Image
                src={question.imageUrl}
                alt="Question image"
                width={900}
                height={500}
                priority
                className="max-h-[380px] w-auto object-contain"
              />
            </div>
          )}
          <h1
            className={`text-center font-extrabold leading-tight tracking-tight ${
              question.imageUrl ? "text-[64px]" : "text-[84px]"
            }`}
          >
            {question.text}
          </h1>
        </motion.div>

        {/* Options — dealt in below */}
        <motion.div
          variants={staggerParent(0.1, 0.35)}
          initial="hidden"
          animate="show"
          className={`mt-12 grid w-full max-w-[1400px] gap-6 ${
            question.options.length === 2 ? "grid-cols-2" : "grid-cols-2"
          }`}
        >
          {question.options.map((opt, i) => (
            <motion.div
              key={opt.id}
              variants={fadeUp}
              className="flex items-center gap-6 rounded-card border border-border-soft bg-surface px-8 py-6"
            >
              <span className={`text-[48px] font-black ${ACCENTS[i % 4]}`}>
                {LETTERS[i]}
              </span>
              <span className="text-[44px] font-semibold leading-snug">
                {opt.text}
              </span>
            </motion.div>
          ))}
        </motion.div>

        {/* Live distribution bars */}
        <div className="mt-10 w-full max-w-[1400px]">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[22px] font-semibold uppercase tracking-[0.2em] text-foreground/40">
              Live answers
            </p>
            <p className="text-[24px] font-bold text-foreground/60">
              {totalAnswered} answered
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-10 gap-y-3">
            {question.options.map((opt, i) => {
              const count = distribution[i] ?? 0;
              return (
                <div key={opt.id} className="flex items-center gap-4">
                  <span className="w-8 text-[26px] font-bold text-foreground/50">
                    {LETTERS[i]}
                  </span>
                  <div className="h-6 flex-1 overflow-hidden rounded-full bg-white/5">
                    <motion.div
                      animate={{ width: `${(count / maxCount) * 100}%` }}
                      transition={{ type: "spring", stiffness: 120, damping: 20 }}
                      className="h-full rounded-full bg-brand-cyan/70"
                    />
                  </div>
                  <span className="w-12 text-right text-[26px] font-bold text-foreground/70">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
