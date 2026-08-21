/**
 * The consent notice Thinking Machines requires before anyone is routed to a
 * free Inkling endpoint. One source of truth for every surface that has to
 * show it (home dashboard modal, settings mini-app) — the segments carry the
 * two links so each surface can render them in its own markup.
 */

export const INKLING_TOS_URL =
  "https://thinkingmachines.ai/legal/terms/";
export const INKLING_PRIVACY_URL =
  "https://thinkingmachines.ai/legal/privacy/";

export interface ConsentSegment {
  text: string;
  href?: string;
}

export const INKLING_CONSENT: readonly ConsentSegment[] = [
  {
    text:
      "The free Inkling endpoint is only available for use with agentic " +
      "harnesses. Do not upload any confidential information or personal " +
      "data (e.g., voices and images of people's faces). Your usage of this " +
      "free endpoint, including prompts and outputs, is logged and used to " +
      "improve Thinking Machines Lab's models, products, and services. The " +
      "logged session data will be disassociated from your account and other " +
      "persistent identifiers before being used for these purposes. By using " +
      "this free endpoint, you agree to the ",
  },
  { text: "TML Free Research API Terms of Service", href: INKLING_TOS_URL },
  {
    text:
      ". For more information about Thinking Machines Lab's data processing " +
      "practices, see this ",
  },
  { text: "Privacy Notice", href: INKLING_PRIVACY_URL },
  { text: "." },
];
