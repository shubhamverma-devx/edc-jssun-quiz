"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import { motion } from "@/lib/m";
import gsap from "gsap";
import {
  fadeUp,
  staggerParent,
  prefersReducedMotion,
  countUp,
  useEntranceInitial,
} from "@/lib/motion";

const WHAT_WE_DO = [
  "Startup competitions and pitch events",
  "Workshops on entrepreneurship and innovation",
  "Mentorship for student founders",
  "Industry connect and networking",
];

const STATS = [
  { value: 500, label: "Students" },
  { value: 50, label: "Events" },
  { value: 20, label: "Startups" },
];

function Words({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {text.split(" ").map((w, i) => (
        <span key={i} className="hero-word inline-block will-change-transform">
          {w}
          {i < text.split(" ").length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}

export default function LandingContent({
  connectionSlot,
}: {
  connectionSlot: React.ReactNode;
}) {
  const entrance = useEntranceInitial();
  const heroRef = useRef<HTMLDivElement>(null);
  const orbsRef = useRef<HTMLDivElement>(null);
  const statValueRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const statsPlayed = useRef(false);

  // Hero entrance timeline + ambient orb drift.
  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      tl.from(".hero-tag", { opacity: 0, y: 10, duration: 0.4 })
        .from(
          ".hero-line-1 .hero-word",
          { opacity: 0, y: 12, duration: 0.5, stagger: 0.05 },
          "-=0.1"
        )
        // NOTE: WebKit breaks background-clip:text when the clipped element's
        // background-position animates OR when child spans inside it are
        // transformed — both leave the line invisible. So line 2 animates as
        // one whole wrapper; the gradient lives on an untouched inner span.
        .from(
          ".hero-line-2",
          { opacity: 0, y: 14, duration: 0.55 },
          "+=0.2"
        )
        .from(".hero-callout", {
          opacity: 0,
          y: 18,
          scale: 0.98,
          duration: 0.45,
        })
        // one subtle amber border pulse to draw the eye
        .fromTo(
          ".hero-callout",
          { boxShadow: "0 0 0 0 rgba(247, 203, 72, 0.35)" },
          { boxShadow: "0 0 0 12px rgba(247, 203, 72, 0)", duration: 0.8 },
          ">-0.1"
        );

      // Two soft orbs drifting on slow sine paths behind the grid.
      const orbs = orbsRef.current?.children;
      if (orbs) {
        gsap.to(orbs[0], {
          xPercent: 35,
          yPercent: 55,
          duration: 20,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut",
        });
        gsap.to(orbs[1], {
          xPercent: -45,
          yPercent: -35,
          duration: 24,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut",
        });
      }
    }, heroRef);
    return () => ctx.revert();
  }, []);

  function playStats() {
    if (statsPlayed.current) return;
    statsPlayed.current = true;
    STATS.forEach((s, i) =>
      countUp(statValueRefs.current[i], s.value, {
        duration: 1.2,
        format: (v) => `${v}+`,
      })
    );
  }

  return (
    <main ref={heroRef} className="relative flex-1 overflow-hidden">
      {/* Ambient orbs — behind the grid */}
      <div ref={orbsRef} aria-hidden className="absolute inset-0">
        <div
          className="absolute -left-24 top-10 h-80 w-80 rounded-full opacity-[0.08]"
          style={{
            background:
              "radial-gradient(circle, #05b1de 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute -right-28 bottom-24 h-96 w-96 rounded-full opacity-[0.08]"
          style={{
            background:
              "radial-gradient(circle, #b585f0 0%, transparent 70%)",
          }}
        />
      </div>
      <div className="bg-grid absolute inset-0" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-[400px] flex-col px-5 pb-10 pt-12">
        <p className="hero-tag text-[11px] font-semibold uppercase tracking-[0.28em] text-brand-cyan">
          EDC × JSS University Noida
        </p>

        <h1 className="mt-5 text-[40px] font-extrabold leading-[1.12] tracking-tight">
          <Words text="Show what you know." className="hero-line-1 block" />
          <span className="hero-line-2 block">
            <span className="bg-gradient-to-r from-brand-cyan to-brand-purple bg-clip-text text-transparent">
              Win an interview.
            </span>
          </span>
        </h1>

        <div className="hero-callout mt-7 rounded-card border border-award/25 bg-award/10 p-4">
          <p className="text-sm font-semibold text-award">
            Top 3 = Direct entry
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-foreground/70">
            Skip the entire selection round.
          </p>
        </div>

        <motion.section
          variants={fadeUp}
          initial={entrance}
          whileInView="show"
          viewport={{ once: true, margin: "-40px" }}
          className="mt-10"
        >
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/50">
            About EDC
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed text-foreground/75">
            The Entrepreneurship Development Cell at JSS University fosters
            innovation, creativity, and the entrepreneurial spirit among
            students.
          </p>
        </motion.section>

        <motion.section
          variants={staggerParent(0.07)}
          initial={entrance}
          whileInView="show"
          viewport={{ once: true, margin: "-40px" }}
          className="mt-8"
        >
          <motion.h2
            variants={fadeUp}
            className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/50"
          >
            What We Do
          </motion.h2>
          <ul className="mt-4 space-y-3">
            {WHAT_WE_DO.map((item) => (
              <motion.li
                key={item}
                variants={fadeUp}
                className="flex items-start gap-3"
              >
                <span
                  aria-hidden
                  className="mt-[5px] text-[9px] leading-none text-award"
                >
                  ◆
                </span>
                <span className="text-[14px] leading-relaxed text-foreground/85">
                  {item}
                </span>
              </motion.li>
            ))}
          </ul>
        </motion.section>

        <motion.section
          variants={fadeUp}
          initial={entrance}
          whileInView="show"
          onViewportEnter={playStats}
          viewport={{ once: true, margin: "-40px" }}
          className="mt-9 grid grid-cols-3 gap-3"
        >
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              className="rounded-card-sm border border-border-soft bg-surface p-4 text-center"
            >
              <p
                ref={(el) => {
                  statValueRefs.current[i] = el;
                }}
                className="text-xl font-extrabold text-brand-cyan"
              >
                {stat.value}+
              </p>
              <p className="mt-1 text-[11px] font-medium text-foreground/55">
                {stat.label}
              </p>
            </div>
          ))}
        </motion.section>

        <div className="mt-10">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Link
              href="/join"
              className="shimmer block w-full rounded-card bg-gradient-to-r from-brand-cyan via-brand-purple to-brand-cyan py-4 text-center text-[15px] font-bold text-background"
            >
              Get started →
            </Link>
          </motion.div>
          <p className="mt-3 text-center text-[11px] text-foreground/40">
            By joining, you agree to fair play.
          </p>
        </div>

        <motion.div
          variants={fadeUp}
          initial={entrance}
          whileInView="show"
          viewport={{ once: true }}
          className="mt-auto flex justify-center pt-12"
        >
          {connectionSlot}
        </motion.div>
      </div>
    </main>
  );
}
