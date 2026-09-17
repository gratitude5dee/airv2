import "./app.css";
import { useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { cn, useAirState, useLite } from "@kit/air";
import "@kit/beautiful/foundation";
import TyperText from "@kit/arlan/typer";
import { ValuePill } from "@kit/beautiful/value-pill";

/**
 * tool — an owner utility with a list and an add row (recipe 03 shape).
 * State is the owner's useAirState document ("items"); guests read it and
 * every write is refused with "Guests are read-only." (the hook's message),
 * after which the controls hide. The Planner replaces COPY and the item
 * shape; rows stay 44px, inputs 16px, and the only motion is the saved line.
 */
const COPY = {
  title: "Checklist",
  kicker: "Today",
  placeholder: "Add…",
  add: "Add",
  clear: "Clear done",
  empty: "Nothing yet.",
  saved: "Saved.",
};

interface Item {
  id: string;
  text: string;
  done: boolean;
}

function App() {
  const lite = useLite();
  const { state, update, canWrite, error, status } = useAirState<{ items: Item[] }>({ items: [] }); // resource: items
  const [draft, setDraft] = useState("");
  const [savedAt, setSavedAt] = useState(0);
  const readOnly = canWrite === false;
  const remaining = state.items.filter((i) => !i.done).length;

  const saved = (ok: boolean) => {
    if (ok) setSavedAt(Date.now());
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim().slice(0, 120);
    if (!text) return;
    setDraft("");
    saved(await update((s) => ({ items: [...s.items, { id: `${Date.now().toString(36)}`, text, done: false }] })));
  };

  const toggle = async (id: string) => {
    saved(await update((s) => ({ items: s.items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)) })));
  };

  const clearDone = async () => {
    saved(await update((s) => ({ items: s.items.filter((i) => !i.done) })));
  };

  return (
    <div className={cn("frame", lite && "lite")}>
      <header className="bar">
        <span className="app-pill">{COPY.kicker}</span>
        <ValuePill tone={remaining === 0 ? "green" : "accent"}>{remaining} left</ValuePill>
      </header>
      <main className="app">
        {error && (
          <p className="notice" role="status" data-test="error">
            {error}
          </p>
        )}
        <section className="panel">
          <h1 data-test="title">{COPY.title}</h1>
          {status === "loading" && <p className="muted">Loading…</p>}
          {status !== "loading" && state.items.length === 0 && <p className="muted" data-test="empty">{COPY.empty}</p>}
          <ul className="list" data-test="items">
            {state.items.map((it) => (
              <li key={it.id}>
                <label className="item">
                  <input type="checkbox" checked={it.done} disabled={readOnly} onChange={() => void toggle(it.id)} data-test={`toggle-${it.id}`} />
                  <span className={cn("grow", it.done && "done")}>{it.text}</span>
                </label>
              </li>
            ))}
          </ul>
          {!readOnly && (
            <form className="addrow" onSubmit={(e) => void add(e)}>
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={COPY.placeholder}
                maxLength={120}
                aria-label={COPY.add}
                data-test="new"
              />
              <button type="submit" data-test="add">
                {COPY.add}
              </button>
            </form>
          )}
          <div className="row actions">
            {!readOnly && state.items.some((i) => i.done) && (
              <button className="ghost" onClick={() => void clearDone()} data-test="clear-done">
                {COPY.clear}
              </button>
            )}
            {savedAt > 0 && (
              <span className="muted saved" data-test="saved" aria-live="polite">
                <TyperText key={savedAt} text={COPY.saved} play="in" />
              </span>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
