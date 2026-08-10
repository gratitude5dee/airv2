"use client";

/**
 * /studio/brand — the brand kit editor (CM0). Edits the structured source;
 * saving recompiles all three targets in a single write (CC11): the box
 * theme, BRAND.md, and brand.tokens.json.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { BrandSource } from "@/lib/brand/types";

const EMPTY: BrandSource = {
  name: "",
  label: "",
  palette: { background: "#0b0b0c", midground: "#f2ede3", foreground: "#e0553a" },
  typography: {},
  layout: {},
  voice: {},
  claims: {},
  imagery: {},
  markets: [],
};

function joinList(items: string[] | undefined): string {
  return (items ?? []).join(", ");
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

export default function BrandPage() {
  const router = useRouter();
  const [source, setSource] = useState<BrandSource | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/brand")
      .then(async (res) => {
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        if (!res.ok) {
          setNote("Couldn't load your brand kit — try again shortly.");
          setSource(EMPTY);
          return;
        }
        const data = (await res.json()) as { brand: { source: BrandSource } | null };
        setSource(data.brand?.source ?? EMPTY);
      })
      .catch(() => {
        setNote("Couldn't load your brand kit — try again shortly.");
        setSource(EMPTY);
      });
  }, [router]);

  const save = useCallback(async () => {
    if (!source || busy) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/brand", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        mirrored?: boolean;
      };
      if (!res.ok) {
        setNote(data.error ?? "Save failed — try again shortly.");
      } else {
        setNote(
          data.mirrored
            ? "Saved — your agent has the new brand."
            : "Saved — your agent picks it up next time its computer wakes."
        );
      }
    } catch {
      setNote("Save failed — try again shortly.");
    } finally {
      setBusy(false);
    }
  }, [source, busy]);

  if (!source) {
    return (
      <main className="mx-auto w-full max-w-[760px] px-4 py-8">
        <p className="muted text-[13px]">Loading brand kit…</p>
      </main>
    );
  }

  const set = (patch: Partial<BrandSource>) => setSource({ ...source, ...patch });

  const paletteEntries = Object.entries(source.palette);

  return (
    <main className="mx-auto w-full max-w-[760px] px-4 pb-10">
      <header className="flex items-center justify-between py-4">
        <h1 className="m-0 text-[19px] font-semibold tracking-[-0.02em]">Brand kit</h1>
        <button className="btn !px-4 !py-2 !text-[13px]" onClick={() => void save()} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      </header>
      {note ? <p className="muted mb-3 text-[13px]">{note}</p> : null}

      <section className="panel mb-4 grid gap-3 !p-4">
        <h2 className="m-0 text-[15px] font-semibold">Identity</h2>
        <label className="grid gap-1 text-[13px]">
          Name (slug)
          <input
            className="input"
            value={source.name}
            placeholder="northwind"
            onChange={(e) => set({ name: e.target.value })}
          />
        </label>
        <label className="grid gap-1 text-[13px]">
          Label
          <input
            className="input"
            value={source.label}
            placeholder="Northwind Supply"
            onChange={(e) => set({ label: e.target.value })}
          />
        </label>
      </section>

      <section className="panel mb-4 grid gap-3 !p-4">
        <h2 className="m-0 text-[15px] font-semibold">Palette</h2>
        {paletteEntries.map(([key, value]) => (
          <label key={key} className="grid gap-1 text-[13px]">
            {key}
            <div className="flex items-center gap-2">
              <input
                className="input flex-1"
                value={typeof value === "string" ? value : value.hex}
                onChange={(e) =>
                  set({
                    palette: {
                      ...source.palette,
                      // Preserve the object shape (and its alpha) when the
                      // existing entry carries one.
                      [key]:
                        typeof value === "string"
                          ? e.target.value
                          : { ...value, hex: e.target.value },
                    },
                  })
                }
              />
              <span
                className="inline-block h-6 w-6 rounded-full shadow-[0_0_0_0.5px_var(--ring)]"
                style={{
                  background: typeof value === "string" ? value : value.hex,
                }}
              />
            </div>
          </label>
        ))}
      </section>

      <section className="panel mb-4 grid gap-3 !p-4">
        <h2 className="m-0 text-[15px] font-semibold">Typography</h2>
        <label className="grid gap-1 text-[13px]">
          Sans font stack
          <input
            className="input"
            value={source.typography?.fontSans ?? ""}
            onChange={(e) =>
              set({ typography: { ...source.typography, fontSans: e.target.value } })
            }
          />
        </label>
        <label className="grid gap-1 text-[13px]">
          Display font stack
          <input
            className="input"
            value={source.typography?.fontDisplay ?? ""}
            onChange={(e) =>
              set({ typography: { ...source.typography, fontDisplay: e.target.value } })
            }
          />
        </label>
      </section>

      <section className="panel mb-4 grid gap-3 !p-4">
        <h2 className="m-0 text-[15px] font-semibold">Voice</h2>
        <label className="grid gap-1 text-[13px]">
          Register
          <input
            className="input"
            value={source.voice?.register ?? ""}
            placeholder="plainspoken, dry, never exclamatory"
            onChange={(e) => set({ voice: { ...source.voice, register: e.target.value } })}
          />
        </label>
        <label className="grid gap-1 text-[13px]">
          Person
          <input
            className="input"
            value={source.voice?.person ?? ""}
            placeholder="first person plural"
            onChange={(e) => set({ voice: { ...source.voice, person: e.target.value } })}
          />
        </label>
        <label className="grid gap-1 text-[13px]">
          Banned words (comma-separated)
          <input
            className="input"
            value={joinList(source.voice?.banned)}
            placeholder="game-changing, revolutionize, unlock"
            onChange={(e) =>
              set({ voice: { ...source.voice, banned: splitList(e.target.value) } })
            }
          />
        </label>
      </section>

      <section className="panel mb-4 grid gap-3 !p-4">
        <h2 className="m-0 text-[15px] font-semibold">Claims</h2>
        <label className="grid gap-1 text-[13px]">
          Allowed (comma-separated)
          <input
            className="input"
            value={joinList(source.claims?.allowed)}
            placeholder="made in Portland, 10-year warranty"
            onChange={(e) =>
              set({ claims: { ...source.claims, allowed: splitList(e.target.value) } })
            }
          />
        </label>
        <label className="grid gap-1 text-[13px]">
          Forbidden (comma-separated)
          <input
            className="input"
            value={joinList(source.claims?.forbidden)}
            placeholder="organic, medical-grade, #1"
            onChange={(e) =>
              set({ claims: { ...source.claims, forbidden: splitList(e.target.value) } })
            }
          />
        </label>
        <label className="grid gap-1 text-[13px]">
          Requires legal review (comma-separated)
          <input
            className="input"
            value={joinList(source.claims?.requiresLegal)}
            placeholder="free shipping, lifetime"
            onChange={(e) =>
              set({
                claims: { ...source.claims, requiresLegal: splitList(e.target.value) },
              })
            }
          />
        </label>
      </section>

      <section className="panel mb-4 grid gap-3 !p-4">
        <h2 className="m-0 text-[15px] font-semibold">Imagery</h2>
        <label className="grid gap-1 text-[13px]">
          Prefer (comma-separated)
          <input
            className="input"
            value={joinList(source.imagery?.do)}
            placeholder="overcast daylight, matte surfaces"
            onChange={(e) =>
              set({ imagery: { ...source.imagery, do: splitList(e.target.value) } })
            }
          />
        </label>
        <label className="grid gap-1 text-[13px]">
          Avoid (comma-separated)
          <input
            className="input"
            value={joinList(source.imagery?.avoid)}
            placeholder="lens flare, confetti"
            onChange={(e) =>
              set({ imagery: { ...source.imagery, avoid: splitList(e.target.value) } })
            }
          />
        </label>
      </section>

      <section className="panel grid gap-3 !p-4">
        <h2 className="m-0 text-[15px] font-semibold">Markets</h2>
        <label className="grid gap-1 text-[13px]">
          Markets (comma-separated country codes)
          <input
            className="input"
            value={joinList(source.markets)}
            placeholder="US, CA"
            onChange={(e) => set({ markets: splitList(e.target.value) })}
          />
        </label>
      </section>
    </main>
  );
}
