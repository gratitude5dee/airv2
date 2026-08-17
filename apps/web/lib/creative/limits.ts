/** Reply-length discipline ported from outsideairworker src/limits.ts. */

const MARKDOWN_MARKERS = /[`*_#]/g;

export function cleanLine(value: string): string {
  return value
    .replace(MARKDOWN_MARKERS, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function limitWords(
  value: string,
  maxWords: number,
  fallback: string
): string {
  const words = cleanLine(value).split(" ").filter(Boolean);
  if (words.length === 0) {
    return fallback;
  }
  return words.slice(0, maxWords).join(" ");
}

export function chatLine(value: string, fallback = "on it"): string {
  return limitWords(value, 12, fallback);
}

export function deliveryLine(value: string): string {
  return limitWords(value, 10, "made this for you");
}
