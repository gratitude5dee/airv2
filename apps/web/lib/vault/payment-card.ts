/**
 * Typed structural validation for `card` vault items, ported from
 * OpenInstinct's `lib/manager/payment-card.ts` (cardholder / number /
 * expiration / security code / billing postal, plus brand detection) onto
 * airv2's flat field names (`number`, `expiry_month`, `expiry_year`, `cvv`,
 * `zip`, `cardholder`).
 *
 * Shape only (C18): the control plane checks that a card *looks* like a card
 * and forwards it to the box, which is where values are sealed. Nothing here
 * persists, logs, or echoes a value — issue messages name the field, never
 * its contents.
 */
import { z } from "zod";

export type PaymentCardBrand =
  | "Visa"
  | "Mastercard"
  | "Amex"
  | "Discover"
  | null;

/** Fields a `card` item may carry, each with its own structural rule. */
export const CARD_FIELD_SCHEMAS = {
  cardholder: z.string().trim().min(1).max(200),
  number: z.string().regex(/^\d{12,19}$/u),
  expiry_month: z.string().regex(/^(0?[1-9]|1[0-2])$/u),
  // YY or YYYY — cards print the short form, so both are accepted.
  expiry_year: z.string().regex(/^(\d{2}|\d{4})$/u),
  cvv: z.string().regex(/^\d{3,4}$/u),
  zip: z.string().trim().min(1).max(20),
} as const;

export type CardFieldName = keyof typeof CARD_FIELD_SCHEMAS;

/** Present-and-valid before a card can be created. */
const REQUIRED_CARD_FIELDS: readonly CardFieldName[] = [
  "number",
  "expiry_month",
  "expiry_year",
  "cvv",
];

const CARD_FIELD_NAMES = Object.keys(CARD_FIELD_SCHEMAS) as CardFieldName[];

function isCardField(name: string): name is CardFieldName {
  return (CARD_FIELD_NAMES as string[]).includes(name);
}

/** Mod-10 checksum — every real PAN satisfies it, so a miss is a typo. */
export function luhnValid(digits: string): boolean {
  if (!/^\d{12,19}$/.test(digits)) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let n = Number(digits[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/** `YY` → `20YY`; anything else is returned as typed. */
export function normalizeExpiryYear(year: string): string {
  const digits = year.replace(/\D/g, "");
  return /^\d{2}$/.test(digits) ? `20${digits}` : digits;
}

/** IIN → brand, mirroring OpenInstinct's `paymentCardBrand` ranges. */
export function paymentCardBrand(number: string): PaymentCardBrand {
  const digits = number.replace(/\D/g, "");
  if (/^4/.test(digits)) return "Visa";
  if (/^3[47]/.test(digits)) return "Amex";
  if (/^(5[1-5]|2(?:2[2-9]|[3-6]\d|7[01]|720))/.test(digits)) {
    return "Mastercard";
  }
  if (/^(6011|65|64[4-9])/.test(digits)) return "Discover";
  return null;
}

/**
 * Validate the card-shaped subset of a vault item's fields. `complete` is
 * true for a create (the whole card must be there) and false for a patch
 * (only the supplied fields are checked, since the box merges the rest).
 *
 * Returns an issue string suitable for a 400 body — field names only.
 */
export function cardFieldsIssue(
  fields: Record<string, string | null> | undefined,
  complete: boolean
): string | null {
  const present = fields ?? {};
  for (const [name, value] of Object.entries(present)) {
    if (value === null || !isCardField(name)) continue;
    if (!CARD_FIELD_SCHEMAS[name].safeParse(value).success) {
      return `invalid card field: ${name}`;
    }
  }
  const number = present["number"];
  if (typeof number === "string" && !luhnValid(number)) {
    return "card number failed the Luhn check";
  }
  if (complete) {
    for (const name of REQUIRED_CARD_FIELDS) {
      if (typeof present[name] !== "string") {
        return `missing card field: ${name}`;
      }
    }
  }
  return null;
}
