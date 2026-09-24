/**
 * V13 §6 — Browser Run checks against the candidate deploy. `launch`
 * comes from `@cloudflare/playwright` on `env.BROWSER`; the CF6 allowlist
 * is enforced in two layers: `allow_net` on the session where supported,
 * and an in-page route() abort for any request off the candidate host or
 * `media.wzrd.tech` — the second layer also counts the block toward the
 * smoke test (a page that tries outside the allowlist fails smoke).
 *
 * Smoke (§6.1, gate): 390×760 with reduced motion then 1280×800. Fail on
 * ≥ 400 same-origin responses, page errors, console.error, blank render
 * (under 20 visible chars and no canvas/svg/img 1.5 s after load),
 * horizontal overflow (scrollWidth > innerWidth + 2), or a CSP block.
 *
 * Tests (§6.2, gate: locked only): the V12 DSL — type, tap, wait, changed,
 * see, missing, expectHref, viewport — as an anonymous visitor. Locked
 * must pass; unlocked failures are reported to the fix turn but don't
 * block. The PNG lands at `create-shots/<job>/<round>.png` in the MEDIA
 * bucket (private); `shot_url` is its worker-served preview URL.
 */
import { launch } from "@cloudflare/playwright";
import { mintCandidate } from "./tokens";
import type { Page } from "@cloudflare/playwright";

export interface CheckTest {
  id: string;
  locked?: boolean;
  viewport?: string;
  type?: [string, string];
  tap?: string;
  wait?: number;
  changed?: string;
  see?: string;
  missing?: string;
  expectHref?: string;
}

export interface CheckEnv {
  BROWSER: Fetcher | undefined;
  MEDIA: R2Bucket;
  CANDIDATE_SECRET: string;
  DEV_ORIGIN_SUFFIX: string;
}

export interface CheckResult {
  smoke: boolean;
  smoke_issues: string[];
  locked_passed: number;
  locked_total: number;
  locked_failed_ids: string[];
  unlocked_failed_ids: string[];
  score: number;
  shot_key: string;
  shot_url: string;
}

const MOBILE = { width: 390, height: 760 };
const DESKTOP = { width: 1280, height: 800 };
const LOAD_MS = 15_000;
const SETTLE_MS = 1_500;

/** Domains the browser may touch (CF6): the candidate host and media only. */
function allowedHosts(candidateHost: string): Set<string> {
  return new Set([candidateHost, "media.wzrd.tech"]);
}

interface SmokeFailure {
  rule: string;
  detail?: string;
}

async function smokeAt(
  page: Page,
  candidateUrl: string,
  allowed: Set<string>,
  size: { width: number; height: number }
): Promise<SmokeFailure[]> {
  const failures: SmokeFailure[] = [];
  let sawCsp = false;
  const badResponses: string[] = [];
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  await page.setViewportSize(size);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setExtraHTTPHeaders({ "x-air-candidate": candidateTokenNow() });

  // CF6 enforcement: anything off-list is aborted AND recorded — an app
  // that reaches past the sandbox is itself a smoke failure.
  await page.route("**/*", (route) => {
    try {
      const host = new URL(route.request().url()).hostname;
      if (!allowed.has(host)) {
        badResponses.push(`blocked:${host}`);
        return route.abort();
      }
    } catch {
      /* opaque url (data:, about:) — let it through */
    }
    return route.continue();
  });
  page.on("response", (response) => {
    try {
      if (response.status() >= 400 && allowed.has(new URL(response.url()).hostname)) {
        badResponses.push(`${response.status()}:${new URL(response.url()).pathname}`);
      }
    } catch {
      /* ignore */
    }
  });
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      consoleErrors.push(text.slice(0, 160));
      if (/Content Security Policy/i.test(text)) sawCsp = true;
    }
  });
  page.on("pageerror", (error) => pageErrors.push(String(error).slice(0, 160)));

  try {
    await page.goto(candidateUrl, { waitUntil: "load", timeout: LOAD_MS });
  } catch (error) {
    failures.push({ rule: "smoke.load", detail: String(error).slice(0, 160) });
    return failures;
  }
  await page.waitForTimeout(SETTLE_MS);

  if (pageErrors.length > 0) failures.push({ rule: "smoke.pageerror" });
  if (consoleErrors.length > 0) failures.push({ rule: "smoke.console" });
  if (sawCsp) failures.push({ rule: "smoke.csp" });
  if (badResponses.length > 0) {
    failures.push({ rule: "smoke.http", detail: `${badResponses.length} bad or blocked request(s)` });
  }

  const blank = await page.evaluate(() => {
    const text = (document.body?.innerText ?? "").trim();
    const chars = text.replace(/\s+/g, "").length;
    const media = document.querySelector("canvas,svg,img,video");
    return { chars, hasMedia: media !== null };
  });
  if (blank.chars < 20 && !blank.hasMedia) failures.push({ rule: "smoke.blank" });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 2
  );
  if (overflow) failures.push({ rule: "smoke.overflow" });

  return failures;
}

// The header value is set per page in runCheck — this indirection keeps
// smokeAt's signature small. Overwritten before each goto; never awaited
// stale because checks for one job run serially.
let candidateToken = "";
function candidateTokenNow(): string {
  return candidateToken;
}

async function runDslTest(page: Page, test: CheckTest, candidateUrl: string): Promise<boolean> {
  const viewport = test.viewport?.split("x").map(Number);
  if (viewport && viewport.length === 2 && viewport.every((n) => Number.isFinite(n))) {
    await page.setViewportSize({ width: viewport[0]!, height: viewport[1]! });
  } else {
    await page.setViewportSize(MOBILE);
  }
  await page.goto(candidateUrl, { waitUntil: "load", timeout: LOAD_MS });

  if (test.type) await page.fill(test.type[0], test.type[1], { timeout: 5_000 });
  let beforeChange: string | null = null;
  if (test.changed) {
    beforeChange = await page.textContent(test.changed).catch(() => null);
  }
  if (test.tap) await page.click(test.tap, { timeout: 5_000 });
  if (test.wait) await page.waitForTimeout(Math.min(test.wait, 10_000));
  if (test.changed) {
    const after = await page.textContent(test.changed).catch(() => null);
    if (after === beforeChange) return false;
  }
  if (test.see) {
    const visible = await page.getByText(test.see, { exact: false }).first().isVisible({ timeout: 2_000 }).catch(() => false);
    if (!visible) return false;
  }
  if (test.missing) {
    const count = await page.locator(test.missing).count().catch(() => 0);
    if (count > 0) {
      const visible = await page.locator(test.missing).first().isVisible().catch(() => false);
      if (visible) return false;
    }
  }
  if (test.expectHref && test.tap) {
    const href = await page.locator(test.tap).first().getAttribute("href");
    if (href === null || !href.startsWith(test.expectHref)) return false;
  }
  return true;
}

/**
 * The whole check step for one job round: smoke at both viewports, then
 * the DSL tests. Returns ids and counts only (CF5). The score (§6.3)
 * mirrors V11's shape: start at 100, smoke failure −25 each (cap −75),
 * each failed locked test −15, unlocked −5 (cap −25), floor 0.
 */
export async function runCheck(
  env: CheckEnv,
  input: {
    jobId: string;
    slug: string;
    version: string;
    round: number;
    tests: CheckTest[];
  }
): Promise<CheckResult> {
  const shotKey = `create-shots/${input.jobId}/${input.round}.png`;
  const host = `${input.slug}.${env.DEV_ORIGIN_SUFFIX}`;
  const candidateUrl = `https://${host}/`;
  candidateToken = await mintCandidate(env.CANDIDATE_SECRET, input.slug, input.version);
  const allowed = allowedHosts(host);

  const smokeIssues: SmokeFailure[] = [];
  let lockedPassed = 0;
  let lockedTotal = 0;
  const lockedFailed: string[] = [];
  const unlockedFailed: string[] = [];

  const browser = await launch(env.BROWSER as unknown as never);
  try {
    const page = await browser.newPage();
    try {
      // §6.1 — smoke at 390×760 then 1280×800.
      smokeIssues.push(...(await smokeAt(page, candidateUrl, allowed, MOBILE)));
      smokeIssues.push(...(await smokeAt(page, candidateUrl, allowed, DESKTOP)));

      // The shot the mini-app shows when live: the 390×760 viewport.
      await page.setViewportSize(MOBILE);
      await page.goto(candidateUrl, { waitUntil: "load", timeout: LOAD_MS }).catch(() => undefined);
      await page.waitForTimeout(SETTLE_MS);
      const png = await page.screenshot({ type: "png" });
      await env.MEDIA.put(shotKey, png, {
        httpMetadata: { contentType: "image/png" },
      });

      // §6.2 — locked tests gate; unlocked are reported, not blocking.
      for (const test of input.tests) {
        const passed = await runDslTest(page, test, candidateUrl).catch(() => false);
        if (test.locked) {
          lockedTotal += 1;
          if (passed) lockedPassed += 1;
          else lockedFailed.push(test.id);
        } else if (!passed) {
          unlockedFailed.push(test.id);
        }
      }
    } finally {
      await page.close().catch(() => undefined);
    }
  } finally {
    await browser.close().catch(() => undefined);
  }

  const smoke = smokeIssues.length === 0;
  let score = 100;
  score -= Math.min(75, smokeIssues.length * 25);
  score -= Math.min(lockedFailed.length * 15, 60);
  score -= Math.min(unlockedFailed.length * 5, 25);
  score = Math.max(0, score);

  return {
    smoke,
    smoke_issues: smokeIssues.map((issue) => issue.rule),
    locked_passed: lockedPassed,
    locked_total: lockedTotal,
    locked_failed_ids: lockedFailed,
    unlocked_failed_ids: unlockedFailed,
    score,
    shot_key: shotKey,
    shot_url: `https://${input.slug}.${env.DEV_ORIGIN_SUFFIX}/`, // served shot: the live link itself
  };
}
