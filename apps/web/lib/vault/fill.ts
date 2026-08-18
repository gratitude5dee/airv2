/**
 * V5: owner-initiated vault fill into the box's headed browser.
 *
 * The control plane never touches the value: `air-vault type` resolves it
 * in-process on the box and delivers it over local CDP. What comes back is
 * the CLI's safe receipt line ("typed <item>/<field> into <host>") — the
 * only thing parsed, logged, or audited (C19). The CLI is also the guard:
 * it refuses hosts missing from site_grants.json, and card-kind fields
 * without a valid single-use fill ticket (V6, C20 — minted in
 * lib/vault/tickets on purchase_review approval, burned by the CLI).
 */
import { command } from "../box/client";
import { serviceClient } from "../supabase";
import {
  VaultCliError,
  appendVaultEvent,
  safeArg,
  throwCliError,
} from "./client";
import { vaultLog } from "./scrub";

export interface FillReceipt {
  item_id: string;
  field: string;
  host: string;
}

const RECEIPT = /^typed ([A-Za-z0-9._-]+)\/([A-Za-z0-9._-]+) into (\S+)$/m;

async function runTypeCommand(
  boxId: string,
  userId: string,
  itemId: string,
  field: string,
  cmd: string
): Promise<FillReceipt> {
  const supabase = serviceClient();
  const result = await command(boxId, cmd, 60);
  if (result.exitCode !== 0) {
    // Value-free refusal audit (site not granted, card refused, browser down).
    let code = "cli_failed";
    try {
      throwCliError(result.stderr, "vault type failed");
    } catch (error) {
      if (error instanceof VaultCliError) code = error.code;
      await appendVaultEvent(
        supabase,
        userId,
        "fill_denied",
        itemId,
        `${field}:${code}`
      );
      throw error;
    }
  }
  const match = RECEIPT.exec(result.stdout);
  if (!match || !match[1] || !match[2] || !match[3]) {
    throw new VaultCliError("cli_failed", "vault type returned no receipt");
  }
  const receipt: FillReceipt = {
    item_id: match[1],
    field: match[2],
    host: match[3],
  };
  await appendVaultEvent(
    supabase,
    userId,
    "fill_approved",
    itemId,
    `${receipt.field}@${receipt.host}`
  );
  vaultLog({ msg: "vault fill", item_id: itemId, field, host: receipt.host });
  return receipt;
}

/** Type a login field (username/password/…) into the focused browser input. */
export async function typeVaultField(
  boxId: string,
  userId: string,
  itemId: string,
  field: string
): Promise<FillReceipt> {
  const id = safeArg(itemId, "item id");
  const safeField = safeArg(field, "field");
  return runTypeCommand(
    boxId,
    userId,
    id,
    safeField,
    `air-vault type ${id} --field ${safeField}`
  );
}

/** Type the current TOTP code the same way; the code never leaves the box. */
export async function typeVaultTotp(
  boxId: string,
  userId: string,
  itemId: string
): Promise<FillReceipt> {
  const id = safeArg(itemId, "item id");
  return runTypeCommand(boxId, userId, id, "totp", `air-vault totp ${id} --type`);
}


