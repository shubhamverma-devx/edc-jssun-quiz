"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { AnimatePresence, motion } from "@/lib/m";
import { useParams } from "next/navigation";
import type { BoardState } from "@/lib/board/state";
import { countUp, punch } from "@/lib/motion";
import Starfield from "./Starfield";

type LobbyState = Extract<BoardState, { kind: "lobby" }>;

const TICKER_LINES = [
  "quiz begins when the host signals",
  "top 3 finishers walk straight into the EDC interview",
  "speed matters — faster answers earn bigger bonuses",
  "streaks stack — every correct in a row is worth more",
];

// The gravity well: three orbit rings around the count-core.
const RINGS = [
  { radius: 175, cap: 6, size: 62, period: 70, spin: "orbit-ring-slow", upright: "orbit-upright-slow" },
  { radius: 255, cap: 10, size: 52, period: 100, spin: "orbit-ring-slower", upright: "orbit-upright-slower" },
  { radius: 335, cap: 14, size: 44, period: 70, spin: "orbit-ring-slow", upright: "orbit-upright-slow" },
];
const CAPACITY = RINGS.reduce((a, r) => a + r.cap, 0);

export default function LobbyView({ state }: { state: LobbyState }) {
  const params = useParams<{ sessionId: string }>();
  const [qr, setQr] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState("");
  const [tickerIndex, setTickerIndex] = useState(0);
  const countRef = useRef<HTMLSpanElement>(null);
  const countPlayed = useRef(false);
  const prevCount = useRef(0);

  // Join URL: prefer NEXT_PUBLIC_SITE_URL (production), fall back to the
  // board's own origin (dev / env not yet configured). NEXT_PUBLIC_ vars
  // are inlined at build time, so this is safe in a client component.
  useEffect(() => {
    const envUrl = process.env.NEXT_PUBLIC_SITE_URL;
    const base =
      envUrl && !envUrl.includes("placeholder") && !envUrl.includes("localhost")
        ? envUrl
        : window.location.origin;
    // QR sends freshers to the landing page root — one tap to Get started.
    const url = base.replace(/\/+$/, "");
    // window is client-only — can't be a useState initializer under SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setJoinUrl(url.replace(/^https?:\/\//, ""));
    QRCode.toDataURL(url, {
      width: 640,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0a0a12", light: "#ffffff" },
    })
      .then(setQr)
      .catch(() => {});
  }, []);

  useEffect(() => {
    const id = window.setInterval(
      () => setTickerIndex((i) => (i + 1) % TICKER_LINES.length),
      4600
    );
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const n = state.count;
    if (n === 0) return;
    if (!countPlayed.current) {
      countPlayed.current = true;
      countUp(countRef.current, n, { duration: 1, ease: "back.out(1.4)" });
    } else if (n > prevCount.current && countRef.current) {
      countRef.current.textContent = String(n);
      punch(countRef.current, 1.18);
    }
    prevCount.current = n;
  }, [state.count]);

  const orbiters = state.participants.slice(-CAPACITY);
  const overflow = state.participants.length - orbiters.length;
  const ringSlices = [
    orbiters.slice(0, RINGS[0].cap),
    orbiters.slice(RINGS[0].cap, RINGS[0].cap + RINGS[1].cap),
    orbiters.slice(RINGS[0].cap + RINGS[1].cap),
  ];

  const tickerText = state.joinFlash
    ? `${state.joinFlash} just joined`
    : TICKER_LINES[tickerIndex];

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Deep space */}
      <Starfield />
      {/* Horizon glow at the base */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-72"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 100%, rgba(5,177,222,0.12) 0%, transparent 70%)",
        }}
      />

      {/* Minimal chrome */}
      <div className="absolute right-12 top-10 z-20 flex items-center gap-3">
        <span className="flex items-center gap-2 rounded-full border border-green-500/25 bg-green-500/10 px-5 py-2 text-[16px] font-semibold text-green-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
          Live
        </span>
        <span className="rounded-full border border-border-soft bg-surface px-5 py-2 text-[16px] font-medium text-foreground/50">
          #{(params.sessionId ?? "").slice(0, 8)}
        </span>
      </div>

      {/* ---- Left: the poster ---- */}
      <div className="absolute left-28 top-0 z-10 flex h-full w-[640px] flex-col justify-center">
        <p className="flex items-center gap-3 text-[15px] font-semibold uppercase tracking-[0.4em] text-foreground/50">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-cyan" />
          EDC × JSS University Noida
        </p>

        <h1 className="mt-7 text-[86px] font-extrabold leading-[1.04] tracking-[-0.02em]">
          Show what
          <br />
          you know.
          <br />
          <span className="bg-gradient-to-r from-brand-cyan to-brand-purple bg-clip-text text-transparent">
            Win an interview.
          </span>
        </h1>

        <p className="mt-6 text-[24px] leading-relaxed text-foreground/60">
          <span className="font-semibold text-award">Top 3</span> walk straight
          into the EDC personal interview.
        </p>

        {/* QR — quiet glass card */}
        <div className="mt-12 flex w-fit items-center gap-8 rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_0_80px_rgba(5,177,222,0.12)]">
          <div className="shrink-0 overflow-hidden rounded-xl bg-white p-2.5">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="Scan to join" className="h-[228px] w-[228px]" />
            ) : (
              <div className="h-[228px] w-[228px] animate-pulse bg-black/10" />
            )}
          </div>
          <div>
            <p className="text-[15px] font-semibold uppercase tracking-[0.3em] text-foreground/40">
              Join in
            </p>
            <p className="mt-2 text-[30px] font-bold leading-tight">
              Scan to join
            </p>
            <p className="mt-1.5 text-[18px] font-medium text-brand-cyan">
              {joinUrl}
            </p>
            <p className="mt-5 text-[16px] text-foreground/45">
              {state.count > 0
                ? `${state.count} already in the room`
                : "be the first one in"}
            </p>
          </div>
        </div>

        {/* Quiet ticker */}
        <div className="mt-9 flex min-h-8 items-center text-[19px]">
          <AnimatePresence mode="wait">
            <motion.span
              key={state.joinFlash ?? `t-${tickerIndex}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className={
                state.joinFlash
                  ? "font-semibold text-brand-cyan"
                  : "text-foreground/40"
              }
            >
              {tickerText}
            </motion.span>
          </AnimatePresence>
        </div>
      </div>

      {/* ---- Right: the gravity well ---- */}
      <div className="absolute right-[70px] top-1/2 z-10 h-[820px] w-[820px] -translate-y-1/2">
        {/* breathing core glow */}
        <div className="core-breathe absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(5,177,222,0.28) 0%, rgba(181,133,240,0.16) 42%, transparent 70%)",
            }}
          />
        </div>
        {/* join flare — pulses on every new capture */}
        <AnimatePresence>
          <motion.div
            key={`flare-${state.count}`}
            initial={{ opacity: 0.5, scale: 0.7 }}
            animate={{ opacity: 0, scale: 1.5 }}
            transition={{ duration: 1.1, ease: [0, 0, 0.2, 1] }}
            className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(5,177,222,0.4) 0%, transparent 65%)",
            }}
          />
        </AnimatePresence>

        {/* ring guides */}
        {RINGS.map((r) => (
          <div
            key={r.radius}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.07]"
            style={{ width: r.radius * 2, height: r.radius * 2 }}
          />
        ))}

        {/* spinning halo arc around the core */}
        <div
          aria-hidden
          className="orbit-ring-slower absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full will-change-transform"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0%, rgba(5,177,222,0.8) 12%, rgba(181,133,240,0.5) 22%, transparent 32%)",
            WebkitMask:
              "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))",
            mask: "radial-gradient(farthest-side, transparent calc(100% - 3px), #000 calc(100% - 2px))",
          }}
        />

        {/* the sun: live count over a soft core disc */}
        <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 text-center">
          <div
            aria-hidden
            className="absolute left-1/2 top-1/2 h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              background:
                "radial-gradient(circle, rgba(5,5,8,0.92) 0%, rgba(5,5,8,0.55) 55%, transparent 75%)",
            }}
          />
          <span
            ref={countRef}
            className="relative block text-[200px] font-black leading-none tracking-[-0.02em] text-foreground"
            style={{ textShadow: "0 0 70px rgba(5,177,222,0.45)" }}
          >
            0
          </span>
          <p className="relative mt-1 text-[16px] font-semibold uppercase tracking-[0.4em] text-foreground/45">
            in the room
          </p>
        </div>

        {/* orbiting freshers */}
        {ringSlices.map((ring, ringIdx) => {
          const cfg = RINGS[ringIdx];
          const slots = Math.max(ring.length, 4);
          return (
            <div
              key={ringIdx}
              className={`${cfg.spin} absolute inset-0 will-change-transform`}
            >
              {ring.map((p, i) => {
                const angle = (360 / slots) * i - 90;
                return (
                  <div
                    key={p.id}
                    className="absolute left-1/2 top-1/2"
                    style={{
                      width: cfg.size,
                      height: cfg.size,
                      marginLeft: -cfg.size / 2,
                      marginTop: -cfg.size / 2,
                      transform: `rotate(${angle}deg) translateX(${cfg.radius}px) rotate(${-angle}deg)`,
                    }}
                  >
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 280, damping: 19 }}
                      className="relative h-full w-full"
                    >
                      {/* capture ripple on arrival */}
                      <motion.span
                        initial={{ opacity: 0.8, scale: 0.6 }}
                        animate={{ opacity: 0, scale: 2.4 }}
                        transition={{ duration: 0.9, ease: [0, 0, 0.2, 1] }}
                        className="absolute inset-0 rounded-full border-2 border-brand-cyan"
                      />
                      <div
                        className={`${cfg.upright} h-full w-full will-change-transform`}
                        style={{
                          animationDelay: `-${(p.orbitDelay ?? 0) % cfg.period}s`,
                        }}
                      >
                        {p.photo_url ? (
                          <Image
                            src={p.photo_url}
                            alt={p.name}
                            width={cfg.size}
                            height={cfg.size}
                            className="h-full w-full rounded-full border border-white/15 object-cover shadow-[0_0_14px_rgba(5,177,222,0.22)]"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center rounded-full border-2 border-white/15 bg-surface text-xl font-bold text-brand-purple">
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </div>
                );
              })}

              {ringIdx === 2 && overflow > 0 && (
                <div
                  className="absolute left-1/2 top-1/2"
                  style={{
                    width: 86,
                    height: 44,
                    marginLeft: -43,
                    marginTop: -22,
                    transform: `rotate(135deg) translateX(${cfg.radius}px) rotate(-135deg)`,
                  }}
                >
                  <div
                    className={`${cfg.upright} flex h-full w-full items-center justify-center rounded-full border border-brand-cyan/40 bg-brand-cyan/15 text-[20px] font-bold text-brand-cyan will-change-transform`}
                  >
                    +{overflow}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
