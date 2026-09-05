/**
 * V11 §11.4 owner secrets. The value travels from the owner's session to
 * Cloudflare's secrets endpoint on both dispatch scripts and nowhere else:
 * Postgres keeps names + set-at dates (miniapp_functions.secret_names /
 * secret_set_at), the Box and the bundle never see it, the build's secret
 * sweep refuses source that pastes one (build.ts). Uploads carry the
 * bindings across with `keep_bindings` so the control plane never restates
 * a value it does not hold.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RegistryApp } from "../miniapps/registry";
import {
  BackendError,
  ensureFunctionsRow,
  type FunctionsRow,
  type SecretSetAt,
} from "./backend";
import {
  cloudflareConfigured,
  deleteDispatchScriptSecret,
  putDispatchScriptSecret,
} from "./cloudflare";
import { scriptNameFor } from "./deploy";

export const SECRET_NAME_RE = /^[A-Z][A-Z0-9_]{0,63}$/;
export const SECRET_MAX_PER_APP = 20;
export const SECRET_VALUE_MAX_BYTES = 5 * 1024;
/** Binding names the platform owns; a secret may not shadow them (§11.1). */
export const RESERVED_BINDINGS = new Set(["ASSETS", "DB", "KV"]);

export function secretNameRejection(name: string): string | null {
  if (!SECRET_NAME_RE.test(name)) {
    return "secret names are UPPER_SNAKE_CASE, start with a letter, 1–64 chars";
  }
  if (RESERVED_BINDINGS.has(name)) return `${name} is a platform binding`;
  if (name.startsWith("AIR_")) return "AIR_* names are reserved";
  return null;
}

export interface SecretSummary {
  name: string;
  set_at: string;
  live: boolean;
  draft: boolean;
}

export function summarizeSecrets(row: FunctionsRow): SecretSummary[] {
  return row.secret_names
    .map((name) => {
      const at: SecretSetAt | undefined = row.secret_set_at[name];
      return {
        name,
        set_at: at?.at ?? "",
        live: at?.live === true,
        draft: at?.draft === true,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Set (or replace) one secret. `value` is consumed here and returned
 * nowhere; callers must not log the request body.
 */
export async function setSecret(
  supabase: SupabaseClient,
  app: Pick<RegistryApp, "id" | "slug" | "owner_user_id">,
  name: string,
  value: string
): Promise<FunctionsRow> {
  const rejection = secretNameRejection(name);
  if (rejection) throw new BackendError(400, rejection);
  if (value.length === 0 || Buffer.byteLength(value, "utf8") > SECRET_VALUE_MAX_BYTES) {
    throw new BackendError(400, "secret value must be 1 byte to 5 KiB");
  }
  const row = await ensureFunctionsRow(supabase, app);
  if (!row.secret_names.includes(name) && row.secret_names.length >= SECRET_MAX_PER_APP) {
    throw new BackendError(400, `at most ${SECRET_MAX_PER_APP} secrets per app`);
  }
  if (!cloudflareConfigured()) {
    throw new BackendError(503, "the app origin is not configured");
  }
  const live = await putDispatchScriptSecret(scriptNameFor(app.slug, "live"), name, value);
  const draft = await putDispatchScriptSecret(scriptNameFor(app.slug, "draft"), name, value);
  const names = row.secret_names.includes(name)
    ? row.secret_names
    : [...row.secret_names, name].sort();
  const setAt: Record<string, SecretSetAt> = {
    ...row.secret_set_at,
    [name]: { at: new Date().toISOString(), live, draft },
  };
  return persistSecretIndex(supabase, row, names, setAt);
}

export async function removeSecret(
  supabase: SupabaseClient,
  app: Pick<RegistryApp, "id" | "slug" | "owner_user_id">,
  name: string
): Promise<FunctionsRow> {
  if (secretNameRejection(name)) throw new BackendError(400, "unknown secret");
  const row = await ensureFunctionsRow(supabase, app);
  if (!row.secret_names.includes(name)) throw new BackendError(404, "unknown secret");
  if (cloudflareConfigured()) {
    await deleteDispatchScriptSecret(scriptNameFor(app.slug, "live"), name);
    await deleteDispatchScriptSecret(scriptNameFor(app.slug, "draft"), name);
  }
  const setAt: Record<string, SecretSetAt> = { ...row.secret_set_at };
  delete setAt[name];
  return persistSecretIndex(
    supabase,
    row,
    row.secret_names.filter((n) => n !== name),
    setAt
  );
}

/**
 * A target's first deploy creates the script without the owner's secrets
 * (the control plane cannot restate values). Mark them missing there so the
 * tab can ask the owner to re-enter.
 */
export function secretsMissingOn(
  row: FunctionsRow,
  target: "live" | "draft"
): string[] {
  return row.secret_names.filter((name) => row.secret_set_at[name]?.[target] !== true);
}

async function persistSecretIndex(
  supabase: SupabaseClient,
  row: FunctionsRow,
  names: string[],
  setAt: Record<string, SecretSetAt>
): Promise<FunctionsRow> {
  const { error } = await supabase
    .from("miniapp_functions")
    .update({
      secret_names: names,
      secret_set_at: setAt,
      updated_at: new Date().toISOString(),
    })
    .eq("app_id", row.app_id);
  if (error) throw new BackendError(502, "secret index update failed");
  return { ...row, secret_names: names, secret_set_at: setAt };
}
