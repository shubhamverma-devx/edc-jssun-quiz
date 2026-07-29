"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { prefersReducedMotion } from "@/lib/motion";

// Low-density fireflies for the big canvas (deterministic paths).
const FIREFLIES = Array.from({ length: 6 }, (_, i) => ({
  id: i,
  left: (i * 157 + 31) % 100,
  size: 4 + (i % 3),
  duration: 18 + (i % 5) * 3,
  delay: (i * 2.3) % 9,
  color: i % 2 === 0 ? "#05b1de" : "#b585f0",
}));

/** Shared board backdrop: grid + two large drifting orbs + fireflies. */
export default function BoardAmbient() {
  const orbsRef = useRef<HTMLDivElement>(null);
  const firefliesRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;
    const orbs = orbsRef.current?.children;
    const tweens: gsap.core.Tween[] = [];
    if (orbs) {
      tweens.push(
        gsap.to(orbs[0], {
          xPercent: 30,
          yPercent: 40,
          duration: 26,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut",
        }),
        gsap.to(orbs[1], {
          xPercent: -35,
          yPercent: -30,
          duration: 32,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut",
        })
      );
    }
    const nodes = firefliesRef.current?.children;
    if (nodes) {
      Array.from(nodes).forEach((el, i) => {
        tweens.push(
          gsap.fromTo(
            el,
            { y: 0, opacity: 0 },
            {
              y: "-110vh",
              opacity: 0.5,
              duration: FIREFLIES[i].duration,
              delay: FIREFLIES[i].delay,
              repeat: -1,
              ease: "none",
            }
          )
        );
      });
    }
    return () => {
      tweens.forEach((t) => t.kill());
    };
  }, []);

  return (
    <>
      <div aria-hidden className="aurora" />
      <div ref={orbsRef} aria-hidden className="absolute inset-0">
        <div
          className="absolute -left-40 top-0 h-[42rem] w-[42rem] rounded-full opacity-[0.07]"
          style={{
            background: "radial-gradient(circle, #05b1de 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute -right-48 bottom-0 h-[46rem] w-[46rem] rounded-full opacity-[0.07]"
          style={{
            background: "radial-gradient(circle, #b585f0 0%, transparent 70%)",
          }}
        />
      </div>
      <div className="bg-grid absolute inset-0" />
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
              boxShadow: `0 0 10px 2px ${f.color}55`,
            }}
          />
        ))}
      </div>
    </>
  );
}

/** Small corner pills shared by several views. */
export function BoardChrome({
  sessionId,
  count,
}: {
  sessionId: string;
  count?: number;
}) {
  return (
    <>
      <div className="absolute left-10 top-8 z-10">
        <p className="rounded-full border border-border-soft bg-surface px-5 py-2 text-[16px] font-semibold uppercase tracking-[0.25em] text-brand-cyan">
          EDC × JSS University Noida
        </p>
      </div>
      <div className="absolute right-10 top-8 z-10 flex items-center gap-3">
        {count !== undefined && (
          <span className="rounded-full border border-border-soft bg-surface px-5 py-2 text-[16px] font-semibold text-foreground/60">
            {count} in the room
          </span>
        )}
        <span className="flex items-center gap-2 rounded-full border border-green-500/25 bg-green-500/10 px-5 py-2 text-[16px] font-semibold text-green-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
          Live
        </span>
        <span className="rounded-full border border-border-soft bg-surface px-5 py-2 text-[16px] font-medium text-foreground/50">
          #{sessionId.slice(0, 8)}
        </span>
      </div>
    </>
  );
}
