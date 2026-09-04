"use client";

/**
 * metal-fx (libraries.dev, MIT; bundles Paper Design shaders, Apache-2.0 —
 * see evidence/libraries/metal-fx.NOTICE). WebGL: NON-LITE ONLY. On lite
 * surfaces or when WebGL is unavailable the child renders as-is on a flat
 * plate, so the app never depends on the shader for meaning.
 */
import { useEffect, useState, type ReactNode } from "react";
import { MetalFx, type MetalFxProps } from "metal-fx";
import { useLite, useReducedMotion } from "../../air";

function webglAvailable(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function AirMetalFx({ children, ...rest }: MetalFxProps & { children: ReactNode }) {
  const lite = useLite();
  const reduced = useReducedMotion();
  const [gl, setGl] = useState(false);
  useEffect(() => setGl(webglAvailable()), []);
  if (lite || reduced || !gl) return <>{children}</>;
  return <MetalFx {...rest}>{children}</MetalFx>;
}

export default AirMetalFx;
