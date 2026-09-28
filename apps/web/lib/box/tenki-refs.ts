/**
 * Provider-ref vocabulary for the Tenki adapter: the id/template prefixes
 * plus the pure predicates and conversions that branch on them. This module
 * is deliberately free of the @tenkicloud/sandbox SDK so callers that only
 * need to classify a ref (box/client providerOf, provisioning, admin
 * settings) never pay the SDK's module cost; the SDK-bound adapter in
 * ./tenki.ts re-exports these for existing importers.
 */
import { randomBytes } from "node:crypto";
import { BoxApiError } from "./types";

export const TENKI_ID_PREFIX = "tk_";
export const TENKI_TEMPLATE_PREFIX = "tenki:";
export const TENKI_BOX_TAG_PREFIX = "air-box:";
/** Provider limit on a session/snapshot tag. */
export const TENKI_TAG_MAX_LENGTH = 32;
export const TENKI_BOX_KEY_BYTES = 12;

export function isTenkiBoxId(boxId: string): boolean {
  return boxId.startsWith(TENKI_ID_PREFIX);
}

export function isTenkiTemplateRef(templateRef: string): boolean {
  return templateRef.startsWith(TENKI_TEMPLATE_PREFIX);
}

/**
 * Strict form of a template ref a snapshot can actually come from: the
 * `tenki:` prefix plus a non-empty suffix that isn't a `tk_` box/session id
 * — `providerOf` alone accepts all of those, so config validation (the
 * TENKI_TEMPLATE_ID default probe, the tenki fork path) needs this.
 */
export function isTenkiSnapshotRef(templateRef: string): boolean {
  if (!isTenkiTemplateRef(templateRef)) return false;
  const suffix = templateRef.slice(TENKI_TEMPLATE_PREFIX.length).trim();
  return suffix.length > 0 && !isTenkiBoxId(suffix);
}

export function toBoxId(boxKey: string): string {
  return `${TENKI_ID_PREFIX}${boxKey}`;
}

export function newBoxKey(): string {
  return randomBytes(TENKI_BOX_KEY_BYTES).toString("hex");
}

export function toBoxKey(boxId: string): string {
  if (!isTenkiBoxId(boxId)) {
    throw new BoxApiError(400, `${boxId} is not a Tenki box id`);
  }
  return boxId.slice(TENKI_ID_PREFIX.length);
}

export function toSnapshotId(templateRef: string): string {
  if (!isTenkiTemplateRef(templateRef)) {
    throw new BoxApiError(400, `${templateRef} is not a Tenki template ref`);
  }
  return templateRef.slice(TENKI_TEMPLATE_PREFIX.length);
}

/** Tag every session and snapshot of a box carries; the lookup key. */
export function boxTag(boxId: string): string {
  const tag = `${TENKI_BOX_TAG_PREFIX}${toBoxKey(boxId)}`;
  if (tag.length > TENKI_TAG_MAX_LENGTH || tag !== tag.toLowerCase()) {
    throw new BoxApiError(400, `${boxId} does not fit a Tenki tag`);
  }
  return tag;
}
