/**
 * Environment step: the FIRST onboarding step lets the user pick which
 * computer their agent lives on (ubuntu / omarchy / macos). Choosing a
 * different environment rebuilds the compute via replaceBox — the same row
 * lease the operator reprovision route takes, so a double-tap or a concurrent
 * operator replacement never forks two boxes; the browser only ever sees the
 * three labels, never a provider credential.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MiniAppContext } from "@/lib/miniapps/apps/types";
import { makeApp } from "@/app/mini/loader-test-utils";

const boxFiles = new Map<string, string>();

vi.mock("@/lib/box/client", () => ({
  readFile: vi.fn(async (_boxId: string, path: string) => {
    const value = boxFiles.get(path);
    if (value === undefined) throw new Error("not found");
    return value;
  }),
  writeFile: vi.fn(async (_boxId: string, path: string, content: string) => {
    boxFiles.set(path, content);
  }),
}));
vi.mock("@/lib/orchestrator/boxes", () => ({
  ensureBoxAwake: vi.fn(async () => ({ boxId: "box-1", target: "target-1" })),
  armStopAfter: vi.fn(async () => undefined),
  StartLimitError: class extends Error {},
}));
vi.mock("@/lib/vault/managers", () => ({
  listManagers: vi.fn(async () => []),
  enableManager: vi.fn(),
  ManagerInputError: class extends Error {},
}));
vi.mock("@/lib/imessage/ingest", () => ({
  mintIngestTicket: vi.fn(),
  readIngestStatus: vi.fn(async () => null),
}));
vi.mock("@/lib/commerce/merchants", () => ({
  getMerchant: vi.fn(async () => null),
  startOnboarding: vi.fn(),
}));
vi.mock("@/lib/connectors/manage", () => ({
  TOOLKIT_SLUG_PATTERN: /^[a-z0-9_-]{1,64}$/,
  beginConnect: vi.fn(),
  syncConnections: vi.fn(async () => []),
}));
vi.mock("@/lib/onairos/sync", () => ({
  syncOnairos: vi.fn(),
  onairosStatus: vi.fn(async () => ({
    configured: true,
    status: "disconnected" as const,
    connectedAt: null,
  })),
}));

const replaceBox = vi.fn(async () => ({
  userId: "user-1",
  boxId: "box-2",
  hostedUrl: "https://h.example",
  dashboardUrl: "https://d.example",
  environment: "omarchy" as const,
}));
const switchEnvironment = vi.fn();
const ReplaceInProgressError = vi.hoisted(
  () =>
    class ReplaceInProgressError extends Error {
      constructor(readonly boxId: string) {
        super(`box ${boxId} is already being replaced`);
      }
    }
);
const SwitchSetupError = vi.hoisted(
  () =>
    class SwitchSetupError extends Error {
      constructor(readonly boxId: string) {
        super(`box ${boxId} is live but its setup failed: skills`);
      }
    }
);
vi.mock("@/lib/provisioning/provision", () => ({
  replaceBox: (...args: unknown[]) => replaceBox(...(args as [])),
  switchEnvironment: (...args: unknown[]) =>
    switchEnvironment(...(args as [])),
  ReplaceInProgressError,
  SwitchSetupError,
}));

import { onboarding } from "@/lib/miniapps/apps/onboarding";
import { ONBOARDING_STEPS } from "@/lib/miniapps/onboarding";

beforeAll(() => {
  process.env["MINIAPP_SIGNING_KEY"] = "test-signing-key";
});

function thenable(rows: unknown, single: unknown = null) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  for (const method of ["select", "eq", "is", "order", "limit", "gte", "lt"]) {
    builder[method] = vi.fn(chain);
  }
  builder["maybeSingle"] = async () => ({ data: single, error: null });
  builder["then"] = (
    resolve: (value: { data: unknown; count: number }) => unknown
  ) => Promise.resolve({ data: rows, count: 0 }).then(resolve);
  return builder;
}

function makeCtx(
  url = "https://mini.example/mini/setup?step=environment",
  options: { username?: string | null } = {}
) {
  const username = options.username === undefined ? "grat" : options.username;
  const tables: Record<string, ReturnType<typeof thenable>> = {
    users: thenable([], { username }),
    agent_addresses: thenable(
      [],
      username ? { address: `${username}@wzrd.tech` } : null
    ),
    connections: thenable([]),
    vault_items: thenable([]),
    entitlements: thenable([], { speed_tier: "balanced" }),
    plugin_tokens: thenable([]),
    boxes: thenable([], {
      provider_box_id: "box-1",
      environment: "ubuntu",
      control_url: null,
      control_token: null,
      state: "ready",
    }),
  };
  return {
    request: new NextRequest(url),
    supabase: {
      from: (table: string) => tables[table] ?? thenable([]),
    } as unknown as SupabaseClient,
    app: makeApp({ slug: "setup", kind: "input" }),
    session: { userId: "user-1", resourceId: "default", role: "owner" },
    basePath: "/mini/setup",
  } as MiniAppContext;
}

afterEach(() => {
  replaceBox.mockClear();
  switchEnvironment.mockClear();
  boxFiles.clear();
});

/** A ctx whose boxes row is on omarchy, so choosing ubuntu is a real switch. */
function switchingCtx() {
  const ctx = makeCtx();
  (ctx.supabase as unknown as { from: (t: string) => unknown }).from = (
    table: string
  ) =>
    table === "boxes"
      ? thenable([], {
          provider_box_id: "box-1",
          environment: "omarchy",
          control_url: null,
          control_token: null,
          state: "ready",
        })
      : thenable([], null);
  return ctx;
}

function setEnvironmentForm(environment: string) {
  const form = new FormData();
  form.set("action", "set_environment");
  form.set("environment", environment);
  return form;
}

describe("onboarding environment step", () => {
  it("is the first real step after the welcome intro, before username", () => {
    expect(ONBOARDING_STEPS[0]).toBe("welcome");
    expect(ONBOARDING_STEPS[1]).toBe("environment");
    expect(ONBOARDING_STEPS.indexOf("environment")).toBeLessThan(
      ONBOARDING_STEPS.indexOf("username")
    );
  });

  it("locks slides past Computer until a username exists", async () => {
    const gated = await (
      await onboarding.render(
        makeCtx("https://mini.example/mini/setup?step=imessage", {
          username: null,
        })
      )
    ).text();
    // Deep link into a locked slide lands back on the Computer slide.
    expect(gated).toContain('value="set_username"');
    expect(gated).toContain('<span class="locked"');
    expect(gated).not.toContain("data-swipe-next=");
    expect(gated).toContain("unlock the rest");
    // No skip on the username gate.
    expect(gated).not.toContain('value="skip"><input type="hidden" name="step" value="username"');

    const open = await (
      await onboarding.render(
        makeCtx("https://mini.example/mini/setup?step=imessage")
      )
    ).text();
    expect(open).not.toContain('<span class="locked"');
    expect(open).toContain("data-swipe-next=");

    // A provisioned username unlocks even when the recorded step status is
    // "skipped" — accounts that skipped the step but have an @name aren't gated.
    boxFiles.set(
      ".hermes/miniapps/onboarding/state.json",
      JSON.stringify({
        steps: { username: "skipped" },
        updated_at: "2026-01-01T00:00:00Z",
      })
    );
    const skippedButNamed = await (
      await onboarding.render(
        makeCtx("https://mini.example/mini/setup?step=imessage")
      )
    ).text();
    expect(skippedButNamed).not.toContain('<span class="locked"');
    expect(skippedButNamed).toContain("data-swipe-next=");
  });

  it("widens media-src for the welcome intro film on the live render path", async () => {
    const response = await onboarding.render(
      makeCtx("https://mini.example/mini/setup?step=welcome")
    );
    expect(response.status).toBe(200);
    const csp = response.headers.get("Content-Security-Policy") ?? "";
    expect(csp).toContain("media-src 'self'");
    expect(csp).toContain("script-src 'self'");
    const body = await response.text();
    expect(body).toContain("/creator-os/airintrofin.mp4");
    expect(body).toContain("/creator-os/airintrofin.mov");
    expect(body).toContain("/creator-os/intro-cinematic.js");
    expect(body).toContain("/creator-os/wzrd-wordmark-1600.png");
    // The done-form stays in the DOM for the intro bundle to submit.
    expect(body).toContain('name="step" value="welcome"');
    expect(body).toContain('<html lang="en" class="cine-page">');
    expect(body).toContain('<body class="cine-page" data-swipe-next=');
    expect(body).toContain('<div class="cine" data-intro data-noswipe>');
    expect(body).toContain('class="cine-blast"');
    expect(body).toContain('<button type="button" class="cine-sound" hidden>Sound on</button>');
    expect(body).toContain('<video class="cine-film" playsinline muted');
    expect(body.indexOf("/creator-os/airintrofin.mp4")).toBeLessThan(
      body.indexOf("/creator-os/airintrofin.mov")
    );
    expect(body).toContain("html.cine-page,body.cine-page{background:#000}");
    expect(body).toContain(
      "@media (orientation:portrait){.cine-film{object-fit:cover;object-position:center}}"
    );
    expect(body).not.toContain('<div class="frame"');
    expect(body).not.toContain('<header class="bar">');
    expect(body).not.toContain('<main class="slide">');
    expect(body).not.toContain('<p class="kicker">');
    expect(body).not.toContain("<h1>");
    expect(body).not.toContain('<footer class="nav">');
    expect(body).not.toContain('<section class="panel"');

    const liteCtx = makeCtx("https://mini.example/mini/setup?step=welcome");
    liteCtx.session.via = "card";
    const lite = await (await onboarding.render(liteCtx)).text();
    expect(lite).not.toContain('class="cine-blast"');

    const stepper = await (
      await onboarding.render(makeCtx("https://mini.example/mini/setup?step=selfies"))
    ).text();
    const dots = stepper.match(/<nav class="dots"[^>]*>.*?<\/nav>/)?.[0] ?? "";
    expect(dots.match(/<(?:a|span) /g) ?? []).toHaveLength(6);
    expect(dots).not.toContain("welcome");
    expect(stepper).toContain('data-step="selfies"');
    expect(stepper).toContain('data-step="twin"');
    expect(stepper).toContain('data-step="avatar"');
    expect(stepper).toContain('data-section="booth_photo"');
    expect(stepper).toContain('data-section="photo_select"');
    expect(stepper).toContain('data-section="sheet"');
    expect(stepper).toContain('data-section="booth_video"');
    expect(stepper).toContain('data-section="twin_create"');
    expect(stepper).toContain('data-section="avatar"');
  });

  it("renders the three environment choices with no provider names leaking", async () => {
    const response = await onboarding.render(makeCtx());
    expect(response.status).toBe(200);
    const body = await response.text();
    // Only the live default is submittable; the other two render as
    // coming-soon cards with no form.
    expect(body).toContain('value="ubuntu"');
    expect(body).not.toContain('value="omarchy"');
    expect(body).not.toContain('value="macos"');
    expect(body).toContain("Soon");
    expect(body).toContain("Ubuntu");
    expect(body).toContain("Omarchy");
    expect(body).toContain("macOS");
    expect(body).not.toContain("ascii.dev");
    expect(body).not.toContain("Namespace");
  });

  it("a coming-soon environment never rebuilds the compute", async () => {
    const form = new FormData();
    form.set("action", "set_environment");
    form.set("environment", "omarchy");
    const response = await onboarding.action!(makeCtx(), form);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("coming soon");
    expect(replaceBox).not.toHaveBeenCalled();
    expect(switchEnvironment).not.toHaveBeenCalled();
    const state = JSON.parse(
      boxFiles.get(".hermes/miniapps/onboarding/state.json") ?? "{}"
    );
    expect(state.steps?.environment ?? "todo").toBe("todo");
  });

  it("keeping the current environment never rebuilds the compute", async () => {
    const form = new FormData();
    form.set("action", "set_environment");
    form.set("environment", "ubuntu");
    const response = await onboarding.action!(makeCtx(), form);
    expect(response.status).toBe(200);
    expect(replaceBox).not.toHaveBeenCalled();
    expect(switchEnvironment).not.toHaveBeenCalled();
    const state = JSON.parse(
      boxFiles.get(".hermes/miniapps/onboarding/state.json") ?? "{}"
    );
    expect(state.steps.environment).toBe("done");
  });

  it("a real switch leases the current box through replaceBox", async () => {
    const response = await onboarding.action!(
      switchingCtx(),
      setEnvironmentForm("ubuntu")
    );
    expect(response.status).toBe(200);
    expect(replaceBox).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "box-1",
      "ubuntu"
    );
    expect(switchEnvironment).not.toHaveBeenCalled();
    expect(await response.text()).toContain("now lives on Ubuntu");
    const state = JSON.parse(
      boxFiles.get(".hermes/miniapps/onboarding/state.json") ?? "{}"
    );
    expect(state.steps.environment).toBe("done");
  });

  it("a switch already in flight keeps the step open without forking again", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    replaceBox.mockRejectedValueOnce(new ReplaceInProgressError("box-1"));
    const response = await onboarding.action!(
      switchingCtx(),
      setEnvironmentForm("ubuntu")
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("already being moved");
    const state = JSON.parse(
      boxFiles.get(".hermes/miniapps/onboarding/state.json") ?? "{}"
    );
    expect(state.steps?.environment ?? "todo").toBe("todo");
  });

  it("a setup failure after the row moved still marks the step done and says so", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    replaceBox.mockRejectedValueOnce(new SwitchSetupError("box-2"));
    const response = await onboarding.action!(
      switchingCtx(),
      setEnvironmentForm("ubuntu")
    );
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("now lives on Ubuntu");
    expect(body).toContain("starter skills");
    const state = JSON.parse(
      boxFiles.get(".hermes/miniapps/onboarding/state.json") ?? "{}"
    );
    expect(state.steps.environment).toBe("done");
  });

  it("rejects an unknown environment value", async () => {
    const form = new FormData();
    form.set("action", "set_environment");
    form.set("environment", "windows");
    const response = await onboarding.action!(makeCtx(), form);
    expect(response.status).toBe(403);
    expect(replaceBox).not.toHaveBeenCalled();
  });

  it("a failed switch keeps the step open with a retry notice", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    replaceBox.mockRejectedValueOnce(new Error("box gone"));
    const response = await onboarding.action!(
      switchingCtx(),
      setEnvironmentForm("ubuntu")
    );
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("isn't available right now");
    const state = JSON.parse(
      boxFiles.get(".hermes/miniapps/onboarding/state.json") ?? "{}"
    );
    expect(state.steps?.environment ?? "todo").toBe("todo");
  });

  it("old box-side state files without the environment key still load", async () => {
    boxFiles.set(
      ".hermes/miniapps/onboarding/state.json",
      JSON.stringify({
        steps: { username: "done" },
        updated_at: "2026-01-01T00:00:00Z",
      })
    );
    const response = await onboarding.render(
      makeCtx("https://mini.example/mini/setup")
    );
    expect(response.status).toBe(200);
    const body = await response.text();
    // The pre-migration state normalizes: environment defaults to todo, so
    // the first open step is the environment slide.
    expect(body).toContain("value=\"set_environment\"");
  });
});
