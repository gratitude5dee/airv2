/**
 * Minimal, defensive ICS inspection for the control plane. Invites are
 * attacker-controlled input (I5): the control plane never fully parses or
 * stores them — full parsing happens box-side (sync.py).
 * Here we only (a) detect that a MIME part/attachment is a calendar invite
 * and (b) extract a sanitized one-line label for the Needs-you decision.
 */

export function looksLikeIcs(
  contentType: string | undefined,
  filename: string | undefined
): boolean {
  const type = (contentType ?? "").toLowerCase();
  if (type.includes("text/calendar") || type.includes("application/ics")) {
    return true;
  }
  return (filename ?? "").toLowerCase().endsWith(".ics");
}

/** RFC 5545 line unfolding: a CRLF followed by a space/tab is a continuation. */
export function unfoldIcs(text: string): string {
  return text.replace(/\r?\n[ \t]/g, "");
}

function sanitizeLabel(value: string): string {
  return value
    .replace(/\\n/g, " ")
    .replace(/\\([,;\\])/g, "$1")
    // Control characters and anything that could smuggle markup into a card.
    .replace(/[\u0000-\u001f\u007f<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export interface InviteSummary {
  summary?: string;
  startsAt?: string;
  /** VEVENT UID — the hosted-calendar event id an RSVP is addressed to. */
  uid?: string;
}

const UID_RE = /^[A-Za-z0-9@._:+-]{1,255}$/;

/**
 * Pull SUMMARY and DTSTART from the first VEVENT for the decision label.
 * Anything malformed simply yields undefined fields — the invite still lands
 * in the box inbox and the box-side parser is the authority.
 */
export function extractInviteSummary(ics: string): InviteSummary {
  const result: InviteSummary = {};
  const bounded = ics.slice(0, 256 * 1024);
  const unfolded = unfoldIcs(bounded);
  const eventStart = unfolded.indexOf("BEGIN:VEVENT");
  if (eventStart === -1) return result;
  const eventEnd = unfolded.indexOf("END:VEVENT", eventStart);
  const block = unfolded.slice(
    eventStart,
    eventEnd === -1 ? undefined : eventEnd
  );
  for (const line of block.split(/\r?\n/)) {
    const match = /^([A-Za-z-]+)(?:;[^:]*)?:(.*)$/.exec(line);
    if (!match?.[1] || match[2] === undefined) continue;
    const name = match[1].toUpperCase();
    if (name === "SUMMARY" && !result.summary) {
      const summary = sanitizeLabel(match[2]);
      if (summary) result.summary = summary;
    } else if (name === "DTSTART" && !result.startsAt) {
      const dtstart = match[2].trim();
      if (/^[0-9TZ:+-]{8,32}$/.test(dtstart)) result.startsAt = dtstart;
    } else if (name === "UID" && !result.uid) {
      const uid = match[2].trim();
      if (UID_RE.test(uid)) result.uid = uid;
    }
  }
  return result;
}

/** "Add *Dinner w/ Sam, Thu 7pm*?" — the Needs-you label for an invite. */
export function inviteLabel(summary: InviteSummary): string {
  const title = summary.summary ?? "Untitled event";
  if (!summary.startsAt) return `Add "${title}"?`;
  const raw = summary.startsAt;
  const iso = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(
    raw
  );
  if (!iso) return `Add "${title}"?`;
  const when = iso[4]
    ? `${iso[1]}-${iso[2]}-${iso[3]} ${iso[4]}:${iso[5]}${iso[7] ?? ""}`
    : `${iso[1]}-${iso[2]}-${iso[3]}`;
  return `Add "${title}", ${when}?`;
}
