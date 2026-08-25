/**
 * One shell/file/lifecycle surface over every compute environment. Callers
 * hold a ComputeTarget (instance id + environment + bridge credentials)
 * instead of a bare box id, and this module routes to lib/box/client.ts or
 * lib/namespace/client.ts. Paths that differ between environments come from
 * the environment profile, never from a literal /home/user in a caller.
 *
 * Both Linux environments resolve to the Box API, so every existing box path
 * keeps its exact behavior.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  command as boxCommand,
  deleteBox,
  readFile as boxReadFile,
  stop as boxStop,
  writeFile as boxWriteFile,
  type CommandResult,
} from "../box/client";
import {
  bridgeCommand,
  bridgeReadFile,
  bridgeWriteFile,
  destroyInstance,
  suspendInstance,
  type BridgeControl,
} from "../namespace/client";
import {
  kindFor,
  profileFor,
  restartCommand,
  toComputeEnvironment,
  type ComputeEnvironment,
} from "./environments";

export type { CommandResult };

export interface ComputeTarget {
  /** provider_box_id: a Box id, or a Namespace instance id. */
  instanceId: string;
  environment: ComputeEnvironment;
  /** Native environments only: the template bridge behind Namespace ingress. */
  control?: { url: string; token: string } | undefined;
}

export interface ComputeTargetRow {
  provider_box_id: string;
  environment?: string | null;
  control_url?: string | null;
  control_token?: string | null;
}

export function targetFromRow(row: ComputeTargetRow): ComputeTarget {
  return {
    instanceId: row.provider_box_id,
    environment: toComputeEnvironment(row.environment),
    control:
      row.control_url && row.control_token
        ? { url: row.control_url, token: row.control_token }
        : undefined,
  };
}

/** A box target, for callers that only ever deal with ascii.dev boxes. */
export function boxTarget(
  boxId: string,
  environment: ComputeEnvironment = "ubuntu",
): ComputeTarget {
  return { instanceId: boxId, environment };
}

export async function loadTarget(
  supabase: SupabaseClient,
  userId: string,
): Promise<ComputeTarget> {
  const { data, error } = await supabase
    .from("boxes")
    .select("provider_box_id, environment, control_url, control_token")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(
      `compute lookup failed for user ${userId}: ${error.message}`,
    );
  }
  if (!data) throw new Error(`no compute for user ${userId}`);
  return targetFromRow(data as ComputeTargetRow);
}

function bridgeControl(target: ComputeTarget): BridgeControl {
  if (!target.control) {
    throw new Error(
      `instance ${target.instanceId} has no control endpoint — the template bridge is not published`,
    );
  }
  return {
    instanceId: target.instanceId,
    controlUrl: target.control.url,
    controlToken: target.control.token,
  };
}

export async function runCommand(
  target: ComputeTarget,
  cmd: string,
  timeoutSeconds = 60,
): Promise<CommandResult> {
  switch (kindFor(target.environment)) {
    case "box":
      return boxCommand(target.instanceId, cmd, timeoutSeconds);
    case "native":
      return bridgeCommand(bridgeControl(target), cmd, timeoutSeconds);
  }
}

export async function readComputeFile(
  target: ComputeTarget,
  path: string,
): Promise<string> {
  switch (kindFor(target.environment)) {
    case "box":
      return boxReadFile(target.instanceId, path);
    case "native":
      return bridgeReadFile(bridgeControl(target), absolute(target, path));
  }
}

export async function writeComputeFile(
  target: ComputeTarget,
  path: string,
  content: string,
): Promise<void> {
  switch (kindFor(target.environment)) {
    case "box":
      return boxWriteFile(target.instanceId, path, content);
    case "native":
      return bridgeWriteFile(
        bridgeControl(target),
        absolute(target, path),
        content,
      );
  }
}

/** Box file paths are relative to the box work dir; the bridge wants absolute. */
function absolute(target: ComputeTarget, path: string): string {
  if (path.startsWith("/")) return path;
  return `${profileFor(target.environment).homeDir}/${path}`;
}

export async function restartServices(
  target: ComputeTarget,
  services?: readonly string[],
): Promise<CommandResult> {
  return runCommand(target, restartCommand(target.environment, services), 120);
}

/** Suspend the instance, keeping its disk (never force — C6). */
export async function stopCompute(target: ComputeTarget): Promise<void> {
  if (kindFor(target.environment) === "box") {
    await boxStop(target.instanceId);
    return;
  }
  await suspendInstance(target.instanceId);
}

export async function destroyCompute(target: ComputeTarget): Promise<void> {
  if (kindFor(target.environment) === "box") {
    await deleteBox(target.instanceId);
    return;
  }
  await destroyInstance(target.instanceId);
}

/** Absolute path to a binary in the environment's Hermes venv. */
export function hermesBin(target: ComputeTarget, binary = "hermes"): string {
  return `${profileFor(target.environment).homeDir}/.hermes-venv/bin/${binary}`;
}
