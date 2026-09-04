"use client";

/**
 * liquid-gooey (libraries.dev, MIT): SVG goo filter that merges sibling
 * items. `fill` defaults to the Air panel background. Reduced motion keeps
 * the silhouettes and drops the spring transitions.
 */
import { Liquid, type LiquidProps } from "liquid-gooey";
import { useReducedMotion } from "../../air";

export function AirLiquid({ fill = "var(--panel-bg)", ...rest }: LiquidProps) {
  const reduced = useReducedMotion();
  return <Liquid fill={fill} data-reduced-motion={reduced ? "1" : undefined} {...rest} />;
}

export { Liquid };
export default AirLiquid;
