"use client";

import { useEffect, useRef } from "react";
import { SwingType } from "./engine";
import { FONT_VAR, FONT_WEIGHT } from "./params";
import { onTransitionChange } from "../../lib/view-transition";

export function SwingTypeCard({
  bare = false,
  viewTransitionName,
}: {
  bare?: boolean;
  viewTransitionName?: string;
} = {}) {
  void bare;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let engine: SwingType | null = null;
    let onScreen = false;
    let hidden = false;
    let inTransition = false;

    const sync = () => {
      if (!engine || reduced) return;
      if (onScreen && !hidden && !inTransition) engine.start();
      else engine.stop();
    };

    const raf = requestAnimationFrame(() => {
      if (!canvasRef.current) return;

      const probe = document.createElement("span");
      probe.style.cssText = `position:absolute;visibility:hidden;font-family:var(${FONT_VAR})`;
      probe.textContent = "Ag";
      document.body.appendChild(probe);
      const fam = getComputedStyle(probe).fontFamily || "sans-serif";
      document.body.removeChild(probe);

      engine = new SwingType(canvas, fam);
      if (!engine.ok) return;
      if (reduced) engine.renderStill();
      else sync();

      if (document.fonts?.load) {
        const first = fam.split(",")[0].replace(/["']/g, "").trim();
        document.fonts
          .load(`${FONT_WEIGHT} 1em "${first}"`)
          .then(() => engine?.refreshFont(), () => {});
      }
    });

    const io = new IntersectionObserver(
      (es) => {
        onScreen = es[0]?.isIntersecting ?? false;
        sync();
      },
      { threshold: 0.2 },
    );
    io.observe(canvas);

    const onVis = () => {
      hidden = document.hidden;
      sync();
    };
    document.addEventListener("visibilitychange", onVis);
    const offTransition = onTransitionChange((active) => {
      inTransition = active;
      sync();
    });

    let rt = 0;
    const onResize = () => {
      window.clearTimeout(rt);
      rt = window.setTimeout(() => engine?.resize(), 120);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      offTransition();
      window.removeEventListener("resize", onResize);
      window.clearTimeout(rt);
      engine?.destroy();
      engine = null;
    };
  }, []);

  return (
    <div
      data-canvas-card
      role="img"
      aria-label="Large coloured letters swing slowly back and forth across a white field. Each letter turns edge-on as it travels, thinning to a coloured sliver at the sides and opening to full width in the middle, so only two or three letters can be read at any moment and the whole word never appears at once. Every few seconds the word quietly becomes a different one."
      style={{
        ...(viewTransitionName ? { viewTransitionName } : null),
        backgroundColor: "#000",
      }}
      className="relative mx-auto aspect-[1344/620] w-full select-none overflow-hidden rounded-[12px] border border-[var(--border-line)]"
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
