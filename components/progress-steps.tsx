"use client";

import { motion } from "@/lib/m";
import { useReducedMotionSafe } from "@/lib/motion";

export default function ProgressSteps({
  current,
  total = 3,
}: {
  current: number;
  total?: number;
}) {
  // Hydration-safe: SSR and first client render agree (false), so the
  // server-rendered initial styles always match. See lib/motion.ts.
  const reduced = useReducedMotionSafe();
  return (
    <div
      className="flex gap-2"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      aria-label={`Step ${current} of ${total}`}
    >
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="h-1 flex-1 overflow-hidden rounded-full bg-white/10"
        >
          {i < current && (
            <motion.div
              initial={reduced ? false : { scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{
                duration: 0.6,
                ease: [0, 0, 0.2, 1],
                delay: i === current - 1 ? 0.15 : 0,
              }}
              className="h-full w-full origin-left rounded-full bg-brand-cyan"
            />
          )}
        </div>
      ))}
    </div>
  );
}
