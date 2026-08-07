/**
 * M1 provisioning: users + entitlements → fork the template box (noEnv:true,
 * per-box TENANT_ID + GATEWAY_TOKEN) → write per-box secrets → point the
 * model base URL at the gateway → register hosted routes → persist the boxes
 * row. No provider key ever enters the box (C2).
 */
import { randomBytes } from "node:crypto";
import { env } from "../env";
import { serviceClient } from "../supabase";
import { command, fork, waitForBox, writeFile } from "../box/client";

export interface ProvisionResult {
  userId: string;
  boxId: string;
  hostedUrl: string;
  dashboardUrl: string;
}

const HOSTED_URL_PATTERN =
  /^(https:\/\/[a-z0-9-]+-(\d+)\.on\.ascii\.dev)\?_token=([a-f0-9]+)$/m;

function parseHostedUrl(
  stdout: string,
  port: number
): { url: string; token: string } {
  for (const line of stdout.split("\n")) {
    const match = HOSTED_URL_PATTERN.exec(line.trim());
    if (match?.[1] && match[3] && Number(match[2]) === port) {
      return { url: match[1], token: match[3] };
    }
  }
  throw new Error(`hosted URL for port ${port} not found in host output`);
}

export async function provisionUser(): Promise<ProvisionResult> {
  const supabase = serviceClient();

  const { data: user, error: userError } = await supabase
    .from("users")
    .insert({ status: "active" })
    .select("id")
    .single();
  if (userError || !user) {
    throw new Error(`users insert failed: ${userError?.message}`);
  }
  const userId = user.id as string;

  const { error: entitlementError } = await supabase
    .from("entitlements")
    .insert({ user_id: userId });
  if (entitlementError) {
    throw new Error(`entitlements insert failed: ${entitlementError.message}`);
  }

  const gatewayToken = randomBytes(32).toString("hex");
  const apiServerKey = randomBytes(32).toString("hex");
  const dashPassword = randomBytes(16).toString("hex");
  const dashSecret = randomBytes(32).toString("hex");

  const box = await fork({
    templateId: env.boxTemplateId(),
    env: { TENANT_ID: userId, GATEWAY_TOKEN: gatewayToken },
  });
  await waitForBox(box.id);

  const hashResult = await command(
    box.id,
    `cd ~/hermes-agent && uv run python -c "from plugins.dashboard_auth.basic import hash_password; print(hash_password('${dashPassword}'))"`,
    120
  );
  if (hashResult.exitCode !== 0) {
    throw new Error(`dashboard hash failed: ${hashResult.stderr}`);
  }
  const dashHash = hashResult.stdout.trim();

  // Per-box secrets. OPENAI_API_KEY carries the GATEWAY_TOKEN — it is the
  // credential Hermes presents to OUR gateway, never a provider key.
  // files API paths are relative to the box work directory (/home/user)
  await writeFile(
    box.id,
    ".hermes/.env",
    [
      `API_SERVER_KEY=${apiServerKey}`,
      "API_SERVER_HOST=0.0.0.0",
      `OPENAI_API_KEY=${gatewayToken}`,
      "HERMES_DASHBOARD_BASIC_AUTH_USERNAME=air",
      `HERMES_DASHBOARD_BASIC_AUTH_PASSWORD_HASH=${dashHash}`,
      `HERMES_DASHBOARD_BASIC_AUTH_SECRET=${dashSecret}`,
      "HERMES_WEB_DIST=/home/user/.hermes/web_dist",
      "",
    ].join("\n")
  );
  await command(box.id, "chmod 600 /home/user/.hermes/.env");

  const gatewayUrl = `${env.appOrigin()}/api/gateway/v1`;
  await command(
    box.id,
    `sed -i 's|base_url:.*|base_url: "${gatewayUrl}"|' /home/user/.hermes/config.yaml`
  );

  await command(
    box.id,
    "sudo systemctl restart hermes-gateway hermes-dashboard hermes-host",
    120
  );

  const hostResult = await command(
    box.id,
    `eval "$(grep '^export ASCII_' /home/user/.bashrc)"; /home/user/.ascii/host url 8642 --timeout 120 --private && /home/user/.ascii/host url 9119 --timeout 120 --private`,
    300
  );
  if (hostResult.exitCode !== 0) {
    throw new Error(`host registration failed: ${hostResult.stderr}`);
  }
  const hermes = parseHostedUrl(hostResult.stdout, 8642);
  const dashboard = parseHostedUrl(hostResult.stdout, 9119);

  const { error: boxError } = await supabase.from("boxes").insert({
    user_id: userId,
    provider_box_id: box.id,
    state: "ready",
    hosted_url: hermes.url,
    hosted_token: hermes.token,
    api_server_key: apiServerKey,
    gateway_token: gatewayToken,
    last_active_at: new Date().toISOString(),
  });
  if (boxError) {
    throw new Error(`boxes insert failed: ${boxError.message}`);
  }

  return {
    userId,
    boxId: box.id,
    hostedUrl: hermes.url,
    dashboardUrl: dashboard.url,
  };
}
