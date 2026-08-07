/**
 * M1 provisioning: users + entitlements → fork the template box (noEnv:true,
 * per-box TENANT_ID + GATEWAY_TOKEN) → write per-box secrets → point the
 * model base URL at the gateway → register hosted routes → persist the boxes
 * row. No provider key ever enters the box (C2).
 */
import { randomBytes } from "node:crypto";
import { env } from "../env";
import { serviceClient } from "../supabase";
import { command, deleteBox, fork, stop, waitForBox, writeFile } from "../box/client";

export interface ProvisionOptions {
  displayName?: string;
  boundPhone?: string;
  linePhone?: string;
  operator?: string;
}

export interface ProvisionResult {
  userId: string;
  boxId: string;
  hostedUrl: string;
  dashboardUrl: string;
  inviteLink?: string;
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

export async function provisionUser(
  options: ProvisionOptions = {}
): Promise<ProvisionResult> {
  const supabase = serviceClient();

  // M3: users + provisioning(bound_phone) + tier-0 handles are written
  // BEFORE any line exists (goal.md M3 step 1).
  const { data: user, error: userError } = await supabase
    .from("users")
    .insert({ status: options.boundPhone ? "pending" : "active" })
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

  let inviteLink: string | undefined;
  if (options.boundPhone) {
    const { error: provisioningError } = await supabase
      .from("provisioning")
      .insert({
        user_id: userId,
        state: "created",
        bound_phone: options.boundPhone,
        operator: options.operator ?? null,
      });
    if (provisioningError) {
      throw new Error(`provisioning insert failed: ${provisioningError.message}`);
    }
    const { error: handleError } = await supabase.from("handles").insert({
      user_id: userId,
      platform: "imessage",
      address: options.boundPhone,
    });
    if (handleError) {
      throw new Error(`handles insert failed: ${handleError.message}`);
    }
    const { error: senderError } = await supabase.from("senders").insert({
      user_id: userId,
      platform: "imessage",
      address: options.boundPhone,
      trust_tier: 0,
    });
    if (senderError) {
      throw new Error(`senders insert failed: ${senderError.message}`);
    }

    if (options.linePhone) {
      // Assign the dedicated line, bound to bound_phone from birth (C11).
      const { data: line, error: lineError } = await supabase
        .from("lines")
        .update({
          assigned_user_id: userId,
          assigned_at: new Date().toISOString(),
          role: "personal",
        })
        .eq("phone", options.linePhone)
        .is("assigned_user_id", null)
        .select("id");
      if (lineError || !line || line.length === 0) {
        throw new Error(
          `line assignment failed: ${lineError?.message ?? "line missing or already assigned"}`
        );
      }
      // Invite by deep link, delivered out-of-band by the operator. The user
      // sends first — the agent never texts a fresh line (C13). Text-only
      // body: Apple suppresses links until a reply lands.
      const smsBody = encodeURIComponent(
        `Hi${options.displayName ? ` — this is ${options.displayName}'s agent` : ""}! Send this to get started.`
      );
      inviteLink = `sms:${options.linePhone}&body=${smsBody}`;
      await supabase
        .from("provisioning")
        .update({
          state: "invited",
          invited_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
    }
  }

  const gatewayToken = randomBytes(32).toString("hex");
  const apiServerKey = randomBytes(32).toString("hex");
  const dashPassword = randomBytes(16).toString("hex");
  const dashSecret = randomBytes(32).toString("hex");

  let boxId: string | undefined;
  try {
    return await forkAndConfigure();
  } catch (error) {
    // Roll back the half-provisioned account so a failed attempt leaves no
    // partial user row and no orphan running box.
    if (boxId) {
      try {
        await stop(boxId);
        await deleteBox(boxId);
      } catch (cleanupError) {
        console.log(
          JSON.stringify({
            msg: "provision rollback box cleanup failed",
            box_id: boxId,
            error:
              cleanupError instanceof Error
                ? cleanupError.message
                : String(cleanupError),
          })
        );
      }
    }
    await supabase.from("users").delete().eq("id", userId);
    if (options.linePhone) {
      await supabase
        .from("lines")
        .update({ assigned_user_id: null, assigned_at: null })
        .eq("phone", options.linePhone)
        .eq("assigned_user_id", userId);
    }
    console.log(
      JSON.stringify({ msg: "provision rolled back", user_id: userId })
    );
    throw error;
  }

  async function forkAndConfigure(): Promise<ProvisionResult> {
  const box = await fork({
    templateId: env.boxTemplateId(),
    env: { TENANT_ID: userId, GATEWAY_TOKEN: gatewayToken },
  });
  boxId = box.id;
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
      `OPENAI_BASE_URL=${env.appOrigin()}/api/gateway/v1`,
      "HERMES_DASHBOARD_BASIC_AUTH_USERNAME=air",
      `HERMES_DASHBOARD_BASIC_AUTH_PASSWORD_HASH=${dashHash}`,
      `HERMES_DASHBOARD_BASIC_AUTH_SECRET=${dashSecret}`,
      "HERMES_WEB_DIST=/home/user/.hermes/web_dist",
      "",
    ].join("\n")
  );
  await command(box.id, "chmod 600 /home/user/.hermes/.env");

  // Hermes resolves the custom provider's credential from model.api_key in
  // config.yaml (credential_pool seeds "model_config" when provider=custom
  // and base_url matches) — the value is the box's GATEWAY_TOKEN, never a
  // provider key.
  const gatewayUrl = `${env.appOrigin()}/api/gateway/v1`;
  await command(
    box.id,
    `sed -i -e '/^  api_key:/d' -e 's|base_url:.*|base_url: "${gatewayUrl}"\\n  api_key: "${gatewayToken}"|' /home/user/.hermes/config.yaml`
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
    inviteLink,
  };
  }
}
