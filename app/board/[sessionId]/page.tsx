"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AnimatePresence, motion } from "@/lib/m";
import { useBoardState } from "@/lib/board/state";
import { boardSynth, sfx } from "@/lib/board/sound";
import LobbyView from "@/components/board/LobbyView";
import QuestionView from "@/components/board/QuestionView";
import RevealView from "@/components/board/RevealView";
import InterstitialView from "@/components/board/InterstitialView";
import WinnersView from "@/components/board/WinnersView";

// The board composes on a fixed 1920×1080 stage, then scales to fit ANY
// window — laptop, projector at 1366×768, 4K TV — keynote-slide style.
// Letterboxing disappears into the near-black background.
const STAGE_W = 1920;
const STAGE_H = 1080;

function useStageScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const update = () =>
      setScale(
        Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H)
      );
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return scale;
}

export default function BoardPage() {
  const params = useParams<{ sessionId: string }>();
  const state = useBoardState(params.sessionId ?? "");
  const scale = useStageScale();
  const [soundOn, setSoundOn] = useState(false);
  const prevKind = useRef<string>("loading");
  const prevCount = useRef(0);

  // Sound cues on state transitions + joins.
  useEffect(() => {
    const kind = state.kind;
    if (kind !== prevKind.current) {
      if (kind === "question") sfx("swoosh");
      if (kind === "reveal") sfx("stinger");
      if (kind === "interstitial") sfx("soft");
      if (kind === "winners") {
        sfx("fanfare");
        boardSynth.startPad();
      }
      if (kind === "lobby") boardSynth.startPad();
      if (prevKind.current === "lobby" && kind !== "lobby") boardSynth.stopPad();
      prevKind.current = kind;
    }
    if (kind === "lobby") {
      if (state.count > prevCount.current && prevCount.current > 0) sfx("join");
      prevCount.current = state.count;
    }
  }, [state]);

  function toggleSound() {
    if (soundOn) {
      boardSynth.disable();
      setSoundOn(false);
    } else {
      boardSynth.enable(); // user gesture — AudioContext allowed
      if (state.kind === "lobby" || state.kind === "winners")
        boardSynth.startPad();
      sfx("soft");
      setSoundOn(true);
    }
  }

  function goFullscreen() {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }

  return (
    <main className="fixed inset-0 overflow-hidden bg-background text-foreground">
      {/* Scaled 1920×1080 stage */}
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: STAGE_W,
          height: STAGE_H,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={state.kind}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0"
          >
            {state.kind === "loading" && (
              <div className="flex h-full items-center justify-center">
                <p className="animate-pulse text-3xl font-semibold text-brand-cyan/70">
                  Loading session…
                </p>
              </div>
            )}
            {state.kind === "not_found" && (
              <div className="flex h-full items-center justify-center">
                <p className="text-3xl font-semibold text-foreground/50">
                  Session not found
                </p>
              </div>
            )}
            {state.kind === "lobby" && <LobbyView state={state} />}
            {state.kind === "question" && <QuestionView state={state} />}
            {state.kind === "reveal" && <RevealView state={state} />}
            {state.kind === "interstitial" && (
              <InterstitialView state={state} />
            )}
            {state.kind === "winners" && <WinnersView state={state} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Operator chrome — outside the stage, always tappable */}
      <div className="fixed bottom-4 left-4 z-50 flex gap-2">
        <button
          type="button"
          onClick={toggleSound}
          className={`rounded-full border px-4 py-2 text-sm font-semibold backdrop-blur transition-colors ${
            soundOn
              ? "border-brand-cyan/50 bg-brand-cyan/15 text-brand-cyan"
              : "border-border-soft bg-surface text-foreground/50 hover:text-foreground/80"
          }`}
        >
          {soundOn ? "🔊 Sound on" : "🔇 Sound"}
        </button>
        <button
          type="button"
          onClick={goFullscreen}
          className="rounded-full border border-border-soft bg-surface px-4 py-2 text-sm font-semibold text-foreground/50 backdrop-blur hover:text-foreground/80"
        >
          ⛶ Fullscreen
        </button>
      </div>
    </main>
  );
}
