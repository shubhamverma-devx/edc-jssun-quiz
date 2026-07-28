"use client";

import { motion } from "@/lib/m";
import { useEntranceInitial, useReducedMotionSafe } from "@/lib/motion";

/**
 * Remounts on every route change (App Router template semantics), giving
 * each page a consistent entrance. Three deliberate constraints:
 * - First load / hard refresh renders visible immediately (no SSR-hidden
 *   blank page while hydrating) — see useEntranceInitial.
 * - Reduced-motion detection is hydration-safe (useReducedMotionSafe), so
 *   server and client always render identical initial styles.
 * - Exit animations aren't reliable with the App Router, so dramatic exits
 *   (fade-to-black moments) are handled inside the pages that own them.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotionSafe();
  const entrance = useEntranceInitial();
  return (
    <motion.div
      initial={
        entrance === false
          ? false
          : reduced
            ? { opacity: 0 }
            : { opacity: 0, y: 14 }
      }
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0, 0, 0.2, 1] }}
      className="flex flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}
