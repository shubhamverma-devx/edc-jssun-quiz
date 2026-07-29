import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

// Resolve at request time, never from a build-time snapshot.
export const dynamic = "force-dynamic";

/**
 * Event-day convenience: /board resolves the current live session
 * server-side and redirects to /board/<id> — no UUID typing on the
 * projector laptop.
 */
export default async function BoardIndexPage() {
  const supabase = createAdminClient();
  const { data: session } = await supabase
    .from("sessions")
    .select("id")
    .eq("status", "live")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (session) {
    redirect(`/board/${session.id}`);
  }

  return (
    <main className="bg-grid fixed inset-0 flex items-center justify-center bg-background">
      <div className="text-center">
        <p className="text-[13px] font-semibold uppercase tracking-[0.35em] text-brand-cyan">
          EDC × JSS University Noida
        </p>
        <h1 className="mt-4 text-3xl font-bold text-foreground/80">
          No live session right now
        </h1>
        <p className="mt-3 text-[15px] text-foreground/40">
          Refresh once the host takes a session live.
        </p>
      </div>
    </main>
  );
}
