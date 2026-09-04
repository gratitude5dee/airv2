"use client";

/**
 * border-beam (libraries.dev, MIT) on Air: dark theme, radius from
 * --radius-panel by default, and `active` is forced off under reduced motion
 * so the ring stays as a static hairline.
 */
import { BorderBeam, type BorderBeamProps } from "border-beam";
import { useReducedMotion } from "../../air";

export type AirBorderBeamProps = Omit<BorderBeamProps, "theme">;

export function AirBorderBeam({ active = true, borderRadius = 18, ...rest }: AirBorderBeamProps) {
  const reduced = useReducedMotion();
  return <BorderBeam theme="dark" active={active && !reduced} borderRadius={borderRadius} {...rest} />;
}

export { BorderBeam };
export default AirBorderBeam;
