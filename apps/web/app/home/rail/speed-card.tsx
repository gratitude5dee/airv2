"use client";

/**
 * Right rail: Speed & Intelligence tier picker + monthly spend meter
 * (extracted verbatim from the old page.tsx right rail in the redesign
 * phase-1 split).
 */

interface Entitlement {
  plan: string;
  speed_tier: string;
  model_family?: string;
  tier_models?: { fast: string; balanced: string; deep: string };
  family_models?: Record<string, string>;
  monthly_cap_usd: number;
  spend_mtd_usd: number;
}

/** Families in picker order; Ox Alpha is the default anyone lands on. */
export const MODEL_FAMILY_OPTIONS = [
  ["ox-alpha", "Ox Alpha"],
  ["openai", "OpenAI"],
  ["inkling", "Inkling (free)"],
  ["inkling-small", "Inkling Small (free)"],
] as const;

export function SpeedCard({
  tier,
  onTierChange,
  family,
  onFamilyChange,
  entitlement,
}: {
  tier: string;
  onTierChange: (next: string) => void;
  family: string;
  onFamilyChange: (next: string) => void;
  entitlement: Entitlement | null;
}) {
  const spendPct = entitlement
    ? Math.min(
        100,
        (Number(entitlement.spend_mtd_usd) /
          Math.max(1e-9, Number(entitlement.monthly_cap_usd))) *
          100
      )
    : 0;

  return (
    <div className="panel">
      <h3 className="mt-0 text-[15px] font-semibold">Speed &amp; Intelligence</h3>
      <div className="grid gap-1.5">
        {(
          [
            ["fast", "Fast"],
            ["balanced", "Balanced"],
            ["deep", "Deep"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className={
              "seg rounded-lg" +
              (tier === id
                ? " pill-active"
                : " shadow-[0_0_0_0.5px_var(--ring)]")
            }
            onClick={() => onTierChange(id)}
          >
            {label}
            {entitlement?.tier_models ? (
              <span
                className={
                  "block text-[11px] font-normal " +
                  (tier === id ? "opacity-70" : "text-[var(--muted)]")
                }
              >
                {entitlement.tier_models[id]}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <h3 className="mb-1.5 mt-4 text-[15px] font-semibold">Model</h3>
      <div className="grid gap-1.5">
        {MODEL_FAMILY_OPTIONS.map(([id, label]) => (
          <button
            key={id}
            className={
              "seg rounded-lg" +
              (family === id
                ? " pill-active"
                : " shadow-[0_0_0_0.5px_var(--ring)]")
            }
            onClick={() => onFamilyChange(id)}
          >
            {label}
            {entitlement?.family_models?.[id] ? (
              <span
                className={
                  "block text-[11px] font-normal " +
                  (family === id ? "opacity-70" : "text-[var(--muted)]")
                }
              >
                {entitlement.family_models[id]}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      {entitlement ? (
        <div className="mt-3">
          <div
            className="h-2 overflow-hidden rounded-full bg-surface-2"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(spendPct)}
            aria-label="Monthly spend"
          >
            <div
              className="h-full rounded-full bg-accent [background-image:radial-gradient(circle,rgba(255,255,255,0.55)_0.7px,transparent_1.2px)] [background-size:4px_4px] transition-[width] duration-500"
              style={{ width: `${spendPct}%` }}
            />
          </div>
          <p className="muted mb-0 mt-2 text-[12px]">
            ${Number(entitlement.spend_mtd_usd).toFixed(2)} of $
            {Number(entitlement.monthly_cap_usd).toFixed(2)} used this month
          </p>
        </div>
      ) : null}
    </div>
  );
}
