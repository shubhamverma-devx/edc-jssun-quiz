"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion } from "@/lib/m";
import ProgressSteps from "@/components/progress-steps";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";
import { getOrCreateDeviceId } from "@/lib/device-id";
import { fadeDown, fadeUp, staggerParent, useEntranceInitial } from "@/lib/motion";

type Stage = "choose" | "preview" | "uploading" | "no-session" | "error";

const RING_R = 30;
const RING_C = 2 * Math.PI * RING_R;

export default function JoinPhotoPage() {
  const router = useRouter();
  const entrance = useEntranceInitial();
  const [name, setName] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("choose");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Must have name + contact info from step 1.
  useEffect(() => {
    const stored = sessionStorage.getItem("edc-quiz-name");
    const email = sessionStorage.getItem("edc-quiz-email");
    const phone = sessionStorage.getItem("edc-quiz-phone");
    if (!stored || !email || !phone) {
      router.replace("/join");
      return;
    }
    // sessionStorage is client-only, so it can't be a useState initializer
    // (would mismatch the server-rendered HTML on hydration).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(stored);
  }, [router]);

  // Clean up the preview object URL on unmount.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPhoto(file);
      setPreviewUrl(URL.createObjectURL(file));
      setStage("preview");
    }
    e.target.value = "";
  }

  function retake() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPhoto(null);
    setPreviewUrl(null);
    setErrorMessage(null);
    setStage("choose");
  }

  async function handleContinue() {
    if (!photo || !name) return;
    setStage("uploading");
    setProgress(0);
    try {
      const uploaded = await uploadToCloudinary(
        photo,
        "edc-quiz/participants",
        setProgress
      );

      const res = await fetch("/api/participants/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email: sessionStorage.getItem("edc-quiz-email"),
          phone: sessionStorage.getItem("edc-quiz-phone"),
          photoUrl: uploaded.secureUrl,
          photoPublicId: uploaded.publicId,
          deviceId: getOrCreateDeviceId(),
        }),
      });
      const data = await res.json().catch(() => null);

      if (res.ok && data?.participantId) {
        // Fresh identity → fresh scoreboard (clears any stale score/streak
        // left in this tab from a previous session).
        for (const key of ["edc-quiz-score", "edc-quiz-streak", "edc-quiz-feedback"]) {
          sessionStorage.removeItem(key);
        }
        sessionStorage.setItem("edc-quiz-participant-id", data.participantId);
        sessionStorage.setItem("edc-quiz-session-id", data.sessionId);
        router.push("/quiz");
        return;
      }
      if (res.status === 409 && data?.error === "no_live_session") {
        setStage("no-session");
        return;
      }
      throw new Error("Could not join the session. Please try again.");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong."
      );
      setStage("error");
    }
  }

  return (
    <main className="bg-grid flex-1">
      <div className="mx-auto flex min-h-dvh w-full max-w-[400px] flex-col px-5 pb-10 pt-6">
        <motion.header
          variants={fadeDown}
          initial={entrance}
          animate="show"
          className="flex items-center gap-4"
        >
          <Link
            href="/join"
            aria-label="Back to name entry"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border-soft bg-surface text-foreground/70 transition-colors hover:text-foreground"
          >
            ←
          </Link>
          <div className="flex-1">
            <ProgressSteps current={2} />
          </div>
        </motion.header>

        <motion.div
          variants={staggerParent(0.08, 0.05)}
          initial={entrance}
          animate="show"
          className="flex flex-1 flex-col pt-12"
        >
          <motion.h1
            variants={fadeUp}
            className="text-[28px] font-extrabold leading-tight tracking-tight"
          >
            Add your photo
          </motion.h1>
          <motion.p variants={fadeUp} className="mt-2 text-[13px] text-foreground/55">
            Goes on the smart-board wall as you join.
          </motion.p>

          {stage === "choose" && (
            <>
              {/* One button, one native sheet: iOS/Android offer
                  Take Photo · Photo Library · Choose File themselves.
                  NO capture attribute — on iOS Safari it forces the
                  camera directly and skips the sheet entirely. */}
              <motion.button
                variants={fadeUp}
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="float-idle mt-8 rounded-card border border-brand-cyan/40 bg-brand-cyan/10 py-8 text-center transition-colors hover:bg-brand-cyan/15"
              >
                <span className="text-2xl">📸</span>
                <span className="mt-2 block text-[16px] font-bold text-brand-cyan">
                  Add photo
                </span>
                <span className="mt-1 block text-[12px] font-medium text-foreground/45">
                  Camera · Gallery · Files
                </span>
              </motion.button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelected}
                className="hidden"
              />
            </>
          )}

          {(stage === "preview" || stage === "uploading") && previewUrl && (
            <motion.div
              initial={{ opacity: 0, scale: 1.06 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
              className="mt-8 flex flex-col items-center"
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-card border border-border-soft">
                {/* Local object URL — next/image not applicable */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Your photo preview"
                  className="h-full w-full object-cover"
                />
                {/* Upload progress: circular ring over the dimmed photo */}
                {stage === "uploading" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[2px]"
                  >
                    <svg viewBox="0 0 72 72" className="h-20 w-20 -rotate-90">
                      <circle cx="36" cy="36" r={RING_R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="5" />
                      <circle
                        cx="36"
                        cy="36"
                        r={RING_R}
                        fill="none"
                        stroke="#05b1de"
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeDasharray={RING_C}
                        strokeDashoffset={RING_C * (1 - progress)}
                        style={{ transition: "stroke-dashoffset 200ms linear" }}
                      />
                    </svg>
                    <p className="mt-3 text-[13px] font-semibold text-foreground/80">
                      Uploading…
                    </p>
                  </motion.div>
                )}
              </div>

              {stage === "preview" && (
                <div className="mt-5 grid w-full grid-cols-2 gap-3">
                  <motion.button
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                    type="button"
                    onClick={retake}
                    className="rounded-card border border-border-soft bg-surface py-3.5 text-[14px] font-semibold text-foreground/70"
                  >
                    Retake
                  </motion.button>
                  <button
                    type="button"
                    onClick={handleContinue}
                    className="sweep-in rounded-card bg-gradient-to-r from-brand-cyan to-brand-purple py-3.5 text-[14px] font-bold text-background"
                  >
                    Continue →
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {stage === "no-session" && (
            <div className="mt-8 rounded-card border border-award/25 bg-award/10 p-5 text-center">
              <p className="text-[15px] font-bold text-award">
                The quiz hasn&apos;t started yet.
              </p>
              <p className="mt-1 text-[13px] text-foreground/60">
                Check back later.
              </p>
              <button
                type="button"
                onClick={handleContinue}
                className="mt-4 rounded-card border border-border-soft bg-surface px-6 py-2.5 text-[13px] font-semibold text-foreground/80"
              >
                Retry
              </button>
            </div>
          )}

          {stage === "error" && (
            <div className="mt-8 rounded-card border border-red-500/25 bg-red-500/10 p-5 text-center">
              <p className="text-[15px] font-bold text-red-400">
                Something went wrong
              </p>
              <p className="mt-1 break-words text-[13px] text-foreground/60">
                {errorMessage}
              </p>
              <div className="mt-4 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={retake}
                  className="rounded-card border border-border-soft bg-surface px-5 py-2.5 text-[13px] font-semibold text-foreground/70"
                >
                  Start over
                </button>
                <button
                  type="button"
                  onClick={handleContinue}
                  className="rounded-card bg-gradient-to-r from-brand-cyan to-brand-purple px-5 py-2.5 text-[13px] font-bold text-background"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </main>
  );
}
