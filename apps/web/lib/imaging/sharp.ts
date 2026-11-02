/**
 * Lazy sharp loader. sharp's native binding does not exist on workerd and
 * its wasm32 fallback compiles at module evaluation — a static import makes
 * every route in the import graph fail. Loading on first call confines the
 * failure to the image operation itself.
 */
import type sharp from "sharp";

let sharpPromise: Promise<typeof sharp> | undefined;

export function loadSharp(): Promise<typeof sharp> {
  sharpPromise ??= import("sharp").then(
    (m) => (m.default ?? m) as unknown as typeof sharp
  );
  return sharpPromise;
}
