"use client";

/**
 * MA10 prompt bar for app surfaces. Posts one message to the owner's agent
 * (MAIN_SESSION) with metadata { app, resource, surface: "miniapp" }, then
 * calls onDone so the view refetches its normal agent-backed state — the
 * agent never learns mini-apps as a special subsystem. Renders nothing for
 * guests/anonymous visitors: /api/mini/agent requires the owner's store
 * session and refuses everyone else.
 */
import { useState } from "react";

export function PromptBar({
  app,
  resource = "default",
  onDone,
}: {
  app: string;
  resource?: string;
  onDone?: (runId: string) => void;
}) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");

  async function send() {
    const message = text.trim();
    if (!message) return;
    setStatus("working");
    const res = await fetch("/api/mini/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app, resource, text: message }),
    });
    if (!res.ok) {
      setStatus("error");
      return;
    }
    const data = (await res.json()) as { run_id: string };
    setText("");
    setStatus("idle");
    onDone?.(data.run_id);
  }

  return (
    <div className="flex w-full items-center gap-2">
      <input
        className="input flex-1"
        type="text"
        placeholder="Ask your agent…"
        value={text}
        maxLength={4000}
        disabled={status === "working"}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void send();
        }}
      />
      <button
        className="btn"
        disabled={status === "working" || !text.trim()}
        onClick={() => void send()}
      >
        {status === "working" ? "Working…" : "Send"}
      </button>
      {status === "error" ? (
        <span className="text-[11px] text-muted">try again</span>
      ) : null}
    </div>
  );
}
