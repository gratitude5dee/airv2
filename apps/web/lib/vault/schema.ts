/**
 * Zod schemas for the control-plane vault surface, adopted from
 * OpenInstinct's `vaultItemKindSchema` / `vaultItemInputSchema` shape (with
 * airv2's kinds and flat field map) so every mutation body is parsed once,
 * in one place, instead of hand-rolled per route.
 *
 * Validation is structural only — the schemas never widen what the control
 * plane may do with a value (C18): field values are parsed, forwarded to the
 * box, and dropped. Rejections quote field *names* only.
 */
import { z } from "zod";
import { cardFieldsIssue } from "./payment-card";

const ENV_NAME_RE = /^[A-Z_][A-Z0-9_]*$/;
const FIELD_NAME_RE = /^[a-z_][a-z0-9_]*$/;

export const vaultItemKindSchema = z.enum([
  "login",
  "card",
  "api_key",
  "note",
  "identity",
]);

export const vaultItemIdSchema = z.string().regex(/^[A-Za-z0-9._-]{1,64}$/, {
  message: "invalid item id",
});

const vaultFieldsSchema = z.record(
  z.string().regex(FIELD_NAME_RE, { message: "invalid field name" }),
  z.union([z.string().max(10_000), z.null()])
);

const vaultItemNameSchema = z.string().trim().min(1).max(120);
const vaultEnvVarSchema = z
  .string()
  .regex(ENV_NAME_RE, { message: "invalid env var name" })
  .nullable();
const vaultTotpSeedSchema = z.string().max(512).nullable();

const cardShape = (complete: boolean) =>
  function refineCard(
    input: {
      kind?: string | undefined;
      fields?: Record<string, string | null> | undefined;
    },
    context: z.RefinementCtx
  ): void {
    if (input.kind !== "card") return;
    const issue = cardFieldsIssue(input.fields, complete);
    if (issue) {
      context.addIssue({ code: "custom", message: issue, path: ["fields"] });
    }
  };

/** Full item — a create must carry a kind, a name, and a complete card. */
export const vaultItemInputSchema = z
  .object({
    kind: vaultItemKindSchema,
    name: vaultItemNameSchema,
    fields: vaultFieldsSchema.optional(),
    env_var: vaultEnvVarSchema.optional(),
    totp_seed: vaultTotpSeedSchema.optional(),
  })
  .strict()
  .superRefine(cardShape(true));

/**
 * Patch — every key optional, but at least one present. A patch that ships
 * `kind: "card"` fields still has each supplied field validated; the box
 * merges it onto the stored card, so completeness is not required here.
 */
export const vaultItemPatchSchema = z
  .object({
    kind: vaultItemKindSchema.optional(),
    name: vaultItemNameSchema.optional(),
    fields: vaultFieldsSchema.optional(),
    env_var: vaultEnvVarSchema.optional(),
    totp_seed: vaultTotpSeedSchema.optional(),
  })
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "empty patch",
  })
  .superRefine(cardShape(false));

export const vaultCreateBodySchema = z
  .object({ item: vaultItemInputSchema })
  .strict();

export const vaultUpdateBodySchema = z
  .object({ id: vaultItemIdSchema, item: vaultItemPatchSchema })
  .strict();

export const vaultDeleteBodySchema = z
  .object({ id: vaultItemIdSchema })
  .strict();

export const vaultRevealBodySchema = z
  .object({
    field: z.string().regex(FIELD_NAME_RE, { message: "invalid field name" }),
  })
  .strict();

export type VaultItemInputParsed = z.infer<typeof vaultItemInputSchema>;
export type VaultItemPatchParsed = z.infer<typeof vaultItemPatchSchema>;
