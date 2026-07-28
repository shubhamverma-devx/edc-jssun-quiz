import { useEffect, useState } from "react";
import gsap from "gsap";
import type { Variants } from "@/lib/m";

/**
 * Shared motion vocabulary — keep timing consistent across every page.
 * Framer Motion for state-driven animation, GSAP for orchestrated
 * timelines. Everything must degrade gracefully under
 * prefers-reduced-motion (see prefersReducedMotion / the CSS blanket
 * kill in globals.css).
 */

export const easing = {
  standard: [0.4, 0, 0.2, 1] as const, // material standard
  entrance: [0, 0, 0.2, 1] as const, // ease-out for entrances
  exit: [0.4, 0, 1, 1] as const, // ease-in for exits
  overshoot: [0.34, 1.56, 0.64, 1] as const, // slight bounce
};

export const durations = {
  fast: 0.2,
  base: 0.4,
  slow: 0.6,
  hero: 0.8,
};

/** SSR-safe. On the server we render the end state (no motion). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Hydration-safe reduced-motion. Framer's useReducedMotion reads the media
 * query synchronously on the client but is false during SSR — a guaranteed
 * server/client mismatch for users with Reduce Motion enabled (common on
 * real iPhones, off in simulators). This returns false for SSR AND the
 * first client render (identical output = clean hydration), then updates.
 * Trade-off: reduced-motion users may see one initial animation play.
 */
export function useReducedMotionSafe(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Intentional post-mount correction: SSR and first client render must
      // agree (false) for clean hydration; the flip happens after mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReduced(true);
    }
  }, []);
  return reduced;
}

let hydratedOnce = false;

/**
 * Entrance-initial that never blanks a hard page load. Framer's
 * initial="hidden" styles are server-rendered, which leaves the page
 * invisible until hydration completes — seconds on a slow connection.
 * This returns `false` (render visible, skip entrance) for SSR and the
 * very first hydration, and "hidden" (play the entrance) for every
 * client-side navigation after that.
 */
export function useEntranceInitial(): "hidden" | false {
  const [initial] = useState<"hidden" | false>(() =>
    hydratedOnce ? "hidden" : false
  );
  useEffect(() => {
    hydratedOnce = true;
  }, []);
  return initial;
}

// ---------- Framer Motion variants ----------

/** Child variant: fade in while sliding up. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.base, ease: easing.entrance },
  },
};

/** Child variant: plain fade. Reduced-motion-friendly twin of fadeUp. */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: durations.base } },
};

/** Child variant: fade + slide down (for headers entering from above). */
export const fadeDown: Variants = {
  hidden: { opacity: 0, y: -14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.base, ease: easing.entrance },
  },
};

/** Child variant: scale-in with a slight settle. */
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: durations.base, ease: easing.overshoot },
  },
};

/** Parent variant: staggers `hidden`→`show` through children. */
export function staggerParent(stagger = 0.08, delayChildren = 0): Variants {
  return {
    hidden: {},
    show: { transition: { staggerChildren: stagger, delayChildren } },
  };
}

/** Spread onto interactive motion elements for tactile hover/tap. */
export const pressable = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
};

// ---------- GSAP helpers ----------

/** Animates an element's text from a number up to `to`. */
export function countUp(
  el: Element | null,
  to: number,
  opts: {
    from?: number;
    duration?: number;
    ease?: string;
    format?: (v: number) => string;
  } = {}
) {
  if (!el) return;
  const { from = 0, duration = 1, ease = "power2.out", format } = opts;
  const fmt = format ?? ((v: number) => String(v));
  if (prefersReducedMotion()) {
    el.textContent = fmt(to);
    return;
  }
  const state = { v: from };
  gsap.to(state, {
    v: to,
    duration,
    ease,
    onUpdate: () => {
      el.textContent = fmt(Math.round(state.v));
    },
  });
}

/** Quick scale "punch" — for counters incrementing, streaks rising. */
export function punch(el: Element | null, scale = 1.15, duration = 0.3) {
  if (!el || prefersReducedMotion()) return;
  gsap.fromTo(
    el,
    { scale },
    { scale: 1, duration, ease: "back.out(2)", overwrite: "auto" }
  );
}
