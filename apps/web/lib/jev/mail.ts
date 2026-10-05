/**
 * Jev mail classifier — edge-side spam screen for inbound email from
 * unknown (tier-2) senders, running on the same System One transport as the
 * chat turn router. One batched call per message: spam / transactional /
 * needs_reply, answered from metadata only — the state carries from,
 * subject, and a short preview, never the body (I2/C4).
 *
 * Fail-open, same contract as the router: a missing key, a timeout, or an
 * odd answer returns null and the mail flow is exactly what it was before.
 *
 * Policy constants live here and only here — tune in this file.
 */
import { jevAsk, noul, type JevNoulAnswer } from "./transport";

/** Tight budget, same as routing: a slow Jev is worse than no Jev. */
const MAIL_TIMEOUT_MS = 2_500;
/** Subject + preview caps — the classifier sees a teaser, not the body. */
const SUBJECT_CHARS = 200;
const PREVIEW_CHARS = 400;

/** `spam` at or above this labels the message; below it files normally. */
export const MAIL_SPAM_MIN = 0.8;
/** Receipts aren't spam: a transactional noul at or above this vetoes the
 * spam label no matter how high `spam` scores. */
export const MAIL_TRANSACTIONAL_VETO = 0.6;

/** The one batched question set — tune here, never inline. */
export const MAIL_QUESTIONS = {
  spam: {
    type: "noul",
    instructions:
      "This message is spam, phishing, or bulk unsolicited marketing.",
  },
  transactional: {
    type: "noul",
    instructions:
      "This is a legitimate automated notice — receipt, order update, calendar invite, security alert.",
  },
  needs_reply: {
    type: "noul",
    instructions:
      "A real person wrote to the owner and expects a response.",
  },
} as const;

export interface MailVerdict {
  spam: number;
  transactional: number;
  needsReply: number;
}

interface MailAnswers {
  answers?: {
    spam?: JevNoulAnswer;
    transactional?: JevNoulAnswer;
    needs_reply?: JevNoulAnswer;
  };
}

/**
 * Classify one inbound message from its metadata. `preview` is the
 * provider's quote-stripped extraction (or text fallback), further capped —
 * never the full body. Null means "no opinion": callers behave as if the
 * classifier didn't exist.
 */
export async function classifyInboundMail(input: {
  from: string;
  subject?: string | undefined;
  preview?: string | undefined;
}): Promise<MailVerdict | null> {
  const body = await jevAsk<MailAnswers>({
    surface: "air-mail",
    state: {
      from: input.from,
      subject: (input.subject ?? "").slice(0, SUBJECT_CHARS),
      preview: (input.preview ?? "").slice(0, PREVIEW_CHARS),
    },
    questions: MAIL_QUESTIONS,
    timeoutMs: MAIL_TIMEOUT_MS,
  });
  const answers = body?.answers;
  if (!answers) return null;
  return {
    spam: noul(answers.spam),
    transactional: noul(answers.transactional),
    needsReply: noul(answers.needs_reply),
  };
}

/** The spam-label policy in one place: confident spam minus the receipt
 * veto. */
export function isSpamVerdict(verdict: MailVerdict): boolean {
  return (
    verdict.spam >= MAIL_SPAM_MIN &&
    verdict.transactional < MAIL_TRANSACTIONAL_VETO
  );
}
