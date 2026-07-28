"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Participant = {
  id: string;
  name: string;
  photo_url: string | null;
  joined_at: string;
};

type SessionRow = {
  id: string;
  status: string;
  current_question_index: number | null;
};

export default function WaitingPage() {
  const router = useRouter();
  const [ids, setIds] = useState<{
    participantId: string;
    sessionId: string;
  } | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Guard: must have joined first.
  useEffect(() => {
    const pid = sessionStorage.getItem("edc-quiz-participant-id");
    const sid = sessionStorage.getItem("edc-quiz-session-id");
    if (!pid || !sid) {
      router.replace("/join");
      return;
    }
    // sessionStorage is client-only, so it can't be a useState initializer
    // (would mismatch the server-rendered HTML on hydration).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIds({ participantId: pid, sessionId: sid });
  }, [router]);

  // Initial fetch + realtime subscription.
  useEffect(() => {
    if (!ids) return;
    const { sessionId } = ids;
    const supabase = createClient();

    supabase
      .from("participants")
      .select("id, name, photo_url, joined_at")
      .eq("session_id", sessionId)
      .order("joined_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          setLoadError(error.message || "Could not load the room.");
        } else if (data) {
          setParticipants(data);
        }
      });

    const channel = supabase
      .channel(`waiting-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "participants",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as Participant;
          setParticipants((prev) =>
            prev.some((p) => p.id === row.id) ? prev : [...prev, row]
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const session = payload.new as SessionRow;
          // Host advanced the quiz — move everyone in.
          if (
            session.status === "live" &&
            session.current_question_index !== null &&
            session.current_question_index >= 0
          ) {
            router.push("/quiz");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ids, router]);

  const me = useMemo(
    () => participants.find((p) => p.id === ids?.participantId) ?? null,
    [participants, ids]
  );
  const collage = useMemo(() => participants.slice(-8).reverse(), [participants]);

  if (!ids) return null;

  return (
    <main className="bg-grid flex-1">
      <div className="mx-auto flex min-h-dvh w-full max-w-[400px] flex-col px-5 pb-10 pt-6">
        <header className="flex items-center justify-between">
          <span className="flex items-center gap-2 rounded-full border border-green-500/25 bg-green-500/10 px-3 py-1.5 text-[11px] font-semibold text-green-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
            Live
          </span>
          <span className="rounded-full border border-border-soft bg-surface px-3 py-1.5 text-[11px] font-medium text-foreground/50">
            Session #{ids.sessionId.slice(0, 8)}
          </span>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center text-center">
          {me?.photo_url ? (
            <Image
              src={me.photo_url}
              alt={me.name}
              width={96}
              height={96}
              className="h-24 w-24 rounded-full border-2 border-brand-cyan/60 object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-brand-cyan/60 bg-surface text-3xl font-extrabold text-brand-cyan">
              {(me?.name ?? "?").charAt(0).toUpperCase()}
            </div>
          )}
          <p className="mt-4 text-lg font-bold">{me?.name ?? "You"}</p>
          <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.2em] text-brand-cyan">
            You&apos;re in the room
          </p>

          <p className="mt-10 bg-gradient-to-r from-brand-cyan to-brand-purple bg-clip-text text-7xl font-black text-transparent">
            {participants.length}
          </p>
          <p className="mt-1 text-[13px] font-medium text-foreground/50">
            {participants.length === 1 ? "fresher" : "freshers"} in the room
          </p>

          <p className="mt-8 max-w-[280px] text-[13px] leading-relaxed text-foreground/45">
            Quiz starts when the host signals. Look up at the smart board.
          </p>

          {loadError && (
            <p className="mt-6 rounded-card border border-red-500/25 bg-red-500/10 px-4 py-2 text-[12px] text-red-400/90">
              {loadError}
            </p>
          )}
        </div>

        {collage.length > 0 && (
          <div className="flex flex-col items-center gap-3 pb-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/35">
              Just joined
            </p>
            <div className="flex -space-x-2.5">
              {collage.map((p) =>
                p.photo_url ? (
                  <Image
                    key={p.id}
                    src={p.photo_url}
                    alt={p.name}
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-full border-2 border-background object-cover"
                  />
                ) : (
                  <div
                    key={p.id}
                    className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-background bg-surface text-sm font-bold text-brand-purple"
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
