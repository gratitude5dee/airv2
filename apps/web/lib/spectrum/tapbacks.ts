/**
 * Native iMessage tapbacks (ARCHITECTURE-adjacent nicety): when the agent's
 * whole reply is a single tapback emoji, it should land as a reaction pinned
 * to the human's message, not as a new bubble. Spectrum maps these six
 * universal aliases to native tapbacks on iMessage.
 */
import { Emoji } from "spectrum-ts";

export const TAPBACK_EMOJI: readonly string[] = [
  Emoji.love,
  Emoji.like,
  Emoji.dislike,
  Emoji.laugh,
  Emoji.emphasize,
  Emoji.question,
];

/** Longest reply (trimmed) that could still be a lone tapback emoji. */
export const TAPBACK_PROBE_LIMIT = 8;

/**
 * The canonical tapback emoji when the reply is exactly one of them (with or
 * without the trailing variation selector), otherwise undefined.
 */
export function asTapback(reply: string): string | undefined {
  const trimmed = reply.trim();
  if (trimmed.length === 0 || trimmed.length > TAPBACK_PROBE_LIMIT) {
    return undefined;
  }
  return TAPBACK_EMOJI.find(
    (emoji) => trimmed === emoji || trimmed === emoji.replace(/\uFE0F/g, "")
  );
}

export interface TapbackProbe {
  /** Set when the stream ended within the probe window on a lone tapback. */
  tapback?: string | undefined;
  /** Everything consumed from the stream so far. */
  buffered: string;
  /** True when the stream is exhausted (nothing left beyond `buffered`). */
  ended: boolean;
}

/**
 * Consume just enough of a reply stream to decide whether it is a lone
 * tapback. Stops reading as soon as the reply is provably not one; the
 * caller re-yields `buffered` ahead of the remaining iterator.
 */
export async function probeForTapback(
  deltas: AsyncIterator<string>
): Promise<TapbackProbe> {
  let buffered = "";
  for (;;) {
    if (buffered.trim().length > TAPBACK_PROBE_LIMIT) {
      return { buffered, ended: false };
    }
    const next = await deltas.next();
    if (next.done) {
      return { tapback: asTapback(buffered), buffered, ended: true };
    }
    buffered += next.value;
  }
}
