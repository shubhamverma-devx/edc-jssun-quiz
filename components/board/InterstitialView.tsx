"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { motion } from "@/lib/m";
import type { BoardState } from "@/lib/board/state";
import { countUp } from "@/lib/motion";
import BoardAmbient, { BoardChrome } from "./BoardAmbient";

type InterstitialState = Extract<BoardState, { kind: "interstitial" }>;

type Row = {
  participantId: string;
  name: string;
  photoUrl: string | null;
  score: number;
  rank: number;
};

function CountedScore({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    countUp(ref.current, value, { duration: 1 });
  }, [value]);
  return (
    <span
      ref={ref}
      className="bg-gradient-to-r from-brand-cyan to-brand-purple bg-clip-text text-[52px] font-black text-transparent"
    >
      {value}
    </span>
  );
}

export default function InterstitialView({
  state,
}: {
  state: InterstitialState;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    fetch(`/api/quiz/leaderboard?sessionId=${state.sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.top) setRows(data.top.slice(0, 5));
      })
      .catch(() => {});
  }, [state.sessionId]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <BoardAmbient />
      <BoardChrome sessionId={state.sessionId} count={state.count} />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-24">
        <motion.p
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-[30px] font-bold uppercase tracking-[0.3em] text-foreground/40"
        >
          Standings
        </motion.p>

        <div className="mt-10 flex w-full max-w-[1100px] flex-col gap-5">
          {(rows ?? []).map((row, i) => (
            <motion.div
              key={row.participantId}
              initial={{ opacity: 0, x: 80 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.45,
                delay: 0.15 + i * 0.12,
                ease: [0, 0, 0.2, 1],
              }}
              className={`flex items-center gap-8 rounded-card border px-10 py-5 ${
                row.rank <= 3
                  ? "border-award/30 bg-award/5"
                  : "border-border-soft bg-surface"
              }`}
            >
              <span
                className={`w-16 text-[56px] font-black ${
                  row.rank <= 3
                    ? "text-award"
                    : "bg-gradient-to-r from-brand-cyan to-brand-purple bg-clip-text text-transparent"
                }`}
              >
                {row.rank}
              </span>
              {row.photoUrl ? (
                <Image
                  src={row.photoUrl}
                  alt={row.name}
                  width={72}
                  height={72}
                  className="h-[72px] w-[72px] rounded-full border-2 border-border-soft object-cover"
                />
              ) : (
                <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-surface text-3xl font-bold text-brand-purple">
                  {row.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="flex-1 truncate text-[44px] font-semibold">
                {row.name}
              </span>
              <CountedScore value={row.score} />
            </motion.div>
          ))}
          {!rows && (
            <p className="py-16 text-center text-[28px] text-foreground/40">
              Crunching the standings…
            </p>
          )}
        </div>

        <p className="mt-12 flex items-center text-[28px] text-foreground/45">
          Next question when the host advances
          <span className="dots ml-2 inline-flex align-baseline">
            <span />
            <span />
            <span />
          </span>
        </p>
      </div>
    </div>
  );
}
