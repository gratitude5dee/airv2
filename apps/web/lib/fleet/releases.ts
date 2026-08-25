/**
 * Fleet template releases: an immutable, versioned artifact of the
 * infra/template/ tree. The operator packs the tree (infra/template/release.sh)
 * and posts it here; the tarball is stored under _platform/templates/ in R2
 * and referenced by checksum from the release row. Artifacts contain repo
 * code only — never credentials (C2/C18).
 */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { putObject } from "../storage/r2";

export const RELEASE_KEY_PREFIX = "_platform/templates";
export const MAX_ARTIFACT_BYTES = 32 * 1024 * 1024;

export class FleetError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "FleetError";
    this.status = status;
  }
}

export interface TemplateRelease {
  id: string;
  version: string;
  git_sha: string;
  artifact_key: string;
  checksum: string;
  hermes_ref: string | null;
  notes: string | null;
  created_at: string;
}

export interface CutReleaseInput {
  version: string;
  gitSha: string;
  artifactBase64: string;
  hermesRef?: string | undefined;
  notes?: string | undefined;
}

const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const SHA_PATTERN = /^[0-9a-f]{7,40}$/;

export async function cutRelease(
  supabase: SupabaseClient,
  input: CutReleaseInput
): Promise<TemplateRelease> {
  if (!VERSION_PATTERN.test(input.version)) {
    throw new FleetError("invalid version", 400);
  }
  if (!SHA_PATTERN.test(input.gitSha)) {
    throw new FleetError("invalid git sha", 400);
  }
  const artifact = Buffer.from(input.artifactBase64, "base64");
  if (artifact.length === 0 || artifact.length > MAX_ARTIFACT_BYTES) {
    throw new FleetError("artifact empty or too large", 400);
  }
  const checksum = createHash("sha256").update(artifact).digest("hex");
  const key = `${RELEASE_KEY_PREFIX}/template-${input.version}-${checksum.slice(0, 12)}.tgz`;
  await putObject(key, artifact, "application/gzip");
  const { data, error } = await supabase
    .from("template_releases")
    .insert({
      version: input.version,
      git_sha: input.gitSha,
      artifact_key: key,
      checksum,
      hermes_ref: input.hermesRef ?? null,
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (error) {
    throw new FleetError(`release insert failed: ${error.message}`, 500);
  }
  return data as TemplateRelease;
}

export async function getRelease(
  supabase: SupabaseClient,
  releaseId: string
): Promise<TemplateRelease> {
  const { data, error } = await supabase
    .from("template_releases")
    .select()
    .eq("id", releaseId)
    .maybeSingle();
  if (error || !data) throw new FleetError("release not found", 404);
  return data as TemplateRelease;
}

export async function listReleases(
  supabase: SupabaseClient,
  limit = 50
): Promise<TemplateRelease[]> {
  const { data, error } = await supabase
    .from("template_releases")
    .select()
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new FleetError(`release list failed: ${error.message}`, 500);
  return (data ?? []) as TemplateRelease[];
}
