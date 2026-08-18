/**
 * V1 task 6: vault-aware log scrubber. The primary rule is that vault values
 * never enter `console.log` arguments at all (lib/vault/client.ts logs ids
 * only); this serializer is the belt to that suspenders — any value that
 * passed through the control plane during the current request cycle is
 * replaced before a log line is emitted.
 *
 * The registry is process-local and value-based, and bounded: callers
 * register values for the duration of one vault operation and unregister
 * them in a finally, so plaintext never outlives the request that carried
 * it. Nothing here is ever persisted.
 */

const MIN_SCRUB_LENGTH = 6;

const registered = new Set<string>();

/** Track a vault value that transited the control plane this cycle. */
export function registerVaultValue(value: string | null | undefined): void {
  if (typeof value === "string" && value.length >= MIN_SCRUB_LENGTH) {
    registered.add(value);
  }
}

/** Register every field value in an inbound vault payload. */
export function registerVaultFields(
  fields: Record<string, string | null> | undefined
): void {
  for (const value of Object.values(fields ?? {})) {
    registerVaultValue(value);
  }
}

/** Drop values once the operation that carried them has finished. */
export function unregisterVaultValues(
  values: Iterable<string | null | undefined>
): void {
  for (const value of values) {
    if (typeof value === "string") {
      registered.delete(value);
    }
  }
}

/** Replace every registered vault value in a log line with [REDACTED]. */
export function scrubVaultValues(text: string): string {
  let scrubbed = text;
  for (const value of registered) {
    scrubbed = scrubbed.split(value).join("[REDACTED]");
  }
  return scrubbed;
}

/**
 * Scrub every string leaf of a record before serialization — JSON escaping
 * (quotes, backslashes, newlines) would otherwise rewrite a value so the
 * literal replacement in `scrubVaultValues` no longer matches it.
 */
function scrubDeep(value: unknown): unknown {
  if (typeof value === "string") {
    return scrubVaultValues(value);
  }
  if (Array.isArray(value)) {
    return value.map(scrubDeep);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, scrubDeep(entry)])
    );
  }
  return value;
}

/** Structured log emit that always passes through the scrubber. */
export function vaultLog(record: Record<string, unknown>): void {
  console.log(scrubVaultValues(JSON.stringify(scrubDeep(record))));
}

/** Structured error emit that always passes through the scrubber. */
export function vaultLogError(record: Record<string, unknown>): void {
  console.error(scrubVaultValues(JSON.stringify(scrubDeep(record))));
}

/** Test hook: the fixture gate plants values and must start clean. */
export function resetRegisteredVaultValues(): void {
  registered.clear();
}
