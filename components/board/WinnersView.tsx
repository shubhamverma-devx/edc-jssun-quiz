"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { motion } from "@/lib/m";
import gsap from "gsap";
import type { BoardState } from "@/lib/board/state";
import { prefersReducedMotion } from "@/lib/motion";
import BoardAmbient from "./BoardAmbient";

type WinnersState = Extract<BoardState, { kind: "winners" }>;

type Row = {
  participantId: string;
  name: string;
  photoUrl: string | null;
  score: number;
  rank: number;
};

const CONFETTI_COLORS = ["#f7cb48", "#05b1de", "#b585f0", "#4ade80"];
const BURST_COLORS = ["#f7cb48", "#b585f0", "#05b1de"];

// The closer's beat sheet (ms from mount). Reduced motion collapses to 400.
const BEATS = {
  third: 1200,
  second: 2600,
  first: 4000,
  line: 4800,
  subline: 8800,
};

export default function WinnersView({ state }: { state: WinnersState }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [beat, setBeat] = useState(0); // ms since mount, quantized to BEATS

  useEffect(() => {
    fetch(`/api/quiz/leaderboard?sessionId=${state.sessionId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.top) {
          setRows(data.top.slice(0, 3));
          setTotal(data.totalParticipants ?? 0);
        }
      })
      .catch(() => {});
  }, [state.sessionId]);

  // Advance the beat clock once the data is here.
  useEffect(() => {
    if (!rows) return;
    if (prefersReducedMotion()) {
      // Reduced motion: skip the beat sheet, show the final composition.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBeat(BEATS.subline + 1);
      return;
    }
    const timers = Object.values(BEATS).map((ms) =>
      window.setTimeout(() => setBeat((b) => Math.max(b, ms)), ms)
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [rows]);

  // Confetti (3× phone density) + gold burst at the 1st-place beat.
  const confetti = useMemo(
    () =>
      Array.from({ length: 180 }, (_, i) => ({
        id: i,
        left: (i * 37) % 100,
        delay: ((i * 53) % 40) / 10,
        duration: 3 + ((i * 17) % 25) / 10,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 7 + ((i * 29) % 8),
      })),
    []
  );

  useEffect(() => {
    if (beat < BEATS.first || prefersReducedMotion()) return;
    const host = document.getElementById("winners-burst");
    if (!host || host.childElementCount > 0) return;
    for (let i = 0; i < 60; i++) {
      const p = document.createElement("span");
      const size = 6 + Math.random() * 8;
      p.style.cssText = `position:absolute;left:50%;top:40%;width:${size}px;height:${size * 0.62}px;border-radius:2px;background:${BURST_COLORS[i % BURST_COLORS.length]};will-change:transform;`;
      host.appendChild(p);
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
      const velocity = 320 + Math.random() * 380;
      gsap.to(p, {
        duration: 2.6 + Math.random(),
        rotation: (Math.random() - 0.5) * 900,
        opacity: 0,
        ease: "none",
        onComplete: () => p.remove(),
        keyframes: [
          {
            x: Math.cos(angle) * velocity * 0.4,
            y: Math.sin(angle) * velocity * 0.4,
            duration: 0.4,
            ease: "power2.out",
          },
          {
            x: Math.cos(angle) * velocity * 0.4 + (Math.random() - 0.5) * 90,
            y: 700,
            duration: 2.2 + Math.random(),
            ease: "power1.in",
          },
        ],
      });
    }
  }, [beat]);

  const first = rows?.[0];
  const second = rows?.[1];
  const third = rows?.[2];

  if (!rows) {
    return (
      <div className="flex h-full items-center justify-center bg-black">
        <p className="animate-pulse text-3xl text-foreground/30">…</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <BoardAmbient />
      {/* Ambient confetti once the first reveal lands */}
      {beat >= BEATS.third &&
        confetti.map((c) => (
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
      <div id="winners-burst" aria-hidden className="absolute inset-0 z-20" />

      {/* Opening black hold */}
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: beat >= BEATS.third ? 0 : 1 }}
        transition={{ duration: 0.5 }}
        className="pointer-events-none absolute inset-0 z-40 bg-black"
      />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-20">
        {/* The line */}
        <motion.p
          initial={{ opacity: 0, y: -18 }}
          animate={beat >= BEATS.line ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-[44px] font-bold uppercase tracking-[0.25em] text-foreground/60"
        >
          The interview slots go to…
        </motion.p>

        <div className="mt-10 flex w-full max-w-[1500px] items-end justify-center gap-16">
          {/* 2nd — left */}
          {second && (
            <Winner
              row={second}
              show={beat >= BEATS.second}
              size={220}
              glow="rgba(203,213,225,0.35)"
              label="2nd"
              labelColor="text-slate-300"
            />
          )}
          {/* 1st — center, biggest */}
          {first && (
            <Winner
              row={first}
              show={beat >= BEATS.first}
              size={320}
              glow="rgba(247,203,72,0.45)"
              label="1st"
              labelColor="text-award"
              gold
            />
          )}
          {/* 3rd — right */}
          {third && (
            <Winner
              row={third}
              show={beat >= BEATS.third}
              size={190}
              glow="rgba(217,119,6,0.35)"
              label="3rd"
              labelColor="text-amber-600"
            />
          )}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={beat >= BEATS.subline ? { opacity: 1 } : {}}
          transition={{ duration: 0.6 }}
          className="mt-14 text-center text-[32px] text-foreground/60"
        >
          Direct entry to the EDC personal interview — the team will reach out
          within 48 hours. · {total} played
        </motion.p>
      </div>
    </div>
  );
}

function Winner({
  row,
  show,
  size,
  glow,
  label,
  labelColor,
  gold = false,
}: {
  row: Row;
  show: boolean;
  size: number;
  glow: string;
  label: string;
  labelColor: string;
  gold?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.3, y: 60 }}
      animate={show ? { opacity: 1, scale: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: [0.34, 1.56, 0.64, 1] }}
      className="flex flex-col items-center"
    >
      <div className="relative" style={{ width: size, height: size }}>
        {gold && (
          <div
            aria-hidden
            className="aurora opacity-80"
            style={{ animationDuration: "16s", inset: "-90%" }}
          />
        )}
        <div
          aria-hidden
          className="absolute -inset-10 rounded-full"
          style={{
            background: `radial-gradient(circle, ${glow} 0%, transparent 70%)`,
          }}
        />
        {row.photoUrl ? (
          <Image
            src={row.photoUrl}
            alt={row.name}
            width={size}
            height={size}
            className="relative h-full w-full rounded-full border-4 object-cover"
            style={{ borderColor: glow }}
          />
        ) : (
          <div
            className="relative flex h-full w-full items-center justify-center rounded-full border-4 bg-surface font-black text-brand-purple"
            style={{ borderColor: glow, fontSize: size / 3 }}
          >
            {row.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <p
        className={`mt-6 font-black ${labelColor} ${gold ? "text-[56px]" : "text-[40px]"}`}
      >
        {label} — {row.name}
      </p>
      <p
        className={`font-bold ${
          gold
            ? "bg-gradient-to-r from-award to-brand-cyan bg-clip-text text-[44px] text-transparent"
            : "text-[32px] text-foreground/60"
        }`}
      >
        {row.score} pts
      </p>
    </motion.div>
  );
}
