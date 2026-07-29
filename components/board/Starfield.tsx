"use client";

import { useEffect, useRef } from "react";

/**
 * One-canvas parallax starfield for the board lobby. ~150 stars on three
 * drift layers with sine twinkle — a single paint layer, trivially 60fps.
 * Reduced motion: one static paint, no rAF loop.
 */
export default function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const W = 1920;
    const H = 1080;
    canvas.width = W;
    canvas.height = H;

    const stars = Array.from({ length: 150 }, (_, i) => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 0.6 + Math.random() * 1.8,
      layer: i % 3,
      tw: Math.random() * Math.PI * 2,
      color: i % 9 === 0 ? "#05b1de" : i % 13 === 0 ? "#b585f0" : "#e8ecf4",
    }));

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    let raf = 0;
    let last = performance.now();

    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      for (const s of stars) {
        if (!reduced) {
          s.x -= (s.layer + 1) * 0.006 * (t - last);
          if (s.x < -2) s.x = W + 2;
        }
        ctx.globalAlpha = reduced
          ? 0.65
          : 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(s.tw + t / (1200 * (s.layer + 1))));
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      last = t;
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(draw);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={ref} className="absolute inset-0" aria-hidden />;
}
