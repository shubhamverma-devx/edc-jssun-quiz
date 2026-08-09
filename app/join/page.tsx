"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "@/lib/m";
import ProgressSteps from "@/components/progress-steps";
import { fadeDown, fadeUp, staggerParent, useEntranceInitial } from "@/lib/motion";

// Intentionally basic — reject obvious typos only, not enforce RFC 5322.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const PHONE_RE = /^\+?\d{10,15}$/;

// Phone field accepts digits only (plus an optional leading +) — everything
// else a keyboard or autofill inserts is stripped the moment it lands.
function sanitizePhone(v: string): string {
  return v
    .replace(/[^\d+]/g, "")
    .replace(/(?!^)\+/g, "")
    .slice(0, 16);
}

type Field = "name" | "email" | "phone";

const isValid: Record<Field, (v: string) => boolean> = {
  name: (v) => v.trim().length >= 2 && v.trim().length <= 60,
  email: (v) => EMAIL_RE.test(v.trim()) && v.trim().length <= 254,
  phone: (v) => PHONE_RE.test(v.trim()),
};

const ERROR_TEXT: Record<Field, string> = {
  name: "Enter at least 2 characters",
  email: "Enter a valid email",
  phone: "Enter a valid phone number",
};

function ErrorMsg({ field, show }: { field: Field; show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="mt-1.5 text-[12px] text-red-400"
        >
          {ERROR_TEXT[field]}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

export default function JoinPage() {
  const router = useRouter();
  const entrance = useEntranceInitial();
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  const [values, setValues] = useState<Record<Field, string>>({
    name: "",
    email: "",
    phone: "",
  });
  const [touched, setTouched] = useState<Record<Field, boolean>>({
    name: false,
    email: false,
    phone: false,
  });
  const [isComposing, setIsComposing] = useState(false);
  const [checking, setChecking] = useState(false);

  const canContinue = (Object.keys(isValid) as Field[]).every((f) =>
    isValid[f](values[f])
  );

  // Native-event fallback + polling reconciler on ALL fields. Two failure
  // modes covered: mobile keyboards that skip React's synthetic events, and
  // silent DOM writes from autofill (iOS "Autofill Contact" fills email +
  // phone together with zero events). 200ms poll reconciles both.
  useEffect(() => {
    const els = [nameRef.current, emailRef.current, phoneRef.current];
    if (els.some((el) => !el)) return;

    const sync = () => {
      // Enforce digits-only in the phone field at the DOM level so even
      // silent autofill writes get cleaned.
      const rawPhone = phoneRef.current?.value ?? "";
      const cleanPhone = sanitizePhone(rawPhone);
      if (phoneRef.current && cleanPhone !== rawPhone) {
        phoneRef.current.value = cleanPhone;
      }
      const next = {
        name: nameRef.current?.value ?? "",
        email: emailRef.current?.value ?? "",
        phone: cleanPhone,
      };
      setValues((prev) =>
        prev.name === next.name &&
        prev.email === next.email &&
        prev.phone === next.phone
          ? prev
          : next
      );
    };

    const events = ["input", "change", "keyup", "focus", "blur"];
    for (const el of els)
      for (const ev of events) el!.addEventListener(ev, sync);
    const pollId = window.setInterval(sync, 200);
    sync(); // fields may be prefilled before hydration

    return () => {
      for (const el of els)
        for (const ev of events) el?.removeEventListener(ev, sync);
      window.clearInterval(pollId);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isComposing || checking) return;
    // The DOM is the source of truth — read refs directly, then re-validate.
    const finalValues = {
      name: (nameRef.current?.value ?? "").trim(),
      email: (emailRef.current?.value ?? "").trim(),
      phone: sanitizePhone((phoneRef.current?.value ?? "").trim()),
    };
    setTouched({ name: true, email: true, phone: true });
    if (!(Object.keys(isValid) as Field[]).every((f) => isValid[f](finalValues[f])))
      return;

    sessionStorage.setItem("edc-quiz-name", finalValues.name);
    sessionStorage.setItem("edc-quiz-email", finalValues.email);
    sessionStorage.setItem("edc-quiz-phone", finalValues.phone);

    // Returning student? Same email/phone means they already have an entry —
    // finished goes straight to their result, mid-quiz resumes where they
    // left off. Lookup failures fall through to the normal photo flow.
    setChecking(true);
    try {
      const res = await fetch("/api/participants/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: finalValues.email,
          phone: finalValues.phone,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.found) {
        sessionStorage.setItem("edc-quiz-participant-id", data.participantId);
        sessionStorage.setItem("edc-quiz-session-id", data.sessionId);
        router.replace(data.finished ? "/result" : "/quiz");
        return;
      }
    } catch {
      // network hiccup — continue as a new join
    }
    setChecking(false);
    router.push("/join/photo");
  }

  function fieldClasses(field: Field) {
    const showError =
      touched[field] && values[field].trim() !== "" && !isValid[field](values[field]);
    return {
      input: `w-full rounded-card border bg-surface px-4 py-4 text-[16px] font-medium text-foreground placeholder:text-foreground/30 outline-none transition-[border-color,box-shadow] duration-200 ${
        showError
          ? "border-red-500/60 focus:border-red-500 focus:shadow-[0_0_0_3px_rgba(255,75,75,0.12)]"
          : "border-border-soft focus:border-brand-cyan/60 focus:shadow-[0_0_0_3px_rgba(5,177,222,0.13)]"
      }`,
      showError,
    };
  }

  const markTouched = (field: Field) => () =>
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));

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
            href="/"
            aria-label="Back to home"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border-soft bg-surface text-foreground/70 transition-colors hover:text-foreground"
          >
            ←
          </Link>
          <div className="flex-1">
            <ProgressSteps current={1} />
          </div>
        </motion.header>

        <motion.form
          variants={staggerParent(0.08, 0.1)}
          initial={entrance}
          animate="show"
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col pt-10"
        >
          <motion.h1
            variants={fadeUp}
            className="text-[28px] font-extrabold leading-tight tracking-tight"
          >
            Let&apos;s get you in
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="mt-2 text-[13px] leading-relaxed text-foreground/55"
          >
            We&apos;ll only use email/phone to contact winners about the
            interview.
          </motion.p>

          <div className="mt-7 space-y-4">
            <motion.div
              variants={fadeUp}
              className={`field-wrap ${fieldClasses("name").showError ? "shake-once" : ""}`}
            >
              <input
                ref={nameRef}
                autoFocus
                type="text"
                maxLength={60}
                placeholder="Your name"
                name="display-name"
                autoComplete="off"
                autoCapitalize="words"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
                enterKeyHint="next"
                onBlur={markTouched("name")}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                className={fieldClasses("name").input}
              />
              <ErrorMsg field="name" show={fieldClasses("name").showError} />
            </motion.div>

            <motion.div
              variants={fadeUp}
              className={`field-wrap ${fieldClasses("email").showError ? "shake-once" : ""}`}
            >
              {/* Autofill is WANTED here — do not set autoComplete="off" */}
              <input
                ref={emailRef}
                type="email"
                maxLength={254}
                placeholder="you@example.com"
                autoComplete="email"
                inputMode="email"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                onBlur={markTouched("email")}
                className={fieldClasses("email").input}
              />
              <ErrorMsg field="email" show={fieldClasses("email").showError} />
            </motion.div>

            <motion.div
              variants={fadeUp}
              className={`field-wrap ${fieldClasses("phone").showError ? "shake-once" : ""}`}
            >
              <input
                ref={phoneRef}
                type="tel"
                maxLength={16}
                placeholder="9876543210"
                autoComplete="tel"
                inputMode="tel"
                enterKeyHint="done"
                onBlur={markTouched("phone")}
                className={fieldClasses("phone").input}
              />
              <ErrorMsg field="phone" show={fieldClasses("phone").showError} />
            </motion.div>
          </div>

          <motion.div variants={fadeUp} className="mt-auto pt-10">
            <button
              type="submit"
              disabled={!canContinue || checking}
              className={`block w-full rounded-card bg-gradient-to-r from-brand-cyan to-brand-purple py-4 text-center text-[15px] font-bold text-background transition-opacity disabled:opacity-30 ${
                canContinue && !checking ? "sweep-in" : ""
              }`}
            >
              {checking ? "Checking…" : "Continue →"}
            </button>
          </motion.div>
        </motion.form>
      </div>
    </main>
  );
}
