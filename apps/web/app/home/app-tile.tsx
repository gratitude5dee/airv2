"use client";

/**
 * Shared Pixel OS app-icon tile (spec §4): 1px-outline .tilebox chrome with a
 * PixelIcon for known first-party slugs, the published icon image when one
 * exists, and a deterministic DitherAvatar pixel glyph as the fallback for
 * everything else (same hash family, D19).
 */
import { useEffect, useState } from "react";
import { DitherAvatar } from "@/components/dither-kit/avatar";
import { PixelIcon, appGlyph } from "@/components/dither-kit/icon";
import { firstPartyAppArt } from "@/lib/miniapps/app-art";

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
  const bundledArt = firstPartyAppArt(slug);
  const imageSources = [iconUrl, bundledArt].filter(
    (source): source is string => Boolean(source)
  );
  const [imageIndex, setImageIndex] = useState(0);
  useEffect(() => {
    setImageIndex(0);
  }, [iconUrl, bundledArt]);
  const imageSrc = imageSources[imageIndex] ?? null;
  const iconSize = Math.max(12, Math.round(size * 0.45));
  return (
    <span
      className={"tilebox" + (className ? ` ${className}` : "")}
      style={{ width: size, height: size, borderRadius: radius }}
      aria-hidden
    >
      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc}
          alt=""
          width={iconSize}
          height={iconSize}
          className="rounded-[28%] object-cover"
          onError={() => setImageIndex((index) => index + 1)}
        />
      ) : glyph ? (
        <PixelIcon glyph={glyph} size={iconSize} />
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
