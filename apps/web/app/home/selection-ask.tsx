"use client";

/**
 * Selection action for the chat log: highlight any text in the conversation
 * and a floating "Ask air" chip appears over the selection; clicking it
 * quotes the highlighted text into the composer so the next message carries
 * that context.
 */
import { useEffect, useState, type RefObject } from "react";

const MAX_QUOTE_CHARS = 1000;

export function SelectionAsk({
  containerRef,
  onAsk,
}: {
  /** The scrollable chat log — selections outside it are ignored. */
  containerRef: RefObject<HTMLElement | null>;
  /** Receives the trimmed selection; the caller quotes it into the input. */
  onAsk: (text: string) => void;
}) {
  const [chip, setChip] = useState<{
    text: string;
    left: number;
    top: number;
  } | null>(null);

  useEffect(() => {
    function onSelectionChange() {
      const container = containerRef.current;
      const selection = window.getSelection();
      if (!container || !selection || selection.isCollapsed) {
        setChip(null);
        return;
      }
      const text = selection.toString().trim().slice(0, MAX_QUOTE_CHARS);
      if (!text || !container.contains(selection.anchorNode)) {
        setChip(null);
        return;
      }
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      setChip({
        text,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - 96)),
        top: Math.max(8, rect.top - 34),
      });
    }
    document.addEventListener("selectionchange", onSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", onSelectionChange);
  }, [containerRef]);

  if (!chip) return null;
  return (
    <button
      type="button"
      className="btn fixed z-30 !px-2.5 !py-1 !text-[10px]"
      style={{ left: chip.left, top: Math.max(0, chip.top) }}
      // pointerdown, not click: a click would first collapse the selection.
      onPointerDown={(event) => {
        event.preventDefault();
        onAsk(chip.text);
        setChip(null);
        window.getSelection()?.removeAllRanges();
      }}
    >
      Ask air
    </button>
  );
}
