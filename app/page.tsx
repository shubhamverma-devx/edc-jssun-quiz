import { Suspense } from "react";
import LandingContent from "@/components/landing-content";
import { createAdminClient } from "@/lib/supabase/admin";

export default function Home() {
  return (
    <LandingContent
      connectionSlot={
        <Suspense
          fallback={
            <span className="rounded-full border border-border-soft bg-surface px-4 py-1.5 text-[11px] text-foreground/40">
              Checking connection…
            </span>
          }
        >
          <ConnectionStatus />
        </Suspense>
      }
    />
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
