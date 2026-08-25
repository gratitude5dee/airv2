/**
 * Per-user Daytona credential injection (P1-11). The template ships the
 * Daytona CLI/MCP but no credential; this mints a sandbox-scoped child key
 * for the user and writes it into the box env — the same lane as
 * GATEWAY_TOKEN and the AgentMail draft-only key. When the manager key is
 * not configured, no key is injected and the sandbox lane stays disabled.
 */
import {
  readComputeFile,
  restartServices,
  writeComputeFile,
  type ComputeTarget,
} from "../compute/runtime";
import { createTenantKey, daytonaConfigured } from "../daytona/client";

export async function provisionDaytona(
  target: ComputeTarget,
  userId: string
): Promise<void> {
  if (!daytonaConfigured()) {
    console.log(
      JSON.stringify({
        msg: "daytona manager key not configured — sandbox lane disabled",
        user_id: userId,
      })
    );
    return;
  }
  const tenantKey = await createTenantKey(userId);
  // Typed file read/write only — the key must never appear in a shell
  // command line (visible in command logs / process listings).
  const current = await readComputeFile(target, ".hermes/.env").catch(() => "");
  const kept = current
    .split("\n")
    .filter((line) => line && !line.startsWith("DAYTONA_API_KEY="));
  kept.push(`DAYTONA_API_KEY=${tenantKey}`);
  await writeComputeFile(target, ".hermes/.env", kept.join("\n") + "\n");
  // Restart so the stdio MCP subprocess inherits the new credential.
  await restartServices(target, ["hermes-gateway"]);
}
