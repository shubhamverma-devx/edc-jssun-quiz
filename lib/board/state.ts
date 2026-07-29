"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type BoardParticipant = {
  id: string;
  name: string;
  photo_url: string | null;
  joined_at: string;
  /** Seconds after the board's orbit epoch this row appeared (0 = initial). */
  orbitDelay?: number;
};

export type BoardQuestion = {
  questionId: string;
  type: "mcq" | "true_false" | "image_identify";
  text: string;
  imageUrl: string | null;
  options: { id: string; text: string | null; imageUrl: string | null }[];
  timeSeconds: number;
  questionNumber: number;
  totalQuestions: number;
  startedAt: number;
  correctIndex?: number;
  explanation?: string | null;
};

export type BoardState =
  | { kind: "loading" }
  | { kind: "not_found" }
  | {
      kind: "lobby";
      participants: BoardParticipant[];
      count: number;
      joinFlash: string | null;
    }
  | {
      kind: "question";
      question: BoardQuestion;
      count: number;
      distribution: Record<number, number>;
      totalAnswered: number;
    }
  | {
      kind: "reveal";
      question: BoardQuestion;
      correctIndex: number;
      explanation: string | null;
      distribution: Record<number, number>;
      totalAnswered: number;
      fastest: { name: string; timeMs: number } | null;
    }
  | { kind: "interstitial"; sessionId: string; count: number }
  | { kind: "winners"; sessionId: string };

type SessionRow = {
  id: string;
  status: string;
  mode: string;
  current_question_index: number | null;
  updated_at: string;
};

/** How long the reveal beat holds before the board moves to standings. */
const REVEAL_HOLD_MS = 6500;

/**
 * The board is dumb: it reflects Supabase state. Session status + index
 * pick the macro state; the question timer (derived from the session's
 * advance timestamp) and answer counts drive question → reveal locally.
 */
export function useBoardState(sessionId: string): BoardState {
  const [session, setSession] = useState<SessionRow | null | undefined>(
    undefined
  );
  const [participants, setParticipants] = useState<BoardParticipant[]>([]);
  const [joinFlash, setJoinFlash] = useState<string | null>(null);
  const [question, setQuestion] = useState<BoardQuestion | null>(null);
  const [distribution, setDistribution] = useState<Record<number, number>>({});
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [revealData, setRevealData] = useState<{
    correctIndex: number;
    explanation: string | null;
    fastest: { name: string; timeMs: number } | null;
  } | null>(null);
  const [phase, setPhase] = useState<"question" | "reveal" | "interstitial">(
    "question"
  );

  const orbitEpochRef = useRef<number | null>(null);
  const flashTimer = useRef<number | null>(null);
  const revealFetchedFor = useRef<string | null>(null);

  useEffect(() => {
    orbitEpochRef.current = Date.now();
    return () => {
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    };
  }, []);

  // ---- session + participants (always on) ----
  useEffect(() => {
    if (!sessionId) return;
    const supabase = createClient();

    supabase
      .from("sessions")
      .select("id, status, mode, current_question_index, updated_at")
      .eq("id", sessionId)
      .maybeSingle()
      .then(({ data }) => setSession(data ?? null));

    supabase
      .from("participants")
      .select("id, name, photo_url, joined_at")
      .eq("session_id", sessionId)
      .order("joined_at", { ascending: true })
      .then(({ data }) => {
        if (data) setParticipants(data);
      });

    const channel = supabase
      .channel(`board-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => setSession(payload.new as SessionRow)
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "participants",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as BoardParticipant;
          const orbitDelay =
            orbitEpochRef.current !== null
              ? (Date.now() - orbitEpochRef.current) / 1000
              : 0;
          setParticipants((prev) =>
            prev.some((p) => p.id === row.id)
              ? prev
              : [...prev, { ...row, orbitDelay }]
          );
          setJoinFlash(row.name);
          if (flashTimer.current) window.clearTimeout(flashTimer.current);
          flashTimer.current = window.setTimeout(() => setJoinFlash(null), 3500);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const index = session?.current_question_index ?? null;
  const status = session?.status ?? null;

  // ---- question payload per index ----
  useEffect(() => {
    // Intentional state-machine resets when the index changes — stale
    // question/distribution must clear before the new fetch lands.
    if (status !== "live" || index === null || index < 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuestion(null);
      return;
    }
    let cancelled = false;
     
    setQuestion(null);
    setDistribution({});
    setTotalAnswered(0);
    setRevealData(null);
    setPhase("question");
    revealFetchedFor.current = null;

    fetch(`/api/board/question?sessionId=${sessionId}&index=${index}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.questionId) {
          setQuestion(data);
          // seed distribution with anything submitted before we loaded
          return fetch(`/api/board/distribution?questionId=${data.questionId}`)
            .then((r) => r.json())
            .then((d) => {
              if (!cancelled && d.counts) {
                setDistribution(d.counts);
                setTotalAnswered(d.totalAnswered ?? 0);
              }
            });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sessionId, status, index]);

  // ---- live distribution: realtime INSERTs on answers for this question ----
  useEffect(() => {
    if (!question) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`board-answers-${question.questionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "answers",
          filter: `question_id=eq.${question.questionId}`,
        },
        (payload) => {
          const row = payload.new as {
            chosen_option_index: number | null;
          };
          if (row.chosen_option_index !== null) {
            const idx = row.chosen_option_index;
            setDistribution((prev) => ({
              ...prev,
              [idx]: (prev[idx] ?? 0) + 1,
            }));
          }
          setTotalAnswered((prev) => prev + 1);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [question]);

  // ---- reconciliation poll: realtime is the fast path, but if answers
  // events are dropped (e.g. table missing from the realtime publication),
  // a slow poll keeps the bars and the early-reveal trigger truthful. ----
  useEffect(() => {
    if (!question || phase !== "question") return;
    const poll = window.setInterval(() => {
      fetch(`/api/board/distribution?questionId=${question.questionId}`)
        .then((r) => r.json())
        .then((d) => {
          if (d.counts) {
            setDistribution(d.counts);
            setTotalAnswered(d.totalAnswered ?? 0);
          }
        })
        .catch(() => {});
    }, 2500);
    return () => window.clearInterval(poll);
  }, [question, phase]);

  // ---- question → reveal: timer expiry OR everyone answered ----
  const triggerReveal = useCallback(() => {
    if (!question || revealFetchedFor.current === question.questionId) return;
    revealFetchedFor.current = question.questionId;
    Promise.all([
      fetch(
        `/api/board/question?sessionId=${sessionId}&index=${question.questionNumber - 1}&reveal=true`
      ).then((r) => r.json()),
      fetch(`/api/board/distribution?questionId=${question.questionId}`).then(
        (r) => r.json()
      ),
    ])
      .then(([q, d]) => {
        setRevealData({
          correctIndex: q.correctIndex ?? 0,
          explanation: q.explanation ?? null,
          fastest: d.fastest ?? null,
        });
        if (d.counts) {
          setDistribution(d.counts);
          setTotalAnswered(d.totalAnswered ?? 0);
        }
        setPhase("reveal");
      })
      .catch(() => {
        revealFetchedFor.current = null;
      });
  }, [question, sessionId]);

  useEffect(() => {
    if (!question || phase !== "question") return;
    const check = window.setInterval(() => {
      const expired =
        Date.now() > question.startedAt + question.timeSeconds * 1000;
      if (expired) triggerReveal();
    }, 250);
    return () => window.clearInterval(check);
  }, [question, phase, triggerReveal]);

  // Early reveal: every fresher in the room has answered.
  useEffect(() => {
    if (!question || phase !== "question") return;
    if (participants.length > 0 && totalAnswered >= participants.length) {
      triggerReveal();
    }
  }, [question, phase, totalAnswered, participants.length, triggerReveal]);

  // ---- reveal → interstitial after the hold ----
  useEffect(() => {
    if (phase !== "reveal") return;
    const t = window.setTimeout(() => setPhase("interstitial"), REVEAL_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [phase]);

  // ---- derive the public state ----
  if (session === undefined) return { kind: "loading" };
  if (session === null) return { kind: "not_found" };
  if (status === "ended") return { kind: "winners", sessionId };
  if (status !== "live") return { kind: "not_found" };

  if (index === null || index < 0) {
    return {
      kind: "lobby",
      participants,
      count: participants.length,
      joinFlash,
    };
  }

  if (!question) return { kind: "loading" };

  if (phase === "reveal" && revealData) {
    return {
      kind: "reveal",
      question,
      correctIndex: revealData.correctIndex,
      explanation: revealData.explanation,
      distribution,
      totalAnswered,
      fastest: revealData.fastest,
    };
  }
  if (phase === "interstitial") {
    return { kind: "interstitial", sessionId, count: participants.length };
  }

  return {
    kind: "question",
    question,
    count: participants.length,
    distribution,
    totalAnswered,
  };
}
