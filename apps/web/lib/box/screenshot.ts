/**
 * In-box screenshot capture (V8 Computer ▸ Screen, reused by the computer
 * mini-app's state header in MA6). A real capture taken via the Box command
 * API — NOT a frame lifted from the desktop stream — so the secret-bearing
 * desktop URL never leaves the server (C3/C16).
 */
import { command } from "./client";

// Fixed script, no interpolation. Resolves the X display from the socket
// dir, prefers scrot, falls back to ImageMagick / gnome-screenshot, and
// emits the PNG as base64 on stdout. Exit 3 = no capture tool on this box.
const CAPTURE_SCRIPT = `set -e
d=$(ls /tmp/.X11-unix 2>/dev/null | head -1 | sed 's/^X/:/')
export DISPLAY=\${d:-:0}
f=/tmp/.air-screenshot.png
rm -f "$f"
if command -v scrot >/dev/null 2>&1; then scrot -o "$f"
elif command -v import >/dev/null 2>&1; then import -window root "$f"
elif command -v gnome-screenshot >/dev/null 2>&1; then gnome-screenshot -f "$f"
else echo "no screenshot tool" >&2; exit 3
fi
base64 -w0 "$f"`;

export class ScreenshotError extends Error {
  readonly code: "no_tool" | "capture_failed";
  constructor(code: "no_tool" | "capture_failed") {
    super(code);
    this.name = "ScreenshotError";
    this.code = code;
  }
}

/** Capture the current desktop as PNG bytes. Never wakes the box — callers
 * must check the box is already awake first. */
export async function captureScreenshotPng(
  providerBoxId: string
): Promise<Buffer> {
  const result = await command(providerBoxId, CAPTURE_SCRIPT, 45);
  if (result.exitCode === 3) {
    throw new ScreenshotError("no_tool");
  }
  if (result.exitCode !== 0 || !result.stdout.trim()) {
    throw new ScreenshotError("capture_failed");
  }
  return Buffer.from(result.stdout.trim(), "base64");
}
