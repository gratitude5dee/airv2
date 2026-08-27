/**
 * Mitosis (Cortex) memory credentials — per-user, box-resident (C2 analog):
 * the office id and API key live ONLY in the box's ~/.hermes/.env, written
 * through the same one-shot-file merge the vault managers use. The control
 * plane never persists either value; Postgres holds nothing about Mitosis.
 * The Persona mini-app's Cortex panel and the agent itself read them from
 * the box env.
 */
import { mergeBoxEnv, removeBoxEnvKeys } from "../vault/managers";
import { command } from "../box/client";

export const MITOSIS_ENV_KEYS = ["MITOSIS_OFFICE_ID", "MITOSIS_API_KEY"];

const OFFICE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const API_KEY_RE = /^[\x21-\x7e]{16,256}$/;

export class MitosisInputError extends Error {}

export async function setMitosisCredentials(
  boxId: string,
  officeId: string,
  apiKey: string
): Promise<void> {
  if (!OFFICE_ID_RE.test(officeId)) {
    throw new MitosisInputError("office id must be a UUID");
  }
  if (!API_KEY_RE.test(apiKey)) {
    throw new MitosisInputError("API key has an unexpected format");
  }
  await mergeBoxEnv(boxId, {
    MITOSIS_OFFICE_ID: officeId,
    MITOSIS_API_KEY: apiKey,
  });
}

export async function clearMitosisCredentials(boxId: string): Promise<void> {
  await removeBoxEnvKeys(boxId, MITOSIS_ENV_KEYS);
}

/** Whether both keys are present in the box env — never returns values. */
export async function mitosisConfigured(boxId: string): Promise<boolean> {
  const result = await command(
    boxId,
    `grep -c -m1 '^MITOSIS_OFFICE_ID=.' /home/user/.hermes/.env >/dev/null 2>&1 && grep -c -m1 '^MITOSIS_API_KEY=.' /home/user/.hermes/.env >/dev/null 2>&1 && echo yes || echo no`
  ).catch(() => null);
  return result?.stdout.trim() === "yes";
}
