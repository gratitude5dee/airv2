/**
 * M1 provisioning: users + entitlements → create the user's compute in their
 * chosen environment (fork the environment's template box for ubuntu/omarchy,
 * start a Namespace instance for macos) → write per-box secrets → point the model base
 * URL at the gateway → register hosted routes → persist the boxes row. No
 * provider key ever enters the box (C2).
 *
 * The environment only changes WHERE the agent runs: the per-box secret set,
 * the config.yaml rewrite, the skills, and the Composio connector install are
 * the same in all three, and run through lib/compute/runtime.ts.
 */
import { randomBytes } from "node:crypto";
import { env } from "../env";
import { serviceClient } from "../supabase";
import { command, fork, waitForBox } from "../box/client";
import {
  createMacInstance,
  publishMacIngress,
  waitForBridge,
  waitForInstance,
  BRIDGE_PORT,
  DASHBOARD_PORT as NS_DASHBOARD_PORT,
  HERMES_PORT as NS_HERMES_PORT,
} from "../namespace/client";
import {
  DEFAULT_ENVIRONMENT,
  kindFor,
  profileFor,
  type ComputeEnvironment,
} from "../compute/environments";
import {
  destroyCompute,
  restartServices,
  runCommand,
  stopCompute,
  writeComputeFile,
  type ComputeTarget,
} from "../compute/runtime";
import { installComposioMcp } from "./connectors";
import { provisionDaytona } from "./daytona";
import { normalizeAddress } from "../routing/trust";
import { sealSecret } from "../crypto/secretbox";
import { installBaseSkills } from "../skills/hub";
import { templateForEnvironment } from "../fleet/channels";

export interface ProvisionOptions {
  displayName?: string | undefined;
  boundPhone?: string | undefined;
  linePhone?: string | undefined;
  operator?: string | undefined;
  /** Compute the agent lives on. Defaults to ubuntu — the original path. */
  environment?: ComputeEnvironment | undefined;
}

export interface ProvisionResult {
  userId: string;
  boxId: string;
  hostedUrl: string;
  dashboardUrl: string;
  environment: ComputeEnvironment;
  inviteLink?: string | undefined;
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

interface HostedRoute {
  url: string;
  token: string;
}

interface ComputeRoutes {
  hermes: HostedRoute;
  dashboard: HostedRoute;
}

/** Everything the boxes row needs about a freshly built compute instance. */
interface ProvisionedCompute {
  target: ComputeTarget;
  routes: ComputeRoutes;
  templateHermesRef: string | null;
  gatewayToken: string;
  apiServerKey: string;
  dashPassword: string;
}

/** A created instance, plus any ingress the provider allocated with it. */
interface CreatedInstance {
  target: ComputeTarget;
  /** Public URLs of exported ports, when the provider allocates them eagerly. */
  ports: Record<number, string>;
}

/** Template pointer fallback per environment (null = registration required). */
function templateFallback(environment: ComputeEnvironment): string | null {
  switch (environment) {
    case "ubuntu":
      return env.boxTemplateId();
    case "omarchy":
      return env.omarchyTemplateId();
    case "macos":
      return env.macBootstrapUrl();
  }
}

export async function provisionUser(
  options: ProvisionOptions = {}
): Promise<ProvisionResult> {
  const supabase = serviceClient();
  const environment = options.environment ?? DEFAULT_ENVIRONMENT;

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
    // Stored in the same canonical form the router compares against
    // (routing/trust.ts), so the owner's texts resolve to tier 0.
    const boundPhone = normalizeAddress("imessage", options.boundPhone);
    const { error: provisioningError } = await supabase
      .from("provisioning")
      .insert({
        user_id: userId,
        state: "created",
        bound_phone: boundPhone,
        operator: options.operator ?? null,
      });
    if (provisioningError) {
      throw new Error(`provisioning insert failed: ${provisioningError.message}`);
    }
    const { error: handleError } = await supabase.from("handles").insert({
      user_id: userId,
      platform: "imessage",
      address: boundPhone,
    });
    if (handleError) {
      throw new Error(`handles insert failed: ${handleError.message}`);
    }
    const { error: senderError } = await supabase.from("senders").insert({
      user_id: userId,
      platform: "imessage",
      address: boundPhone,
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

  let built: ProvisionedCompute | undefined;
  try {
    built = await buildCompute(supabase, userId, environment);
    await persistBox(supabase, userId, environment, built);
    await finishSetup(supabase, userId, built.target);
    return {
      userId,
      boxId: built.target.instanceId,
      hostedUrl: built.routes.hermes.url,
      dashboardUrl: built.routes.dashboard.url,
      environment,
      inviteLink,
    };
  } catch (error) {
    // Roll back the half-provisioned account so a failed attempt leaves no
    // partial user row and no orphan running instance.
    if (built) {
      await teardown(built.target);
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
}

/**
 * Move an existing user to a different environment: build the new compute,
 * repoint the boxes row at it, then tear the old instance down. The user's
 * account, line, and connectors are untouched — the connectors are re-installed
 * on the new machine by finishSetup (Composio is provider-agnostic: the same
 * per-user MCP URL is registered wherever the agent happens to live).
 */
export async function switchEnvironment(
  supabase: ReturnType<typeof serviceClient>,
  userId: string,
  environment: ComputeEnvironment
): Promise<ProvisionResult> {
  const { data: existing, error } = await supabase
    .from("boxes")
    .select("provider_box_id, environment, control_url, control_token")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(`box lookup failed for user ${userId}: ${error.message}`);
  }
  const previous = existing
    ? {
        instanceId: (existing as { provider_box_id: string }).provider_box_id,
        environment:
          ((existing as { environment: string | null }).environment ??
            DEFAULT_ENVIRONMENT) as ComputeEnvironment,
        control:
          (existing as { control_url: string | null }).control_url &&
          (existing as { control_token: string | null }).control_token
            ? {
                url: (existing as { control_url: string }).control_url,
                token: (existing as { control_token: string }).control_token,
              }
            : undefined,
      }
    : null;

  const built = await buildCompute(supabase, userId, environment);
  try {
    await persistBox(supabase, userId, environment, built);
  } catch (persistError) {
    await teardown(built.target);
    throw persistError;
  }
  await finishSetup(supabase, userId, built.target);
  if (previous && previous.instanceId !== built.target.instanceId) {
    await teardown(previous);
  }
  return {
    userId,
    boxId: built.target.instanceId,
    hostedUrl: built.routes.hermes.url,
    dashboardUrl: built.routes.dashboard.url,
    environment,
  };
}

async function teardown(target: ComputeTarget): Promise<void> {
  try {
    await stopCompute(target);
    await destroyCompute(target);
  } catch (error) {
    console.log(
      JSON.stringify({
        msg: "compute teardown failed",
        box_id: target.instanceId,
        environment: target.environment,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

/**
 * Create the instance and bring it to the state the boxes row describes:
 * per-instance secrets merged into ~/.hermes/.env, config.yaml pointed at the
 * gateway, services restarted, Hermes + dashboard published.
 */
async function buildCompute(
  supabase: ReturnType<typeof serviceClient>,
  userId: string,
  environment: ComputeEnvironment
): Promise<ProvisionedCompute> {
  const profile = profileFor(environment);
  const gatewayToken = randomBytes(32).toString("hex");
  const apiServerKey = randomBytes(32).toString("hex");
  const dashPassword = randomBytes(16).toString("hex");
  const dashSecret = randomBytes(32).toString("hex");
  // V1 (C18): the AIR Vault store key. Minted per box, lives ONLY in the
  // box's .env — never persisted in Postgres or logged by the control plane.
  const airVaultKey = randomBytes(32).toString("hex");

  // New users come from the prod channel's template for their environment;
  // the static env var pointer is the fallback until the channel is
  // bootstrapped (ubuntu only — the others must be registered).
  const templateId = await templateForEnvironment(
    supabase,
    "prod",
    environment,
    templateFallback(environment)
  );

  const created = await createInstance(
    userId,
    environment,
    templateId,
    gatewayToken
  );
  const target = created.target;

  // V0: which Hermes is this instance on — read the SHA the template baked at
  // build time so support can answer from the boxes row alone.
  const refResult = await runCommand(
    target,
    `cat ${profile.homeDir}/.hermes/.template-hermes-ref 2>/dev/null || true`
  );
  const templateHermesRef = refResult.stdout.trim() || null;

  const hashResult = await runCommand(
    target,
    `cd ${profile.homeDir}/hermes-agent && ${profile.homeDir}/.hermes-venv/bin/python -c "from plugins.dashboard_auth.basic import hash_password; print(hash_password('${dashPassword}'))"`,
    120
  );
  if (hashResult.exitCode !== 0) {
    throw new Error(`dashboard hash failed: ${hashResult.stderr}`);
  }
  const dashHash = hashResult.stdout.trim();

  // Per-box secrets. OPENAI_API_KEY carries the GATEWAY_TOKEN — it is the
  // credential Hermes presents to OUR gateway, never a provider key.
  // Merged into the template's .env (not a wholesale rewrite) so template-time
  // runtime settings — PATH/DISPLAY/AGENT_BROWSER_ARGS for the browser tool,
  // CREATIVE_PLUGIN_VERSION — survive the fork.
  const perBoxEnv = [
    `API_SERVER_KEY=${apiServerKey}`,
    "API_SERVER_HOST=0.0.0.0",
    `OPENAI_API_KEY=${gatewayToken}`,
    `OPENAI_BASE_URL=${env.appOrigin()}/api/gateway/v1`,
    "HERMES_DASHBOARD_BASIC_AUTH_USERNAME=air",
    `HERMES_DASHBOARD_BASIC_AUTH_PASSWORD_HASH=${dashHash}`,
    `HERMES_DASHBOARD_BASIC_AUTH_SECRET=${dashSecret}`,
    `HERMES_WEB_DIST=${profile.homeDir}/.hermes/web_dist`,
    `AIR_VAULT_KEY=${airVaultKey}`,
    "",
  ];
  await writeComputeFile(target, ".hermes/.env.perbox", perBoxEnv.join("\n"));
  const envKeys = perBoxEnv
    .map((line) => line.split("=")[0])
    .filter((key) => key !== "");
  const envPath = `${profile.homeDir}/.hermes/.env`;
  const mergeResult = await runCommand(
    target,
    `touch ${envPath} && sed -i${sedSuffix(environment)} ${envKeys
      .map((key) => `-e '/^${key}=/d'`)
      .join(" ")} ${envPath} && cat ${envPath}.perbox >> ${envPath} && rm ${envPath}.perbox && chmod 600 ${envPath}`
  );
  if (mergeResult.exitCode !== 0) {
    throw new Error(`env merge failed: ${mergeResult.stderr}`);
  }

  // Hermes resolves the custom provider's credential from model.api_key in
  // config.yaml (credential_pool seeds "model_config" when provider=custom
  // and base_url matches) — the value is the box's GATEWAY_TOKEN, never a
  // provider key.
  const gatewayUrl = `${env.appOrigin()}/api/gateway/v1`;
  await runCommand(
    target,
    `sed -i${sedSuffix(environment)} -e '/^  api_key:/d' -e 's|base_url:.*|base_url: "${gatewayUrl}"\\n  api_key: "${gatewayToken}"|' ${profile.homeDir}/.hermes/config.yaml`
  );

  await restartServices(target);

  const routes = await publishRoutes(target, created.ports);
  return {
    target,
    routes,
    templateHermesRef,
    gatewayToken,
    apiServerKey,
    dashPassword,
  };
}

/** BSD sed on macOS needs an explicit backup suffix; GNU sed must not have one. */
function sedSuffix(environment: ComputeEnvironment): string {
  return kindFor(environment) === "native" ? " ''" : "";
}

/**
 * The per-provider create step. `templateId` is the environment's template
 * pointer: a template box id (ubuntu, omarchy — both fork on ascii.dev), or
 * the URL of the bootstrap script the Mac builds itself from (macos) —
 * Namespace has no snapshot fork.
 */
async function createInstance(
  userId: string,
  environment: ComputeEnvironment,
  templateId: string,
  gatewayToken: string
): Promise<CreatedInstance> {
  const instanceEnv = { TENANT_ID: userId, GATEWAY_TOKEN: gatewayToken };
  switch (kindFor(environment)) {
    case "box": {
      const box = await fork({ templateId, env: instanceEnv });
      await waitForBox(box.id);
      return { target: { instanceId: box.id, environment }, ports: {} };
    }
    case "native": {
      const bridgeToken = randomBytes(32).toString("hex");
      const instance = await createMacInstance({
        bootstrapUrl: templateId,
        env: instanceEnv,
        bridgeToken,
      });
      await waitForInstance(instance.id);
      const ingress = await publishMacIngress(instance.id);
      const bridge = ingress[BRIDGE_PORT];
      if (!bridge) {
        throw new Error(`mac ${instance.id} bridge ingress missing`);
      }
      await waitForBridge({
        instanceId: instance.id,
        controlUrl: bridge.url,
        controlToken: bridgeToken,
      });
      return {
        target: {
          instanceId: instance.id,
          environment,
          control: { url: bridge.url, token: bridgeToken },
        },
        ports: Object.fromEntries(
          Object.entries(ingress).map(([port, entry]) => [port, entry.url])
        ),
      };
    }
  }
}

/** Publish Hermes (8642) and the dashboard (9119) for the control plane. */
async function publishRoutes(
  target: ComputeTarget,
  ports: Record<number, string>
): Promise<ComputeRoutes> {
  if (kindFor(target.environment) === "box") {
    const hostResult = await command(
      target.instanceId,
      `eval "$(grep '^export ASCII_' /home/user/.bashrc)"; /home/user/.ascii/host url 8642 --timeout 120 --private && /home/user/.ascii/host url 9119 --timeout 120 --private`,
      300
    );
    if (hostResult.exitCode !== 0) {
      throw new Error(`host registration failed: ${hostResult.stderr}`);
    }
    return {
      hermes: parseHostedUrl(hostResult.stdout, 8642),
      dashboard: parseHostedUrl(hostResult.stdout, 9119),
    };
  }
  const hermes = ports[NS_HERMES_PORT];
  const dashboard = ports[NS_DASHBOARD_PORT];
  if (!hermes || !dashboard) {
    throw new Error(
      `instance ${target.instanceId} ingress missing hermes/dashboard`
    );
  }
  // Namespace ingress URLs carry no per-route token (the services authenticate
  // themselves with API_SERVER_KEY / dashboard basic auth), so the hosted-token
  // slot stays empty rather than holding a fake secret.
  return {
    hermes: { url: hermes, token: "" },
    dashboard: { url: dashboard, token: "" },
  };
}

async function persistBox(
  supabase: ReturnType<typeof serviceClient>,
  userId: string,
  environment: ComputeEnvironment,
  built: ProvisionedCompute
): Promise<void> {
  const dashboardAuthKey = env.boxDashboardAuthKey();
  if (!dashboardAuthKey) {
    console.log(
      JSON.stringify({
        msg: "BOX_DASHBOARD_AUTH_KEY unset — dashboard credential not persisted",
        user_id: userId,
      })
    );
  }
  const { error } = await supabase.from("boxes").upsert(
    {
      user_id: userId,
      provider: profileFor(environment).provider,
      provider_box_id: built.target.instanceId,
      environment,
      state: "ready",
      hosted_url: built.routes.hermes.url,
      hosted_token: built.routes.hermes.token,
      // The dashboard route backs the allowlisted History/Skills proxy on every
      // surface, so it has to outlive provisioning.
      dashboard_url: built.routes.dashboard.url,
      dashboard_token: built.routes.dashboard.token,
      // Sealed basic-auth password for dashboard (9119) surfaces the proxy is
      // allowed to reach (CM1 task 0 / CC10, see SECURITY-DECISIONS.md).
      dashboard_auth: dashboardAuthKey
        ? sealSecret(built.dashPassword, dashboardAuthKey)
        : null,
      control_url: built.target.control?.url ?? null,
      control_token: built.target.control?.token ?? null,
      api_server_key: built.apiServerKey,
      gateway_token: built.gatewayToken,
      template_version: built.templateHermesRef,
      channel: "prod",
      last_active_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) {
    throw new Error(`boxes insert failed: ${error.message}`);
  }
}

/**
 * Best-effort: base skills, the per-user Composio MCP endpoint, and the
 * Daytona child key, so a fresh agent starts with its email/search skills and
 * connector tooling. Identical in every environment — failures log and
 * continue, the user can install from the dashboard.
 */
async function finishSetup(
  supabase: ReturnType<typeof serviceClient>,
  userId: string,
  target: ComputeTarget
): Promise<void> {
  await installBaseSkills(target);
  try {
    await installComposioMcp(supabase, userId, target);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(
      JSON.stringify({ msg: "composio preinstall failed", user_id: userId, error: message })
    );
  }
  // P1-11: per-user Daytona child key — the template carries no credential.
  try {
    await provisionDaytona(target, userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(
      JSON.stringify({ msg: "daytona key injection failed", user_id: userId, error: message })
    );
  }
}
