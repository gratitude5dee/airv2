"use client";

/**
 * DitherMarquee — the App Store selection ring (spec §4): a 2px border of
 * ordered-dither cells whose Bayer phase shifts each frame, seeded by the
 * deterministic pixel.ts PRNG so the pattern is stable per key. Static under
 * prefers-reduced-motion.
 */
import { useEffect, useRef } from "react";
import {
  BAYER4,
  fnv1a,
  pixelPrefersReducedMotion,
  xorshift32,
} from "./pixel";

const CELL = 2; // css px per dither cell — the ring is one cell thick

export function DitherMarquee({
  seed,
  className,
}: {
  /** Deterministic pattern seed (e.g. the selected app's slug). */
  seed: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rand = xorshift32(fnv1a(seed));
    const jitterX = Math.floor(rand() * 4);
    const jitterY = Math.floor(rand() * 4);
    let phase = 0;
    let raf = 0;
    let timer: ReturnType<typeof setInterval> | undefined;

    const paint = () => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width / CELL));
      const h = Math.max(1, Math.round(rect.height / CELL));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      ctx.clearRect(0, 0, w, h);
      const style = getComputedStyle(canvas);
      ctx.fillStyle = style.getPropertyValue("--accent").trim() || "#2b7fff";
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const onEdge = x === 0 || y === 0 || x === w - 1 || y === h - 1;
          if (!onEdge) continue;
          const threshold =
            BAYER4[(y + jitterY + phase) & 3]?.[(x + jitterX + phase * 2) & 3] ??
            1;
          if (threshold < 0.72) ctx.fillRect(x, y, 1, 1);
        }
      }
    };

    paint();
    if (!pixelPrefersReducedMotion()) {
      timer = setInterval(() => {
        phase = (phase + 1) & 3;
        raf = requestAnimationFrame(paint);
      }, 120);
    }
    return () => {
      if (timer) clearInterval(timer);
      cancelAnimationFrame(raf);
    };
  }, [seed]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{
        position: "absolute",
        inset: -3,
        width: "calc(100% + 6px)",
        height: "calc(100% + 6px)",
        imageRendering: "pixelated",
        pointerEvents: "none",
      }}
    />
  );
}
