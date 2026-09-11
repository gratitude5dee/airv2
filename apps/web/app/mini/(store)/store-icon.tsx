"use client";

import { useState } from "react";
import type { ReactNode } from "react";

/**
 * Store icon image with an error fallthrough: a broken publisher or bundled
 * URL swaps to the caller's fallback (tinted initial / Orb) instead of the
 * browser's broken-image glyph, same contract as AppTile's onError chain.
 */
export function StoreAppIcon({
  iconUrl,
  size,
  className,
  fallback,
}: {
  iconUrl: string;
  size: number;
  className?: string;
  fallback: ReactNode;
}) {
  const [broken, setBroken] = useState(false);
  if (broken) return <>{fallback}</>;
  return (
    <img
      src={iconUrl}
      alt=""
      width={size}
      height={size}
      className={className}
      onError={() => setBroken(true)}
    />
  );
}
