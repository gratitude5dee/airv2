"use client";

/**
 * History — read-only conversation list + transcripts (extracted verbatim
 * from the old page.tsx history tab in the redesign phase-1 split; now
 * self-contained).
 */
import { useEffect, useRef, useState } from "react";
import { Orb } from "@/components/orb/Orb";
import { boxErrorNote, pickList } from "../lib";

interface SessionSummary {
  session_id?: string;
  id?: string;
  title?: string;
  platform?: string;
  updated_at?: string;
  created_at?: string;
  message_count?: number;
}

interface TranscriptMessage {
  role: string;
  content: string;
}

/** History channel chips (V8): each maps to session platform values. */
const HISTORY_CHANNELS = ["imessage", "web", "schedule", "bot"] as const;
type HistoryChannel = (typeof HISTORY_CHANNELS)[number] | "all";

export function HistoryPanel({ active }: { active: boolean }) {
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [panelNote, setPanelNote] = useState<string | null>(null);
  const [panelFailed, setPanelFailed] = useState(false);
  const panelLoadId = useRef(0);
  // V8 History: title search, channel chips, transcript view, delete.
  const [historySearch, setHistorySearch] = useState("");
  const [historyChannel, setHistoryChannel] = useState<HistoryChannel>("all");
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const transcriptLoadId = useRef(0);
  const [transcript, setTranscript] = useState<TranscriptMessage[] | null>(null);
  const [transcriptNote, setTranscriptNote] = useState<string | null>(null);
  const [sessionBusy, setSessionBusy] = useState<string | null>(null);

  async function loadHistory() {
    const loadId = ++panelLoadId.current;
    setPanelFailed(false);
    setPanelNote("Waking your agent… this can take a minute if it was asleep.");
    try {
      const res = await fetch("/api/box/api/sessions?limit=30");
      if (res.ok) {
        const list = pickList<SessionSummary>(await res.json(), [
          "sessions",
          "data",
          "items",
        ]);
        if (loadId !== panelLoadId.current) return;
        setSessions(list);
        setPanelNote(null);
      } else {
        if (loadId !== panelLoadId.current) return;
        setPanelNote(boxErrorNote(res.status, "history"));
        setPanelFailed(true);
      }
    } catch {
      if (loadId !== panelLoadId.current) return;
      setPanelNote("Couldn't load history — try again shortly.");
      setPanelFailed(true);
    }
  }

  useEffect(() => {
    if (active && sessions === null) void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // V8 History: read-only transcript for one session, through the exact
  // allowlisted /api/box/api/sessions/{id}/messages path.
  async function openSession(id: string) {
    const loadId = ++transcriptLoadId.current;
    setOpenSessionId(id);
    setTranscript(null);
    setTranscriptNote("Loading transcript…");
    try {
      const res = await fetch(
        `/api/box/api/sessions/${encodeURIComponent(id)}/messages`
      );
      if (loadId !== transcriptLoadId.current) return;
      if (res.ok) {
        const list = pickList<{ role?: string; content?: string }>(
          await res.json(),
          ["data", "messages", "items"]
        );
        if (loadId !== transcriptLoadId.current) return;
        setTranscript(
          list
            .filter(
              (m) =>
                (m.role === "user" || m.role === "assistant") &&
                typeof m.content === "string" &&
                m.content.trim() !== ""
            )
            .map((m) => ({
              role: m.role === "user" ? "user" : "agent",
              content: (m.content ?? "").trim(),
            }))
        );
        setTranscriptNote(null);
      } else {
        setTranscriptNote(boxErrorNote(res.status, "the transcript"));
      }
    } catch {
      if (loadId !== transcriptLoadId.current) return;
      setTranscriptNote("Couldn't load the transcript — try again shortly.");
    }
  }

  async function deleteSession(id: string) {
    setSessionBusy(id);
    try {
      const res = await fetch(
        `/api/box/api/sessions/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setSessions((s) =>
          (s ?? []).filter((row) => (row.session_id ?? row.id) !== id)
        );
        if (openSessionId === id) {
          setOpenSessionId(null);
          setTranscript(null);
        }
      } else {
        setPanelNote(boxErrorNote(res.status, "that conversation"));
      }
    } catch {
      setPanelNote("Couldn't delete — try again shortly.");
    } finally {
      setSessionBusy(null);
    }
  }

  if (!active) return null;

  return (
    <div className="grid flex-1 content-start gap-2 overflow-y-auto">
      <h3 className="m-0 text-[15px] font-semibold">Conversations</h3>
      <input
        className="input !py-1.5 !text-[13px]"
        placeholder="Search titles…"
        value={historySearch}
        onChange={(e) => setHistorySearch(e.target.value)}
        aria-label="Search conversations by title"
      />
      <div className="flex flex-wrap items-center gap-1">
        {(["all", ...HISTORY_CHANNELS] as const).map((channel) => (
          <button
            key={channel}
            className={
              "seg !px-3 !py-1 !text-[12px]" +
              (historyChannel === channel ? " pill-active" : "")
            }
            aria-pressed={historyChannel === channel}
            onClick={() => setHistoryChannel(channel)}
          >
            {channel === "all" ? "All" : channel}
          </button>
        ))}
      </div>
      {panelNote ? (
        <div className="flex items-center gap-2 py-1">
          <Orb pill label={panelNote} />
          {panelFailed ? (
            <button
              className="btn !px-3 !py-1.5 !text-[12px]"
              onClick={() => void loadHistory()}
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
      {(sessions ?? [])
        .filter((s) => {
          const q = historySearch.trim().toLowerCase();
          if (q && !(s.title ?? "").toLowerCase().includes(q)) {
            return false;
          }
          if (historyChannel !== "all") {
            return (s.platform ?? "").toLowerCase() === historyChannel;
          }
          return true;
        })
        .map((s, i) => {
          const sid = s.session_id ?? s.id;
          const open = sid != null && openSessionId === sid;
          return (
            <div key={sid ?? i} className="panel rise-in !p-3">
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  className="min-w-0 cursor-pointer border-0 bg-transparent p-0 text-left"
                  disabled={sid == null}
                  aria-expanded={open}
                  onClick={() => {
                    if (sid == null) return;
                    if (open) {
                      setOpenSessionId(null);
                      setTranscript(null);
                      setTranscriptNote(null);
                    } else {
                      void openSession(sid);
                    }
                  }}
                >
                  <strong className="text-[13px]">{s.title ?? "Untitled"}</strong>
                  <p className="muted m-0 mt-1 text-[12px]">
                    {[
                      s.platform,
                      s.updated_at ?? s.created_at,
                      s.message_count != null
                        ? `${s.message_count} messages`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </button>
                {sid != null ? (
                  <button
                    className="btn btn-ghost shrink-0 !px-2.5 !py-1 !text-[12px]"
                    disabled={sessionBusy !== null}
                    onClick={() => void deleteSession(sid)}
                  >
                    {sessionBusy === sid ? "Deleting…" : "Delete"}
                  </button>
                ) : null}
              </div>
              {open ? (
                <div className="mt-2 grid max-h-72 gap-1.5 overflow-y-auto border-t border-[var(--ring)] pt-2">
                  {transcriptNote ? <Orb pill label={transcriptNote} /> : null}
                  {(transcript ?? []).map((m, j) => (
                    <div
                      key={j}
                      className={
                        "max-w-[90%] whitespace-pre-wrap rounded-lg px-2.5 py-1.5 text-[12px] leading-relaxed " +
                        (m.role === "user"
                          ? "justify-self-end bg-[var(--text)] text-[var(--bg)]"
                          : "justify-self-start bg-surface-2")
                      }
                    >
                      {m.content}
                    </div>
                  ))}
                  {transcript !== null && transcript.length === 0 ? (
                    <p className="muted m-0 text-[12px]">
                      No messages in this conversation.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      {sessions !== null && sessions.length === 0 ? (
        <p className="muted text-[13px]">No conversations yet.</p>
      ) : null}
    </div>
  );
}
