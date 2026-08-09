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

  // Background + faint grid
  ctx.fillStyle = "#050508";
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.strokeStyle = "rgba(255,255,255,0.035)";
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

  // Ambient glows
  const glow1 = ctx.createRadialGradient(180, 160, 0, 180, 160, 620);
  glow1.addColorStop(0, "rgba(5,177,222,0.16)");
  glow1.addColorStop(1, "rgba(5,177,222,0)");
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  const glow2 = ctx.createRadialGradient(920, 1200, 0, 920, 1200, 620);
  glow2.addColorStop(0, "rgba(181,133,240,0.15)");
  glow2.addColorStop(1, "rgba(181,133,240,0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Gradient frame
  const frameGrad = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  frameGrad.addColorStop(0, "#05B1DE");
  frameGrad.addColorStop(1, "#B585F0");
  ctx.strokeStyle = frameGrad;
  ctx.lineWidth = 4;
  roundedRect(ctx, 36, 36, CARD_W - 72, CARD_H - 72, 44);
  ctx.stroke();

  ctx.textAlign = "center";

  // Header
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "600 30px Poppins, sans-serif";
  ctx.fillText("E D C  ×  J S S  U N I V E R S I T Y  N O I D A", CARD_W / 2, 156);

  ctx.font = "900 92px Poppins, sans-serif";
  const titleGrad = ctx.createLinearGradient(200, 0, 880, 0);
  titleGrad.addColorStop(0, "#05B1DE");
  titleGrad.addColorStop(1, "#B585F0");
  ctx.fillStyle = titleGrad;
  ctx.fillText("ORIENTATION QUIZ", CARD_W / 2, 268);

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = "700 34px Poppins, sans-serif";
  ctx.fillText("2 0 2 6", CARD_W / 2, 330);

  // Photo (ring + circle clip), initials fallback
  const cx = CARD_W / 2;
  const cy = 640;
  const r = 185;
  ctx.save();
  ctx.strokeStyle = frameGrad;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 14, 0, Math.PI * 2);
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

  // Name
  ctx.fillStyle = "#f5f6f8";
  ctx.font = "800 68px Poppins, sans-serif";
  const displayName = me.name.length > 22 ? me.name.slice(0, 21) + "…" : me.name;
  ctx.fillText(displayName, CARD_W / 2, 940);

  // Completed pill
  const pillW = 420;
  const pillH = 84;
  roundedRect(ctx, (CARD_W - pillW) / 2, 986, pillW, pillH, 42);
  ctx.fillStyle = "rgba(5,177,222,0.12)";
  ctx.fill();
  ctx.strokeStyle = "rgba(5,177,222,0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#05B1DE";
  ctx.font = "700 34px Poppins, sans-serif";
  ctx.fillText("QUIZ COMPLETED ✓", CARD_W / 2, 1040);

  // Tagline + Instagram handle + URL
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "500 32px Poppins, sans-serif";
  ctx.fillText("I showed up. I locked in. Your turn.", CARD_W / 2, 1140);
  ctx.fillStyle = "#05B1DE";
  ctx.font = "700 32px Poppins, sans-serif";
  ctx.fillText(`Results drop on ${INSTAGRAM_HANDLE}`, CARD_W / 2, 1206);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = "600 26px Poppins, sans-serif";
  ctx.fillText(siteHost(), CARD_W / 2, 1262);

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
  const cardBlobRef = useRef<Blob | null>(null);

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
    try {
      if (
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({ files: [file], text });
        return;
      }
    } catch {
      // share sheet dismissed — fall through to download
    }
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
            Your answers are in. Winners will be announced on our Instagram —
            follow{" "}
            <span className="font-semibold text-brand-cyan">
              {INSTAGRAM_HANDLE}
            </span>{" "}
            so you don&apos;t miss it.
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

        <motion.div variants={fadeUp} className="mt-auto pt-8">
          <button
            type="button"
            onClick={share}
            disabled={!cardUrl}
            className={`w-full rounded-card bg-gradient-to-r from-brand-cyan to-brand-purple py-4 text-[15px] font-bold text-background transition-opacity disabled:opacity-40 ${
              cardUrl ? "sweep-in" : ""
            }`}
          >
            {shareState === "saved" ? "Card saved ✓" : "Share your card"}
          </button>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-card border border-border-soft bg-surface py-3.5 text-[13px] font-bold text-foreground/85 transition-colors hover:border-brand-purple/50 hover:text-foreground"
          >
            <span aria-hidden>📸</span>
            Follow {INSTAGRAM_HANDLE} for the results
          </a>
          <p className="mt-3 text-center text-[11px] text-foreground/35">
            Post your card on your story and tag {INSTAGRAM_HANDLE}.
          </p>
        </motion.div>
      </motion.div>
    </main>
  );
}
