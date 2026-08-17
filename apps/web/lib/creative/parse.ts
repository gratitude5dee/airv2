/**
 * Deterministic slash-command grammar for the creative lane (goal.md M16
 * task 1), ported from outsideairworker src/router.ts. `/imagine`, `/animate`,
 * and `/zap` are standalone case-insensitive tokens anywhere in prose.
 * Repeating one command is harmless; naming two distinct modes is ambiguous
 * and must fail deterministically — never silently choose a paid route.
 */

export type CreativeMode = "imagine" | "animate" | "zap";

export const AMBIGUOUS_COMMAND_LINE =
  "use one command: /imagine, /animate, or /zap";

const EXPLICIT_COMMANDS: Readonly<Record<string, CreativeMode>> = {
  animate: "animate",
  imagine: "imagine",
  zap: "zap",
};

export type ParsedExplicitGenerationCommand =
  | {
      cleanedText: string;
      mode: CreativeMode;
    }
  | {
      ambiguous: true;
    };

export function parseExplicitGenerationCommand(
  text: string
): ParsedExplicitGenerationCommand | undefined {
  const pattern =
    /(^|[^A-Za-z0-9_/])\/(imagine|animate|zap)(?=$|[^A-Za-z0-9_-])/gi;
  const modes = new Set<CreativeMode>();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const mode = EXPLICIT_COMMANDS[(match[2] ?? "").toLowerCase()];
    if (mode) modes.add(mode);
  }

  if (modes.size === 0) {
    return undefined;
  }
  if (modes.size > 1) {
    return { ambiguous: true };
  }

  const cleanedText = text
    .replace(
      /(^|[^A-Za-z0-9_/])\/(?:imagine|animate|zap)(?=$|[^A-Za-z0-9_-])/gi,
      "$1"
    )
    .replace(/[ \t]+([,.;:!?])/g, "$1")
    .replace(/^[\s,;:]+/, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    cleanedText,
    mode: modes.values().next().value as CreativeMode,
  };
}
