"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { ArrowUp, Check, Gauge, Plus, Sparkles } from "lucide-react";
import styles from "./PromptInput.module.css";

export interface SpeedTier {
  id: string;
  name: string;
  desc: string;
}

export const SPEED_TIERS: SpeedTier[] = [
  {
    id: "fast",
    name: "Fast",
    desc: "Snappy replies for quick questions and everyday tasks.",
  },
  {
    id: "balanced",
    name: "Balanced",
    desc: "A middle ground — thoughtful answers without the wait.",
  },
  {
    id: "deep",
    name: "Deep",
    desc: "Takes its time on complex, multi-step work.",
  },
];

/** M16 creative commands surfaced when the composer starts with "/". */
export const CREATIVE_COMMANDS = [
  { id: "/imagine", desc: "Make an image from your words." },
  { id: "/animate", desc: "Turn an idea into a short video." },
  { id: "/zap", desc: "A quick, kinetic video clip." },
] as const;

export interface PromptInputProps {
  value: string;
  onChange: (next: string) => void;
  onSend: () => void;
  busy?: boolean;
  placeholder?: string;
  tier: string;
  onTierChange: (tier: string) => void;
  /** Display-only model labels per tier id, server-supplied via /api/me. */
  tierModels?: Partial<Record<string, string>>;
}

export function PromptInput({
  value,
  onChange,
  onSend,
  busy,
  placeholder = "Message your agent…",
  tier,
  onTierChange,
  tierModels,
}: PromptInputProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoveredTier, setHoveredTier] = useState<string | null>(null);
  const [paletteDismissed, setPaletteDismissed] = useState(false);
  const plusRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  const sendActive = value.trim().length > 0 && !busy;

  // Command palette: typing "/" at the start of the composer lists the
  // creative commands; anything past the first word closes it.
  const paletteMatches = /^\/[a-z]*$/i.test(value)
    ? CREATIVE_COMMANDS.filter((c) =>
        c.id.startsWith(value.toLowerCase())
      )
    : [];
  const paletteOpen = !paletteDismissed && paletteMatches.length > 0;

  useEffect(() => {
    if (!/^\/[a-z]*$/i.test(value)) setPaletteDismissed(false);
  }, [value]);

  // Auto-grow the textarea up to its CSS max-height.
  useEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = Math.min(field.scrollHeight, 160) + "px";
  }, [value]);

  // Dismiss the "+" menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!plusRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) setHoveredTier(null);
  }, [menuOpen]);

  const onKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (paletteOpen && e.key === "Escape") {
      e.preventDefault();
      setPaletteDismissed(true);
      return;
    }
    const first = paletteMatches[0];
    if (paletteOpen && first && (e.key === "Tab" || e.key === "Enter")) {
      e.preventDefault();
      onChange(`${first.id} `);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (sendActive) onSend();
    }
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.frame} data-busy={busy || undefined}>
        {paletteOpen && (
          <div className={styles.palette} role="menu" aria-label="Commands">
            <div className={styles.menuLabel}>
              <Sparkles size={12} aria-hidden />
              Create
            </div>
            {paletteMatches.map((c) => (
              <button
                key={c.id}
                type="button"
                role="menuitem"
                className={styles.menuItem}
                onClick={() => {
                  onChange(`${c.id} `);
                  fieldRef.current?.focus();
                }}
              >
                <span className={styles.menuName}>{c.id}</span>
                <span className={styles.paletteDesc}>{c.desc}</span>
              </button>
            ))}
          </div>
        )}
        <textarea
          ref={fieldRef}
          className={styles.field}
          rows={1}
          placeholder={placeholder}
          aria-label={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={busy}
        />

        <div className={styles.row}>
          <div className={styles.plusWrap} ref={plusRef}>
            <button
              type="button"
              className={[styles.iconBtn, styles.plus].join(" ")}
              data-open={menuOpen || undefined}
              aria-label="Choose speed"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              <span className={styles.plusIcon}>
                <Plus size={14} />
              </span>
            </button>

            {menuOpen && (
              <div className={styles.menu} role="menu">
                <div className={styles.menuLabel}>
                  <Gauge size={12} aria-hidden />
                  Speed &amp; intelligence
                </div>
                {SPEED_TIERS.map((t) => (
                  <div
                    key={t.id}
                    className={styles.menuSub}
                    onMouseEnter={() => setHoveredTier(t.id)}
                    onMouseLeave={() => setHoveredTier(null)}
                  >
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={tier === t.id}
                      className={styles.menuItem}
                      onClick={() => {
                        onTierChange(t.id);
                        setMenuOpen(false);
                      }}
                    >
                      <span className={styles.menuName}>{t.name}</span>
                      {tier === t.id && (
                        <span className={styles.menuCheck}>
                          <Check size={14} />
                        </span>
                      )}
                    </button>
                    {hoveredTier === t.id && (
                      <div className={styles.menuPopover} role="tooltip">
                        <div className={styles.popoverTitle}>{t.name}</div>
                        <p className={styles.popoverDesc}>{t.desc}</p>
                        {tierModels?.[t.id] && (
                          <p className={styles.popoverModel}>{tierModels[t.id]}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            className={[styles.iconBtn, styles.send, sendActive ? styles.sendActive : ""]
              .filter(Boolean)
              .join(" ")}
            aria-label="Send"
            disabled={!sendActive}
            onClick={onSend}
          >
            <ArrowUp size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
