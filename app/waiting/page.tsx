"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "@/lib/m";
import gsap from "gsap";
import { createClient } from "@/lib/supabase/client";
import { countUp, prefersReducedMotion, punch } from "@/lib/motion";

type Participant = {
  id: string;
  name: string;
  photo_url: string | null;
  joined_at: string;
  /** Seconds after the orbit epoch this row appeared (0 = initial load). */
  orbitDelay?: number;
};

type SessionRow = {
  id: string;
  status: string;
  current_question_index: number | null;
  mode: string;
};

const RING_R = 50;
const RING_C = 2 * Math.PI * RING_R;

// Orbit constellation: joined freshers circle the user's avatar on two
// counter-rotating rings. Ring guides are drawn statically; items spin via
// CSS (transform-only) and counter-spin to stay upright.
const ORBIT_RINGS = [
  { radius: 100, cap: 5, size: 40, period: 70, spin: "orbit-ring-slow", upright: "orbit-upright-slow" },
  { radius: 146, cap: 7, size: 33, period: 100, spin: "orbit-ring-slower", upright: "orbit-upright-slower" },
];

const TICKER_LINES = [
  "Quiz starts when the host signals. Look up at the smart board.",
  "🏆 Top 3 finishers walk straight into the EDC interview.",
  "⚡ Speed matters — faster answers earn bigger bonuses.",
  "🔥 Streaks stack — every correct in a row is worth more.",
  "Keep this page open — you'll be pulled in automatically.",
];

// Deterministic firefly paths (index-derived; SSR-safe, no Math.random).
const FIREFLIES = Array.from({ length: 7 }, (_, i) => ({
  id: i,
  left: (i * 137 + 23) % 100,
  size: 3 + (i % 3),
  duration: 14 + (i % 5) * 2.5,
  delay: (i * 1.9) % 8,
  color: i % 2 === 0 ? "#05b1de" : "#b585f0",
}));

export default function WaitingPage() {
  const router = useRouter();
  const [ids, setIds] = useState<{
    participantId: string;
    sessionId: string;
  } | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dimming, setDimming] = useState(false);
  const [typedLen, setTypedLen] = useState(0);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [joinFlash, setJoinFlash] = useState<string | null>(null);

  const countRef = useRef<HTMLParagraphElement>(null);
  const firefliesRef = useRef<HTMLDivElement>(null);
  const countPlayed = useRef(false);
  const prevCount = useRef(0);
  const navigatingRef = useRef(false);
  const flashTimer = useRef<number | null>(null);
  // Orbit phase sync: the rings' CSS animations start at page epoch, but a
  // late joiner's counter-spin starts at ITS mount — leaving it tilted by
  // the ring rotation accrued in between. We record seconds-since-epoch per
  // participant and phase-advance their counter-spin with a negative
  // animation-delay so every orbiter stays upright.
  const orbitEpochRef = useRef<number | null>(null);
  const [chipDelay, setChipDelay] = useState<number | null>(null);

  useEffect(() => {
    orbitEpochRef.current = Date.now();
  }, []);

  // Guard: must have joined first.
  useEffect(() => {
    const pid = sessionStorage.getItem("edc-quiz-participant-id");
    const sid = sessionStorage.getItem("edc-quiz-session-id");
    if (!pid || !sid) {
      router.replace("/join");
      return;
    }
    // sessionStorage is client-only, so it can't be a useState initializer
    // (would mismatch the server-rendered HTML on hydration).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIds({ participantId: pid, sessionId: sid });
  }, [router]);

  // "Lights dimming" exit: fade the room to black, then route.
  const dimAndGo = useCallback(
    (path: string) => {
      if (navigatingRef.current) return;
      navigatingRef.current = true;
      if (prefersReducedMotion()) {
        router.replace(path);
        return;
      }
      setDimming(true);
      window.setTimeout(() => router.replace(path), 420);
    },
    [router]
  );

  // Firefly drift.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const nodes = firefliesRef.current?.children;
    if (!nodes) return;
    const tweens = Array.from(nodes).map((el, i) =>
      gsap.fromTo(
        el,
        { y: 0, opacity: 0 },
        {
          y: "-108vh",
          opacity: 0.55,
          duration: FIREFLIES[i].duration,
          delay: FIREFLIES[i].delay,
          repeat: -1,
          ease: "none",
        }
      )
    );
    return () => {
      tweens.forEach((t) => t.kill());
    };
  }, []);

  // Hype ticker rotation.
  useEffect(() => {
    const id = window.setInterval(
      () => setTickerIndex((i) => (i + 1) % TICKER_LINES.length),
      4200
    );
    return () => window.clearInterval(id);
  }, []);

  // Clear any pending join-flash timer on unmount.
  useEffect(() => {
    return () => {
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    };
  }, []);

  // Initial fetch + realtime subscription.
  useEffect(() => {
    if (!ids) return;
    const { sessionId } = ids;
    const supabase = createClient();

    // Quiz handoff: self-paced starts the moment the session is live;
    // session-based starts when the host advances to the first question.
    const routeForSession = (
      s: Pick<SessionRow, "status" | "current_question_index" | "mode">
    ) => {
      if (s.status === "ended") {
        dimAndGo("/result");
        return true;
      }
      if (
        s.status === "live" &&
        (s.mode === "self_paced" ||
          (s.current_question_index !== null && s.current_question_index >= 0))
      ) {
        sessionStorage.setItem(
          "edc-quiz-mode",
          s.mode === "self_paced" ? "self_paced" : "session_based"
        );
        dimAndGo("/quiz");
        return true;
      }
      return false;
    };

    // Late joiners: the session may already be underway when we mount.
    supabase
      .from("sessions")
      .select("status, current_question_index, mode")
      .eq("id", sessionId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) routeForSession(data);
      });

    supabase
      .from("participants")
      .select("id, name, photo_url, joined_at")
      .eq("session_id", sessionId)
      .order("joined_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          setLoadError(error.message || "Could not load the room.");
        } else if (data) {
          setParticipants(data);
        }
      });

    const channel = supabase
      .channel(`waiting-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "participants",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as Participant;
          const orbitDelay =
            orbitEpochRef.current !== null
              ? (Date.now() - orbitEpochRef.current) / 1000
              : 0;
          setParticipants((prev) => {
            if (prev.some((p) => p.id === row.id)) return prev;
            // 13th+ orbiter makes the overflow chip appear — phase-lock it.
            const capacity = ORBIT_RINGS[0].cap + ORBIT_RINGS[1].cap;
            if (prev.length >= capacity + 1) {
              setChipDelay((d) => d ?? orbitDelay);
            }
            return [...prev, { ...row, orbitDelay }];
          });
          // Name callout overrides the ticker for a moment.
          setJoinFlash(row.name);
          if (flashTimer.current) window.clearTimeout(flashTimer.current);
          flashTimer.current = window.setTimeout(
            () => setJoinFlash(null),
            3500
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          routeForSession(payload.new as SessionRow);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ids, dimAndGo]);

  const me = useMemo(
    () => participants.find((p) => p.id === ids?.participantId) ?? null,
    [participants, ids]
  );

  // Everyone except me, newest first, capped to what the rings can hold.
  const orbiters = useMemo(() => {
    const others = participants.filter((p) => p.id !== ids?.participantId);
    const capacity = ORBIT_RINGS[0].cap + ORBIT_RINGS[1].cap;
    return others.slice(-capacity);
  }, [participants, ids]);
  const overflow =
    participants.length - orbiters.length - (me ? 1 : 0);

  // Count: springy count-up on first load, punch + sync on later joins.
  useEffect(() => {
    const n = participants.length;
    if (n === 0) return;
    if (!countPlayed.current) {
      countPlayed.current = true;
      countUp(countRef.current, n, { duration: 0.9, ease: "back.out(1.4)" });
    } else if (n > prevCount.current && countRef.current) {
      countRef.current.textContent = String(n);
      punch(countRef.current);
    }
    prevCount.current = n;
  }, [participants.length]);

  // Name types itself out, terminal-style.
  useEffect(() => {
    if (!me?.name) return;
    if (prefersReducedMotion()) {
      // Reduced motion: show the full name instantly, no typing effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTypedLen(me.name.length);
      return;
    }
    const tick = setInterval(() => {
      setTypedLen((prev) => {
        if (prev >= me.name.length) {
          clearInterval(tick);
          return prev;
        }
        return prev + 1;
      });
    }, 40);
    return () => clearInterval(tick);
  }, [me?.name]);

  if (!ids) return null;

  const ring1 = orbiters.slice(0, ORBIT_RINGS[0].cap);
  const ring2 = orbiters.slice(
    ORBIT_RINGS[0].cap,
    ORBIT_RINGS[0].cap + ORBIT_RINGS[1].cap
  );
  const tickerText = joinFlash
    ? `🎉 ${joinFlash} just joined!`
    : TICKER_LINES[tickerIndex];

  return (
    <main className="bg-grid relative flex-1 overflow-hidden">
      {/* Fireflies */}
      <div ref={firefliesRef} aria-hidden className="absolute inset-0">
        {FIREFLIES.map((f) => (
          <span
            key={f.id}
            className="absolute rounded-full opacity-0"
            style={{
              left: `${f.left}%`,
              bottom: "-2vh",
              width: f.size,
              height: f.size,
              backgroundColor: f.color,
              boxShadow: `0 0 8px 1px ${f.color}66`,
            }}
          />
        ))}
      </div>

      {/* Curtain-rise entrance + lights-dim exit */}
      <motion.div
        initial={{ opacity: 1 }}
        animate={{ opacity: dimming ? 1 : 0 }}
        transition={{ duration: dimming ? 0.4 : 0.6 }}
        className="pointer-events-none fixed inset-0 z-50 bg-black"
      />

      <motion.div
        initial={prefersReducedMotion() ? false : { scale: 0.98 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.6, ease: [0, 0, 0.2, 1] }}
        className="relative mx-auto flex min-h-dvh w-full max-w-[400px] flex-col px-5 pb-8 pt-6"
      >
        <header className="flex items-center justify-between">
          <span className="flex items-center gap-2 rounded-full border border-green-500/25 bg-green-500/10 px-3 py-1.5 text-[11px] font-semibold text-green-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
            Live
          </span>
          <span className="rounded-full border border-border-soft bg-surface px-3 py-1.5 text-[11px] font-medium text-foreground/50">
            Session #{ids.sessionId.slice(0, 8)}
          </span>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center">
          {/* Orbit constellation */}
          <div className="relative h-[330px] w-[330px]">
            {/* static ring guides */}
            <div className="absolute left-1/2 top-1/2 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5" />
            <div className="absolute left-1/2 top-1/2 h-[292px] w-[292px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/5" />

            {/* rotating rings with orbiters */}
            {[ring1, ring2].map((ring, ringIdx) => {
              const cfg = ORBIT_RINGS[ringIdx];
              const slots = Math.max(ring.length, 3);
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
                          initial={
                            prefersReducedMotion()
                              ? { opacity: 0 }
                              : { scale: 0, opacity: 0 }
                          }
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{
                            type: "spring",
                            stiffness: 320,
                            damping: 20,
                          }}
                          className="h-full w-full"
                        >
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
                                className="h-full w-full rounded-full border border-border-soft object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center rounded-full border border-border-soft bg-surface text-xs font-bold text-brand-purple">
                                {p.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      </div>
                    );
                  })}

                  {/* overflow chip rides the outer ring */}
                  {ringIdx === 1 && overflow > 0 && (
                    <div
                      className="absolute left-1/2 top-1/2"
                      style={{
                        width: 40,
                        height: 26,
                        marginLeft: -20,
                        marginTop: -13,
                        transform: `rotate(135deg) translateX(${cfg.radius}px) rotate(-135deg)`,
                      }}
                    >
                      <div
                        className={`${cfg.upright} flex h-full w-full items-center justify-center rounded-full border border-brand-cyan/40 bg-brand-cyan/15 text-[10px] font-bold text-brand-cyan will-change-transform`}
                        style={{
                          animationDelay: `-${(chipDelay ?? 0) % cfg.period}s`,
                        }}
                      >
                        +{overflow}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* center: sonar + avatar with self-drawing ring */}
            <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2">
              <span className="sonar-ring" aria-hidden />
              <span className="sonar-ring" aria-hidden />
              <motion.div
                initial={
                  prefersReducedMotion() ? false : { scale: 0.9, opacity: 0 }
                }
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
                className="relative h-full w-full"
              >
                <svg viewBox="0 0 112 112" className="absolute inset-0 -rotate-90">
                  <motion.circle
                    cx="56"
                    cy="56"
                    r={RING_R}
                    fill="none"
                    stroke="#05b1de"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray={RING_C}
                    initial={
                      prefersReducedMotion()
                        ? { strokeDashoffset: 0 }
                        : { strokeDashoffset: RING_C }
                    }
                    animate={{ strokeDashoffset: 0 }}
                    transition={{ duration: 0.8, ease: [0, 0, 0.2, 1], delay: 0.2 }}
                  />
                </svg>
                <div className="absolute inset-2 overflow-hidden rounded-full">
                  {me?.photo_url ? (
                    <Image
                      src={me.photo_url}
                      alt={me.name}
                      width={96}
                      height={96}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-surface text-3xl font-extrabold text-brand-cyan">
                      {(me?.name ?? "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </div>

          <p className="mt-2 min-h-7 text-lg font-bold">
            {me ? me.name.slice(0, typedLen) : " "}
            {me && typedLen < me.name.length && (
              <span className="text-brand-cyan">▌</span>
            )}
          </p>
          <p className="letter-settle mt-1 text-[12px] font-semibold uppercase text-brand-cyan">
            You&apos;re in the room
          </p>

          <p
            ref={countRef}
            className="mt-6 bg-gradient-to-r from-brand-cyan to-brand-purple bg-clip-text text-6xl font-black text-transparent"
          >
            0
          </p>
          <p className="mt-1 text-[13px] font-medium text-foreground/50">
            {participants.length === 1 ? "fresher" : "freshers"} in the room
          </p>

          {loadError && (
            <p className="mt-5 rounded-card border border-red-500/25 bg-red-500/10 px-4 py-2 text-[12px] text-red-400/90">
              {loadError}
            </p>
          )}
        </div>

        {/* Hype ticker — always in motion, hijacked by join callouts */}
        <div className="flex min-h-12 items-center justify-center pb-2 text-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={joinFlash ?? `tick-${tickerIndex}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
              className={`max-w-[300px] text-[13px] leading-relaxed ${
                joinFlash
                  ? "font-semibold text-brand-cyan"
                  : "text-foreground/45"
              }`}
            >
              {tickerText}
            </motion.p>
          </AnimatePresence>
        </div>
      </motion.div>
    </main>
  );
}
