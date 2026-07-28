"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import ProgressSteps from "@/components/progress-steps";

export default function JoinPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const canContinue = name.trim().length >= 2;

  // Native-event fallback + polling reconciler. Two failure modes covered:
  // 1. Mobile keyboards (predictive text, transliteration/IME) that don't
  //    fire React's synthetic events per keystroke → native listeners.
  // 2. iOS Safari autofill injects text via DOM manipulation WITHOUT firing
  //    any input/change/keyup event at all → a 200ms poll reconciles the
  //    DOM value into state (no-op re-render-wise when values match).
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    const sync = () => {
      const domValue = el.value;
      setName((prev) => (prev === domValue ? prev : domValue));
    };

    el.addEventListener("input", sync);
    el.addEventListener("change", sync);
    el.addEventListener("keyup", sync);
    // Autofill often fires focus without any input event.
    el.addEventListener("focus", sync);
    el.addEventListener("blur", sync);

    // Catches autofill and any other silent DOM writes within 200ms.
    const pollId = window.setInterval(sync, 200);

    // Field may already be prefilled at mount (autofill can beat hydration).
    sync();

    return () => {
      el.removeEventListener("input", sync);
      el.removeEventListener("change", sync);
      el.removeEventListener("keyup", sync);
      el.removeEventListener("focus", sync);
      el.removeEventListener("blur", sync);
      window.clearInterval(pollId);
    };
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Don't submit mid-IME-composition — the name may be half-composed.
    if (isComposing) return;
    // Read the DOM value directly as the last word, in case state lagged.
    const value = (inputRef.current?.value ?? name).trim();
    if (value.length < 2) return;
    sessionStorage.setItem("edc-quiz-name", value);
    router.push("/join/photo");
  }

  return (
    <main className="bg-grid flex-1">
      <div className="mx-auto flex min-h-dvh w-full max-w-[400px] flex-col px-5 pb-10 pt-6">
        <header className="flex items-center gap-4">
          <Link
            href="/"
            aria-label="Back to home"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border-soft bg-surface text-foreground/70 transition-colors hover:text-foreground"
          >
            ←
          </Link>
          <div className="flex-1">
            <ProgressSteps current={1} />
          </div>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col pt-12">
          <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">
            What should we call you?
          </h1>
          <p className="mt-2 text-[13px] text-foreground/55">
            This name shows up on the leaderboard.
          </p>

          {/* Mobile keyboards (predictive text, IME/transliteration) don't
              always fire React's onChange per keystroke — handle onInput and
              composition events too so Continue activates while typing. */}
          <input
            ref={inputRef}
            autoFocus
            type="text"
            value={name}
            maxLength={60}
            placeholder="Your name"
            name="display-name"
            autoComplete="off"
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            enterKeyHint="next"
            onChange={(e) => setName(e.currentTarget.value)}
            onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={(e) => {
              setIsComposing(false);
              setName((e.currentTarget as HTMLInputElement).value);
            }}
            className="mt-8 w-full rounded-card border border-border-soft bg-surface px-4 py-4 text-[16px] font-medium text-foreground placeholder:text-foreground/30 outline-none transition-colors focus:border-brand-cyan/60"
          />

          <div className="mt-auto pt-10">
            <button
              type="submit"
              disabled={!canContinue}
              className="block w-full rounded-card bg-gradient-to-r from-brand-cyan to-brand-purple py-4 text-center text-[15px] font-bold text-background transition-opacity enabled:hover:opacity-90 disabled:opacity-30"
            >
              Continue →
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
