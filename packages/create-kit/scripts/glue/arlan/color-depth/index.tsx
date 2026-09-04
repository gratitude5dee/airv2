"use client";

/**
 * Color Depth (arlan.me, MIT): ten CSS-only button materials — .depth-btn
 * plus one of .depth-glossy .depth-satin .depth-metal .depth-glass .depth-neon
 * .depth-inset .depth-layered .depth-duotone .depth-glow .depth-foil.
 * `useColorDepth` binds the pointer-tracking for metal/foil inside a subtree.
 */
import { useEffect, type RefObject } from "react";
import { initColorDepth } from "./color-depth";
import "./color-depth.css";

export { initColorDepth };

export type DepthMaterial =
  | "glossy"
  | "satin"
  | "metal"
  | "glass"
  | "neon"
  | "inset"
  | "layered"
  | "duotone"
  | "glow"
  | "foil";

export function depthClass(material: DepthMaterial, extra?: string): string {
  return ["depth-btn", `depth-${material}`, extra].filter(Boolean).join(" ");
}

export function useColorDepth(root: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    if (root.current) initColorDepth(root.current);
  }, [root]);
}
