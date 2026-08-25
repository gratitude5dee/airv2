"use client";

/**
 * Shared Pixel OS app-icon tile (spec §4): 1px-outline .tilebox chrome with a
 * PixelIcon for known first-party slugs, the published icon image when one
 * exists, and a deterministic DitherAvatar pixel glyph as the fallback for
 * everything else (same hash family, D19).
 */
import { DitherAvatar } from "@/components/dither-kit/avatar";
import { PixelIcon, appGlyph } from "@/components/dither-kit/icon";

export function AppTile({
  slug,
  name,
  iconUrl,
  size = 52,
  radius = 8,
  className,
}: {
  slug: string;
  name?: string;
  iconUrl?: string | null | undefined;
  /** Tile box size in px. */
  size?: number;
  radius?: number;
  className?: string;
}) {
  const glyph = appGlyph(slug);
  const iconSize = Math.max(12, Math.round(size * 0.45));
  return (
    <span
      className={"tilebox" + (className ? ` ${className}` : "")}
      style={{ width: size, height: size, borderRadius: radius }}
      aria-hidden
    >
      {glyph ? (
        <PixelIcon glyph={glyph} size={iconSize} />
      ) : iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={iconUrl}
          alt=""
          width={iconSize}
          height={iconSize}
          style={{ imageRendering: "pixelated" }}
        />
      ) : (
        <DitherAvatar
          name={name || slug}
          size={iconSize}
          animate={false}
          className="rounded-[3px]"
        />
      )}
    </span>
  );
}
