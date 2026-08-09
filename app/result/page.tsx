"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { motion } from "@/lib/m";
import { createClient } from "@/lib/supabase/client";
import { fadeUp, staggerParent, useEntranceInitial } from "@/lib/motion";

type Me = { name: string; photoUrl: string | null };

const CARD_W = 1080;
const CARD_H = 1350;
// Render at 2× so the shared PNG stays crisp on stories/feeds.
const CARD_SCALE = 2;

const INSTAGRAM_URL = "https://www.instagram.com/edcjssun";
const INSTAGRAM_HANDLE = "@edcjssun";

function siteHost(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env && !env.includes("localhost") && !env.includes("<")) {
    return env.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
  return typeof window !== "undefined" ? window.location.host : "";
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Renders the shareable "I took the quiz" card. Score is deliberately
 * absent — the card celebrates participation, results stay with EDC. */
async function generateCard(me: Me): Promise<Blob | null> {
  await document.fonts.ready;

  const canvas = document.createElement("canvas");
  canvas.width = CARD_W * CARD_SCALE;
  canvas.height = CARD_H * CARD_SCALE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(CARD_SCALE, CARD_SCALE);

  // Deep background with corner vignette
  ctx.fillStyle = "#050508";
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Ambient aurora washes (stronger than before, still tasteful)
  const glow1 = ctx.createRadialGradient(140, 120, 0, 140, 120, 700);
  glow1.addColorStop(0, "rgba(5,177,222,0.20)");
  glow1.addColorStop(1, "rgba(5,177,222,0)");
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const glow2 = ctx.createRadialGradient(940, 1230, 0, 940, 1230, 700);
  glow2.addColorStop(0, "rgba(181,133,240,0.20)");
  glow2.addColorStop(1, "rgba(181,133,240,0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Faint grid
  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= CARD_W; x += 72) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CARD_H);
    ctx.stroke();
  }
  for (let y = 0; y <= CARD_H; y += 72) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CARD_W, y);
    ctx.stroke();
  }

  // Deterministic sparkles (tiny diamonds) in brand colours
  const SPARKS: Array<[number, number, number, string]> = [
    [150, 420, 7, "rgba(5,177,222,0.55)"],
    [935, 350, 9, "rgba(181,133,240,0.5)"],
    [110, 900, 8, "rgba(181,133,240,0.45)"],
    [968, 760, 7, "rgba(5,177,222,0.5)"],
    [220, 1120, 6, "rgba(255,255,255,0.35)"],
    [890, 1050, 6, "rgba(255,255,255,0.3)"],
    [320, 300, 5, "rgba(255,255,255,0.3)"],
    [760, 420, 6, "rgba(5,177,222,0.4)"],
  ];
  for (const [sx, sy, sr, colour] of SPARKS) {
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(sx, sy - sr);
    ctx.quadraticCurveTo(sx, sy, sx + sr, sy);
    ctx.quadraticCurveTo(sx, sy, sx, sy + sr);
    ctx.quadraticCurveTo(sx, sy, sx - sr, sy);
    ctx.quadraticCurveTo(sx, sy, sx, sy - sr);
    ctx.fill();
  }

  // Double frame: gradient outer + hairline inner
  const frameGrad = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  frameGrad.addColorStop(0, "#05B1DE");
  frameGrad.addColorStop(1, "#B585F0");
  ctx.strokeStyle = frameGrad;
  ctx.lineWidth = 5;
  roundedRect(ctx, 34, 34, CARD_W - 68, CARD_H - 68, 46);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1.5;
  roundedRect(ctx, 52, 52, CARD_W - 104, CARD_H - 104, 34);
  ctx.stroke();

  ctx.textAlign = "center";

  // Header
  ctx.fillStyle = "rgba(255,255,255,0.48)";
  ctx.font = "600 28px Poppins, sans-serif";
  ctx.fillText("E D C  ×  J S S  U N I V E R S I T Y  N O I D A", CARD_W / 2, 152);

  // Title with a soft cyan glow
  ctx.save();
  ctx.shadowColor = "rgba(5,177,222,0.55)";
  ctx.shadowBlur = 42;
  ctx.font = "900 94px Poppins, sans-serif";
  const titleGrad = ctx.createLinearGradient(180, 0, 900, 0);
  titleGrad.addColorStop(0, "#05B1DE");
  titleGrad.addColorStop(1, "#B585F0");
  ctx.fillStyle = titleGrad;
  ctx.fillText("ORIENTATION QUIZ", CARD_W / 2, 266);
  ctx.restore();

  // "2026" flanked by thin gradient rules
  ctx.fillStyle = "rgba(255,255,255,0.32)";
  ctx.font = "700 33px Poppins, sans-serif";
  ctx.fillText("2 0 2 6", CARD_W / 2, 328);
  ctx.fillStyle = "rgba(5,177,222,0.45)";
  ctx.fillRect(CARD_W / 2 - 200, 318, 100, 2);
  ctx.fillStyle = "rgba(181,133,240,0.45)";
  ctx.fillRect(CARD_W / 2 + 100, 318, 100, 2);

  // Photo: halo glow → gradient ring → faint outer ring, then the circle
  const cx = CARD_W / 2;
  const cy = 630;
  const r = 190;
  const halo = ctx.createRadialGradient(cx, cy, r - 40, cx, cy, r + 130);
  halo.addColorStop(0, "rgba(5,177,222,0.28)");
  halo.addColorStop(0.6, "rgba(181,133,240,0.14)");
  halo.addColorStop(1, "rgba(181,133,240,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 130, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.strokeStyle = frameGrad;
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  const photo = me.photoUrl ? await loadImage(me.photoUrl) : null;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (photo) {
    // cover-fit the (possibly non-square) photo into the circle
    const s = Math.max((r * 2) / photo.width, (r * 2) / photo.height);
    const dw = photo.width * s;
    const dh = photo.height * s;
    try {
      ctx.drawImage(photo, cx - dw / 2, cy - dh / 2, dw, dh);
    } catch {
      photoFallback(ctx, cx, cy, r, me.name, frameGrad);
    }
  } else {
    photoFallback(ctx, cx, cy, r, me.name, frameGrad);
  }
  ctx.restore();

  // Name with a soft shadow + gradient accent bar under it
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 16;
  ctx.fillStyle = "#f5f6f8";
  ctx.font = "800 70px Poppins, sans-serif";
  const displayName = me.name.length > 22 ? me.name.slice(0, 21) + "…" : me.name;
  ctx.fillText(displayName, CARD_W / 2, 936);
  ctx.restore();
  ctx.fillStyle = frameGrad;
  roundedRect(ctx, CARD_W / 2 - 60, 962, 120, 6, 3);
  ctx.fill();

  // Completed pill — gradient-filled so it pops
  const pillW = 430;
  const pillH = 82;
  ctx.save();
  ctx.shadowColor = "rgba(5,177,222,0.4)";
  ctx.shadowBlur = 26;
  ctx.fillStyle = frameGrad;
  roundedRect(ctx, (CARD_W - pillW) / 2, 1004, pillW, pillH, 41);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#050508";
  ctx.font = "800 33px Poppins, sans-serif";
  ctx.fillText("QUIZ COMPLETED ✓", CARD_W / 2, 1057);

  // Divider with a centre diamond
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(CARD_W / 2 - 300, 1128, 600, 1.5);
  ctx.fillStyle = "rgba(181,133,240,0.6)";
  ctx.beginPath();
  ctx.moveTo(CARD_W / 2, 1121);
  ctx.lineTo(CARD_W / 2 + 8, 1129);
  ctx.lineTo(CARD_W / 2, 1137);
  ctx.lineTo(CARD_W / 2 - 8, 1129);
  ctx.closePath();
  ctx.fill();

  // Tagline + Instagram handle + URL
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "italic 500 31px Poppins, sans-serif";
  ctx.fillText("I showed up. I locked in. Your turn.", CARD_W / 2, 1186);

  // "Results drop on" in white, the handle in gradient — centred together
  ctx.font = "500 30px Poppins, sans-serif";
  const prefix = "Results drop on  ";
  const prefixW = ctx.measureText(prefix).width;
  ctx.font = "800 32px Poppins, sans-serif";
  const handleW = ctx.measureText(INSTAGRAM_HANDLE).width;
  const lineStart = CARD_W / 2 - (prefixW + handleW) / 2;
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "500 30px Poppins, sans-serif";
  ctx.fillText(prefix, lineStart, 1240);
  ctx.fillStyle = frameGrad;
  ctx.font = "800 32px Poppins, sans-serif";
  ctx.fillText(INSTAGRAM_HANDLE, lineStart + prefixW, 1240);
  ctx.textAlign = "center";

  ctx.fillStyle = "rgba(255,255,255,0.32)";
  ctx.font = "600 25px Poppins, sans-serif";
  ctx.fillText(siteHost(), CARD_W / 2, 1288);

  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png")
  );
}

function photoFallback(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  name: string,
  grad: CanvasGradient
) {
  ctx.fillStyle = grad;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  ctx.fillStyle = "#050508";
  ctx.font = "900 150px Poppins, sans-serif";
  ctx.fillText(initials, cx, cy + 52);
}

export default function ResultPage() {
  const router = useRouter();
  const entrance = useEntranceInitial();
  const [me, setMe] = useState<Me | null>(null);
  const [failed, setFailed] = useState(false);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [shareState, setShareState] = useState<"idle" | "saved">("idle");
  const [handleCopied, setHandleCopied] = useState(false);
  const cardBlobRef = useRef<Blob | null>(null);

  async function copyHandle() {
    try {
      await navigator.clipboard.writeText(INSTAGRAM_HANDLE);
      setHandleCopied(true);
      window.setTimeout(() => setHandleCopied(false), 2000);
    } catch {
      // clipboard unavailable — the handle is visible to type anyway
    }
  }

  useEffect(() => {
    const pid = sessionStorage.getItem("edc-quiz-participant-id");
    if (!pid) {
      router.replace("/");
      return;
    }
    async function load(participantId: string) {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("participants")
          .select("name, photo_url")
          .eq("id", participantId)
          .maybeSingle();
        if (!data) throw new Error("missing");
        setMe({ name: data.name, photoUrl: data.photo_url });
      } catch {
        setFailed(true);
      }
    }
    load(pid);
  }, [router]);

  // Render the share card once the participant is loaded.
  useEffect(() => {
    if (!me) return;
    let revoked: string | null = null;
    generateCard(me).then((blob) => {
      if (!blob) return;
      cardBlobRef.current = blob;
      revoked = URL.createObjectURL(blob);
      setCardUrl(revoked);
    });
    return () => {
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [me]);

  async function share() {
    const blob = cardBlobRef.current;
    if (!blob) return;
    const file = new File([blob], "edc-orientation-quiz.png", {
      type: "image/png",
    });
    const text = `I just took the EDC Orientation Quiz at JSS University Noida! Results drop on ${INSTAGRAM_HANDLE} — follow to find out.`;

    // Native share sheet first. iOS Safari can reject files+text together,
    // so retry with the file alone before ever falling back to download.
    // A user cancelling the sheet (AbortError) is NOT a fallback case.
    if (typeof navigator.share === "function") {
      for (const data of [{ files: [file], text }, { files: [file] }]) {
        try {
          if (typeof navigator.canShare !== "function" || navigator.canShare(data)) {
            await navigator.share(data);
            return;
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          // this shape failed — try the next one
        }
      }
    }

    // Desktop browsers (no file share support): save the PNG instead.
    const a = document.createElement("a");
    a.href = cardUrl ?? URL.createObjectURL(blob);
    a.download = "edc-orientation-quiz.png";
    a.click();
    setShareState("saved");
  }

  if (failed) {
    return (
      <main className="bg-grid flex-1">
        <div className="mx-auto flex min-h-dvh w-full max-w-[400px] flex-col items-center justify-center px-5">
          <p className="text-[14px] text-foreground/60">
            Couldn&apos;t load your result. Pull to refresh or re-open the link.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-grid flex-1">
      <motion.div
        variants={staggerParent(0.12, 0.05)}
        initial={entrance}
        animate="show"
        className="mx-auto flex min-h-dvh w-full max-w-[400px] flex-col px-5 pb-10 pt-14"
      >
        <motion.div variants={fadeUp} className="text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.25em] text-brand-cyan/80">
            That&apos;s a wrap
          </p>
          <h1 className="mt-3 text-[32px] font-black tracking-tight">
            {me ? `You did it, ${me.name.split(" ")[0]}!` : "You did it!"}
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-foreground/55">
            Your answers are in. Here&apos;s your entry card —
          </p>
        </motion.div>

        <motion.div variants={fadeUp} className="mt-8">
          {cardUrl ? (
            <motion.img
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
              src={cardUrl}
              alt="Your shareable quiz card"
              className="w-full rounded-card border border-border-soft shadow-[0_20px_60px_rgba(5,177,222,0.15)]"
            />
          ) : (
            <div className="flex aspect-[4/5] w-full items-center justify-center rounded-card border border-border-soft bg-surface">
              <p className="animate-pulse text-[13px] text-foreground/40">
                Making your card…
              </p>
            </div>
          )}
        </motion.div>

        <motion.div variants={fadeUp} className="mt-5">
          <button
            type="button"
            onClick={share}
            disabled={!cardUrl}
            className={`w-full rounded-card bg-gradient-to-r from-brand-cyan to-brand-purple py-4 text-[15px] font-bold text-background transition-opacity disabled:opacity-40 ${
              cardUrl ? "sweep-in" : ""
            }`}
          >
            {shareState === "saved"
              ? "Saved ✓ — post it from your gallery"
              : "Share your card"}
          </button>
        </motion.div>

        {/* What happens next — the winners live on Instagram, so walk them
            there step by step instead of a vague follow link. */}
        <motion.div
          variants={fadeUp}
          className="mt-4 rounded-card border border-border-soft bg-surface p-5"
        >
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.25em] text-brand-purple">
            What happens next?
          </p>

          <ol className="mt-4 space-y-3">
            <NextStep n={1}>
              Post your card on your <strong className="text-foreground">Instagram story</strong>
            </NextStep>
            <NextStep n={2}>
              Tag{" "}
              <button
                type="button"
                onClick={copyHandle}
                className="rounded-md border border-brand-cyan/40 bg-brand-cyan/10 px-1.5 py-0.5 font-bold text-brand-cyan active:scale-95"
              >
                {handleCopied ? "Copied ✓" : INSTAGRAM_HANDLE}
              </button>{" "}
              <span className="text-foreground/40">(tap to copy)</span>
            </NextStep>
            <NextStep n={3}>
              <strong className="text-foreground">Winners are announced there</strong> — not on
              stage, only on our Instagram
            </NextStep>
          </ol>

          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="insta-glow mt-5 flex w-full items-center justify-center gap-2.5 rounded-card py-4 text-[15px] font-bold text-white"
            style={{
              background:
                "linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)",
            }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
              <circle cx="12" cy="12" r="4.5" />
              <circle cx="17.6" cy="6.4" r="1.3" fill="currentColor" stroke="none" />
            </svg>
            Follow {INSTAGRAM_HANDLE}
          </a>
        </motion.div>
        <div className="pb-2 pt-4" />
      </motion.div>
    </main>
  );
}

function NextStep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-cyan to-brand-purple text-[12px] font-extrabold text-background">
        {n}
      </span>
      <span className="text-[13px] leading-relaxed text-foreground/70">
        {children}
      </span>
    </li>
  );
}
