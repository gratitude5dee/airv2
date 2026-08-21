"use client";

/**
 * Blocking consent pop-up for the free Inkling endpoints. Nothing is saved
 * until Agree is pressed; the two TML links open in a new tab. D10 dialog
 * lifecycle (focus trap, Esc, focus restore).
 */
import { INKLING_CONSENT } from "@/lib/entitlements/inkling";
import { useDialogFocus } from "../use-dialog";

export function InklingConsentDialog({
  familyLabel,
  onAgree,
  onCancel,
}: {
  familyLabel: string;
  onAgree: () => void;
  onCancel: () => void;
}) {
  const ref = useDialogFocus<HTMLDivElement>(onCancel);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={`${familyLabel} terms`}
        className="panel rise-in max-w-[520px] !p-4"
      >
        <h3 className="mt-0 text-[15px] font-semibold">
          Before switching to {familyLabel}
        </h3>
        <p className="text-[12px] leading-relaxed">
          {INKLING_CONSENT.map((segment, i) =>
            segment.href ? (
              <a
                key={i}
                href={segment.href}
                target="_blank"
                rel="noopener"
                className="underline"
              >
                {segment.text}
              </a>
            ) : (
              <span key={i}>{segment.text}</span>
            )
          )}
        </p>
        <div className="mt-3 flex justify-end gap-2">
          <button className="btn btn-ghost !text-[12px]" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn !text-[12px]" onClick={onAgree}>
            Agree &amp; switch
          </button>
        </div>
      </div>
    </div>
  );
}
