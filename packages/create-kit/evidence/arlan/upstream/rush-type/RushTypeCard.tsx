"use client";

import { useEffect, useRef } from "react";
import { RushType } from "./engine";
import { FONT_VAR, WORDS } from "./params";
import { onTransitionChange } from "../../lib/view-transition";

export function RushTypeCard({
  bare = false,
  viewTransitionName,
}: {
  bare?: boolean;
  viewTransitionName?: string;
} = {}) {
  void bare;
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let engine: RushType | null = null;
    let onScreen = false;
    let hidden = false;
    let inTransition = false;

    const sync = () => {
      if (!engine || reduced) return;
      if (onScreen && !hidden && !inTransition) engine.start();
      else engine.stop();
    };

    const raf = requestAnimationFrame(() => {
      if (!hostRef.current) return;
      engine = new RushType(host);
      if (!engine.ok) return;

      engine.renderStill();
      if (!reduced) sync();

      if (document.fonts?.load) {
        const probe = document.createElement("span");
        probe.style.cssText = `position:absolute;visibility:hidden;font-family:${FONT_VAR}`;
        probe.textContent = "Ag";
        document.body.appendChild(probe);
        const fam = getComputedStyle(probe)
          .fontFamily.split(",")[0]
          .replace(/["']/g, "")
          .trim();
        document.body.removeChild(probe);
        document.fonts.load(`400 1em "${fam}"`).then(
          () => engine?.refreshFont(),
          () => {},
        );
      }
    });

    const io = new IntersectionObserver(
      (es) => {
        onScreen = es[0]?.isIntersecting ?? false;
        sync();
      },
      { threshold: 0.2 },
    );
    io.observe(host);

    const onVis = () => {
      hidden = document.hidden;
      sync();
    };
    document.addEventListener("visibilitychange", onVis);

    const grab = () => engine?.setHeld(true);
    const release = () => engine?.setHeld(false);
    host.addEventListener("pointerenter", grab);
    host.addEventListener("pointerdown", grab);
    host.addEventListener("pointerleave", release);
    host.addEventListener("pointerup", release);
    host.addEventListener("pointercancel", release);
    const offTransition = onTransitionChange((active) => {
      inTransition = active;
      sync();
    });

    let rt = 0;
    const onResize = () => {
      window.clearTimeout(rt);
      rt = window.setTimeout(() => engine?.onResize(), 120);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      host.removeEventListener("pointerenter", grab);
      host.removeEventListener("pointerdown", grab);
      host.removeEventListener("pointerleave", release);
      host.removeEventListener("pointerup", release);
      host.removeEventListener("pointercancel", release);
      document.removeEventListener("visibilitychange", onVis);
      offTransition();
      window.removeEventListener("resize", onResize);
      window.clearTimeout(rt);
      engine?.destroy();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      data-canvas-card
      role="img"
      aria-label={`The words ${WORDS.join(", ")} one at a time on a dark field. Each word holds still and sharp for a beat, then swings up and toward you, turning, until it stretches off the top and bottom of the frame and tears into vertical streaks of green and violet light, and the next word falls back out of the blur. Pointing at it holds the word at its largest.`}
      style={viewTransitionName ? { viewTransitionName } : undefined}
      className="relative mx-auto aspect-[1344/820] w-full cursor-pointer select-none overflow-hidden rounded-[12px] border border-[var(--border-line)] bg-black"
    />
  );
}
