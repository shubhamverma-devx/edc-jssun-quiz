"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import ProgressSteps from "@/components/progress-steps";
import { uploadToCloudinary } from "@/lib/cloudinary/upload";
import { getOrCreateDeviceId } from "@/lib/device-id";

type Stage =
  | "choose"
  | "camera"
  | "preview"
  | "uploading"
  | "no-session"
  | "error";

export default function JoinPhotoPage() {
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("choose");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [cameraNote, setCameraNote] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Must have a name from step 1.
  useEffect(() => {
    const stored = sessionStorage.getItem("edc-quiz-name");
    if (!stored) {
      router.replace("/join");
      return;
    }
    // sessionStorage is client-only, so it can't be a useState initializer
    // (would mismatch the server-rendered HTML on hydration).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(stored);
  }, [router]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  // Clean up camera + object URLs on unmount.
  useEffect(() => {
    return () => {
      stopCamera();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openCamera() {
    setCameraNote(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      setStage("camera");
      // Video element mounts on the next render.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch {
      setCameraNote("Camera unavailable — use Upload instead.");
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;

    // Center-crop a square from the video frame.
    const side = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - side) / 2;
    const sy = (video.videoHeight - side) / 2;

    const canvas = document.createElement("canvas");
    const size = Math.min(side, 800);
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, sx, sy, side, side, 0, 0, size, size);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        stopCamera();
        setPhotoBlob(blob);
      },
      "image/jpeg",
      0.9
    );
  }

  function setPhotoBlob(blob: Blob) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPhoto(blob);
    setPreviewUrl(URL.createObjectURL(blob));
    setStage("preview");
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setPhotoBlob(file);
    e.target.value = "";
  }

  function retake() {
    stopCamera();
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
          photoUrl: uploaded.secureUrl,
          photoPublicId: uploaded.publicId,
          deviceId: getOrCreateDeviceId(),
        }),
      });
      const data = await res.json().catch(() => null);

      if (res.ok && data?.participantId) {
        sessionStorage.setItem("edc-quiz-participant-id", data.participantId);
        sessionStorage.setItem("edc-quiz-session-id", data.sessionId);
        router.push("/waiting");
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
        <header className="flex items-center gap-4">
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
        </header>

        <div className="flex flex-1 flex-col pt-12">
          <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">
            Add your photo
          </h1>
          <p className="mt-2 text-[13px] text-foreground/55">
            Goes on the smart-board wall as you join.
          </p>

          {stage === "choose" && (
            <>
              <div className="mt-8 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={openCamera}
                  className="rounded-card border border-brand-cyan/40 bg-brand-cyan/10 py-6 text-center text-[14px] font-bold text-brand-cyan transition-colors hover:bg-brand-cyan/15"
                >
                  📷
                  <span className="mt-2 block">Take photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-card border border-brand-purple/40 bg-brand-purple/10 py-6 text-center text-[14px] font-bold text-brand-purple transition-colors hover:bg-brand-purple/15"
                >
                  🖼️
                  <span className="mt-2 block">Upload</span>
                </button>
              </div>
              {cameraNote && (
                <p className="mt-4 text-center text-[12px] text-award">
                  {cameraNote}
                </p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelected}
                className="hidden"
              />
            </>
          )}

          {stage === "camera" && (
            <div className="mt-8 flex flex-col items-center">
              <div className="aspect-square w-full overflow-hidden rounded-card border border-border-soft bg-black">
                {/* Live camera feed, mirrored like a selfie */}
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="h-full w-full -scale-x-100 object-cover"
                />
              </div>
              <div className="mt-5 grid w-full grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={retake}
                  className="rounded-card border border-border-soft bg-surface py-3.5 text-[14px] font-semibold text-foreground/70"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="rounded-card bg-gradient-to-r from-brand-cyan to-brand-purple py-3.5 text-[14px] font-bold text-background"
                >
                  Capture
                </button>
              </div>
            </div>
          )}

          {(stage === "preview" || stage === "uploading") && previewUrl && (
            <div className="mt-8 flex flex-col items-center">
              <div className="aspect-square w-full overflow-hidden rounded-card border border-border-soft">
                {/* Local object URL — next/image not applicable */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Your photo preview"
                  className="h-full w-full object-cover"
                />
              </div>

              {stage === "preview" ? (
                <div className="mt-5 grid w-full grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={retake}
                    className="rounded-card border border-border-soft bg-surface py-3.5 text-[14px] font-semibold text-foreground/70"
                  >
                    Retake
                  </button>
                  <button
                    type="button"
                    onClick={handleContinue}
                    className="rounded-card bg-gradient-to-r from-brand-cyan to-brand-purple py-3.5 text-[14px] font-bold text-background"
                  >
                    Continue →
                  </button>
                </div>
              ) : (
                <div className="mt-5 w-full">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-cyan to-brand-purple transition-[width] duration-200"
                      style={{ width: `${Math.round(progress * 100)}%` }}
                    />
                  </div>
                  <p className="mt-3 text-center text-[13px] font-medium text-foreground/60">
                    Uploading…
                  </p>
                </div>
              )}
            </div>
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
        </div>
      </div>
    </main>
  );
}
