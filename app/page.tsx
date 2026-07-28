import Link from "next/link";
import { Suspense } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

const WHAT_WE_DO = [
  "Startup competitions and pitch events",
  "Workshops on entrepreneurship and innovation",
  "Mentorship for student founders",
  "Industry connect and networking",
];

const STATS = [
  { value: "500+", label: "Students" },
  { value: "50+", label: "Events" },
  { value: "20+", label: "Startups" },
];

export default function Home() {
  return (
    <main className="bg-grid flex-1">
      <div className="mx-auto flex min-h-dvh w-full max-w-[400px] flex-col px-5 pb-10 pt-12">
        {/* Brand tag */}
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-brand-cyan">
          EDC × JSS University Noida
        </p>

        {/* Hero */}
        <h1 className="mt-5 text-[40px] font-extrabold leading-[1.12] tracking-tight">
          Show what you know.
          <br />
          <span className="bg-gradient-to-r from-brand-cyan to-brand-purple bg-clip-text text-transparent">
            Win an interview.
          </span>
        </h1>

        {/* Amber callout */}
        <div className="mt-7 rounded-card border border-award/25 bg-award/10 p-4">
          <p className="text-sm font-semibold text-award">
            Top 3 = Direct entry
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-foreground/70">
            Skip the entire selection round.
          </p>
        </div>

        {/* About EDC */}
        <section className="mt-10">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/50">
            About EDC
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed text-foreground/75">
            The Entrepreneurship Development Cell at JSS University fosters
            innovation, creativity, and the entrepreneurial spirit among
            students.
          </p>
        </section>

        {/* What We Do */}
        <section className="mt-8">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/50">
            What We Do
          </h2>
          <ul className="mt-4 space-y-3">
            {WHAT_WE_DO.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-[5px] text-[9px] leading-none text-award"
                >
                  ◆
                </span>
                <span className="text-[14px] leading-relaxed text-foreground/85">
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Stats */}
        <section className="mt-9 grid grid-cols-3 gap-3">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="rounded-card-sm border border-border-soft bg-surface p-4 text-center"
            >
              <p className="text-xl font-extrabold text-brand-cyan">
                {stat.value}
              </p>
              <p className="mt-1 text-[11px] font-medium text-foreground/55">
                {stat.label}
              </p>
            </div>
          ))}
        </section>

        {/* CTA */}
        <div className="mt-10">
          <Link
            href="/join"
            className="block w-full rounded-card bg-gradient-to-r from-brand-cyan to-brand-purple py-4 text-center text-[15px] font-bold text-background transition-opacity hover:opacity-90"
          >
            Get started →
          </Link>
          <p className="mt-3 text-center text-[11px] text-foreground/40">
            By joining, you agree to fair play.
          </p>
        </div>

        {/* Connection verification */}
        <div className="mt-auto flex justify-center pt-12">
          <Suspense
            fallback={
              <span className="rounded-full border border-border-soft bg-surface px-4 py-1.5 text-[11px] text-foreground/40">
                Checking connection…
              </span>
            }
          >
            <ConnectionStatus />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

async function fetchAdminCount(): Promise<
  { ok: true; count: number } | { ok: false; message: string }
> {
  try {
    const supabase = createAdminClient();
    const { count, error } = await supabase
      .from("admins")
      .select("*", { count: "exact", head: true });

    if (error) {
      return {
        ok: false,
        message:
          error.message || "query rejected — check table grants / RLS policies",
      };
    }
    return { ok: true, count: count ?? 0 };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

async function ConnectionStatus() {
  const result = await fetchAdminCount();

  if (!result.ok) {
    return (
      <span className="rounded-full border border-red-500/25 bg-red-500/10 px-4 py-1.5 text-[11px] font-medium text-red-400/80">
        ✕ Supabase connection failed: {result.message}
      </span>
    );
  }

  return (
    <span className="rounded-full border border-green-500/25 bg-green-500/10 px-4 py-1.5 text-[11px] font-medium text-green-400/80">
      ✓ Connected to Supabase ({result.count} admin
      {result.count === 1 ? "" : "s"} registered)
    </span>
  );
}
