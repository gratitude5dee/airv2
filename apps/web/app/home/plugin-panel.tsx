"use client";

/**
 * MA2.4 Settings surface for plugin sign-in: approve a device code shown by
 * a plugin (Codex / Claude Code) and manage (revoke) issued tokens. Owner
 * session only — the API rejects anything else.
 */
import { useCallback, useEffect, useState } from "react";

interface PluginToken {
  id: string;
  tool: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

const TOOL_LABELS: Record<string, string> = {
  codex: "Codex",
  "claude-code": "Claude Code",
  other: "Other tool",
};

export function PluginPanel() {
  const [tokens, setTokens] = useState<PluginToken[]>([]);
  const [code, setCode] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/settings/plugins").catch(() => null);
    if (!res || !res.ok) return;
    const data = (await res.json().catch(() => ({}))) as {
      tokens?: PluginToken[];
    };
    setTokens(data.tokens ?? []);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const act = useCallback(
    async (body: Record<string, string>, okNote: string) => {
      setBusy(true);
      setNote(null);
      const res = await fetch("/api/settings/plugins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => null);
      setBusy(false);
      if (!res || !res.ok) {
        const data = res
          ? ((await res.json().catch(() => ({}))) as { error?: string })
          : {};
        setNote(data.error ?? "request failed");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { tool?: string };
      setNote(
        data.tool
          ? `${okNote} (${TOOL_LABELS[data.tool] ?? data.tool})`
          : okNote
      );
      setCode("");
      void refresh();
    },
    [refresh]
  );

  const active = tokens.filter((t) => !t.revoked_at);

  return (
    <div className="panel">
      <h3 className="mt-0 text-[15px] font-semibold">Plugin sign-in</h3>
      <p className="muted my-1 text-[12px]">
        Enter the code shown by a WZRD.Tech plugin (Codex, Claude Code) to
        connect it to your account.
      </p>
      <div className="mt-2 flex gap-2">
        <input
          className="input"
          placeholder="XXXX-XXXX"
          value={code}
          maxLength={9}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
        />
        <button
          className="btn !px-3 !py-1.5 !text-[12px]"
          disabled={busy || code.trim().length < 9}
          onClick={() =>
            void act({ action: "approve", user_code: code.trim() }, "approved")
          }
        >
          Approve
        </button>
        <button
          className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
          disabled={busy || code.trim().length < 9}
          onClick={() =>
            void act({ action: "deny", user_code: code.trim() }, "denied")
          }
        >
          Deny
        </button>
      </div>
      {active.length > 0 ? (
        <div className="mt-3 grid gap-1.5">
          {active.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-1.5 text-[12px]"
            >
              <span>
                {TOOL_LABELS[t.tool] ?? t.tool}
                <span className="text-[var(--muted)]">
                  {" "}
                  · connected {new Date(t.created_at).toLocaleDateString()}
                </span>
              </span>
              <button
                className="btn btn-ghost !px-2.5 !py-1 !text-[12px]"
                disabled={busy}
                onClick={() =>
                  void act({ action: "revoke", token_id: t.id }, "revoked")
                }
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      ) : null}
      {note ? <p className="muted mb-0 mt-2 text-[12px]">{note}</p> : null}
    </div>
  );
}
