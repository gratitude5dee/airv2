/**
 * @mention delegation (V7): a message mentioning a roster bot runs in that
 * bot's canonical chat instead of the default agent. Only names validated
 * against the caller's own bots roster delegate — an unknown @word is
 * ordinary text and flows through unchanged.
 */

const MENTION = /(?:^|\s)@([a-z0-9-]{2,32})\b/;

export interface MentionHit {
  /** The roster bot the message addresses. */
  bot: string;
  /** The input to run: a leading mention is stripped, inline ones stay. */
  input: string;
}

export function parseMention(
  input: string,
  rosterNames: ReadonlyArray<string>
): MentionHit | null {
  const match = MENTION.exec(input);
  const name = match?.[1];
  if (!name || !rosterNames.includes(name)) return null;
  const leading = new RegExp(`^@${name}\\b[,:]?\\s*`);
  const stripped = input.replace(leading, "").trim();
  return { bot: name, input: stripped || input };
}
