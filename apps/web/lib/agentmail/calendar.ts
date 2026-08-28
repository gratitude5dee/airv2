/**
 * AgentMail hosted-calendar client (MyAgentMail: the agent owns a calendar
 * at its inbox identity). v1 surface, X-API-Key auth — distinct from the v0
 * Bearer mail surface in client.ts. Control-plane only: the key never
 * reaches the browser or the box; mini-app actions call these server-side.
 */
import { env } from "../env";
import { DEFAULT_REQUEST_TIMEOUT_MS, requestSignal } from "../http/timeout";
import { AgentMailApiError } from "./client";

const AGENTMAIL_CAL_API = "https://api.agentmail.to/v1";

async function calendarFetch<T>(
  path: string,
  init?: { method?: string; body?: object }
): Promise<T> {
  const response = await fetch(`${AGENTMAIL_CAL_API}${path}`, {
    method: init?.method ?? "GET",
    signal: requestSignal(DEFAULT_REQUEST_TIMEOUT_MS),
    headers: {
      "X-API-Key": env.agentmailApiKey(),
      "Content-Type": "application/json",
    },
    ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new AgentMailApiError(response.status, text.slice(0, 500));
  }
  return (await response.json()) as T;
}

export interface CalendarAttendee {
  email: string;
  name?: string;
}

/** Create an event on the agent's hosted calendar; attendees receive a
 * normal .ics invite email from the agent's address. */
export async function createCalendarEvent(
  inboxId: string,
  event: {
    summary: string;
    start: string;
    end: string;
    attendees?: CalendarAttendee[];
  }
): Promise<{ event_uid?: string }> {
  return await calendarFetch<{ event_uid?: string }>(
    `/inboxes/${encodeURIComponent(inboxId)}/calendar/events`,
    { method: "POST", body: event }
  );
}

export type RsvpStatus = "accepted" | "declined" | "tentative";

/** One-tap RSVP to an invitation on the agent's calendar. */
export async function rsvpCalendarEvent(
  inboxId: string,
  eventUid: string,
  status: RsvpStatus
): Promise<void> {
  await calendarFetch(
    `/inboxes/${encodeURIComponent(inboxId)}/calendar/events/${encodeURIComponent(eventUid)}/rsvp`,
    { method: "POST", body: { status } }
  );
}

export interface FreeBusySlot {
  start: string;
  end: string;
}

/** Busy intervals on the agent's calendar between two instants. Tolerant of
 * either `{busy: [...]}` or a bare array — only shape-valid slots survive. */
export async function getCalendarFreeBusy(
  inboxId: string,
  start: string,
  end: string
): Promise<FreeBusySlot[]> {
  const query = new URLSearchParams({ start, end }).toString();
  const result = await calendarFetch<unknown>(
    `/inboxes/${encodeURIComponent(inboxId)}/calendar/free-busy?${query}`
  );
  const raw = Array.isArray(result)
    ? result
    : Array.isArray((result as { busy?: unknown }).busy)
      ? ((result as { busy: unknown[] }).busy)
      : [];
  return raw.flatMap((slot) => {
    if (
      typeof slot === "object" &&
      slot !== null &&
      typeof (slot as FreeBusySlot).start === "string" &&
      typeof (slot as FreeBusySlot).end === "string"
    ) {
      return [{ start: (slot as FreeBusySlot).start, end: (slot as FreeBusySlot).end }];
    }
    return [];
  });
}

/** Enable (idempotently) the agent's public booking page and return its URL. */
export async function createBookingLink(inboxId: string): Promise<string> {
  const result = await calendarFetch<{
    url?: string;
    booking_url?: string;
  }>(`/inboxes/${encodeURIComponent(inboxId)}/calendar/booking`, {
    method: "POST",
  });
  const url = result.url ?? result.booking_url;
  if (!url || !/^https:\/\//.test(url)) {
    throw new AgentMailApiError(502, "booking response had no url");
  }
  return url;
}
