#!/usr/bin/env node
// Build the Tenki template snapshot: the same infra/template/setup.sh the
// ascii.dev template Box runs, executed as the `user` account on a fresh Tenki
// Sandbox session, then frozen with an async snapshot of the running VM.
// Prints the value to put in TENKI_TEMPLATE_ID (`tenki:<snapshot id>`).
//
//   TENKI_API_KEY=... node scripts/tenki-template.mjs [--session <id>] [--keep] [--snapshot-only]
//
// --session reuses a running session (incremental rebuilds); otherwise a
// fresh 4c/8g/40g session is created. --snapshot-only (with --session) skips
// straight to verify + snapshot of a session setup.sh already finished in.
// The build session is closed afterwards unless --keep is given (it is left
// running; never paused — pausing a session with this much written to disk
// trips the provider's guest liveness watchdog and terminates it).
import { spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { TenkiSandbox, stderrText, stdoutText } from "@tenkicloud/sandbox";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");
const templateDir = join(repoRoot, "infra", "template");

const args = process.argv.slice(2);
const flag = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? (args[index + 1] ?? true) : undefined;
};
const sessionArg = flag("--session");
const keep = args.includes("--keep");
const snapshotOnly = args.includes("--snapshot-only");
if (snapshotOnly && typeof sessionArg !== "string") {
  console.error("--snapshot-only requires --session <id>");
  process.exit(2);
}

const authToken = process.env["TENKI_API_KEY"];
if (!authToken) {
  console.error("TENKI_API_KEY is required");
  process.exit(2);
}
const tk = new TenkiSandbox({ authToken });

const BOX_USER = "user";
const HOME_DIR = `/home/${BOX_USER}`;

function log(message) {
  console.error(`[tenki-template] ${message}`);
}

async function sh(session, script, { as = null, timeoutMs = 20 * 60 * 1000 } = {}) {
  const argv = as
    ? ["sudo", ["-H", "-u", as, "bash", "-lc", `cd ${HOME_DIR}\n${script}`]]
    : ["bash", ["-lc", script]];
  const stream = await session.stream(argv[0], { args: argv[1], timeoutMs });
  const decoder = new TextDecoder();
  for (let chunk = await stream.next(); chunk; chunk = await stream.next()) {
    process.stderr.write(decoder.decode(chunk.data));
  }
  const result = await stream.wait();
  if (result.exitCode !== 0) {
    throw new Error(`command failed (${result.exitCode}): ${script.split("\n")[0]}`);
  }
}

async function shOut(session, script) {
  const result = await session.exec("bash", { args: ["-lc", script], timeoutMs: 120_000 });
  if (result.exitCode !== 0) {
    throw new Error(`${script}: ${stderrText(result)}`);
  }
  return stdoutText(result);
}

async function obtainSession() {
  if (typeof sessionArg === "string") {
    const existing = await tk.get(sessionArg);
    if (existing.state === "PAUSING") {
      log(`waiting for ${existing.id} to finish pausing`);
      await existing.waitPaused();
    }
    if (existing.state === "PAUSED") {
      log(`resuming ${existing.id}`);
      await existing.resume();
      await existing.waitResumed();
    }
    return existing;
  }
  log("creating a fresh 4c/8g/40g session");
  return tk.createAndWait({
    name: `air-template-build-${new Date().toISOString().slice(0, 10)}`,
    cpuCores: 4,
    memoryMb: 8192,
    diskSizeGb: 40,
    allowInbound: true,
    allowOutbound: true,
    sticky: true,
    metadata: { air: "template-build" },
  });
}

async function bootstrap(session) {
  // The VM's default account has passwordless sudo; the template runs as
  // `user` with the same layout ascii boxes have (/home/user, sudo, bash).
  await sh(
    session,
    [
      "set -euo pipefail",
      `id -u ${BOX_USER} >/dev/null 2>&1 || sudo useradd -m -s /bin/bash ${BOX_USER}`,
      `printf '%s ALL=(ALL) NOPASSWD:ALL\\n' ${BOX_USER} | sudo tee /etc/sudoers.d/90-box-user >/dev/null`,
      "sudo chmod 440 /etc/sudoers.d/90-box-user",
      // The base image's journal directory is gone (journald logs "Failed to
      // create new system journal"); a restart recreates it so unit logs
      // are readable in the template and every box forked from it.
      "sudo mkdir -p /var/log/journal && sudo systemctl restart systemd-journald",
      "sudo apt-get update -qq",
      "sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends " +
        "git curl ca-certificates sudo python3 python3-venv build-essential cmake pkg-config " +
        "libssl-dev unzip rsync jq",
    ].join("\n")
  );
}

async function uploadTemplate(session) {
  const archive = join(tmpdir(), `air-template-${process.pid}.tgz`);
  const tar = spawnSync(
    "tar",
    ["-czf", archive, "-C", dirname(templateDir), "--exclude=__pycache__", "template"],
    { stdio: "inherit" }
  );
  if (tar.status !== 0) throw new Error("tar failed");
  try {
    // The file API is confined to the VM account's workdir (relative paths
    // resolve there); the shell then moves it into the box user's home.
    await session.writeFile("air-template.tgz", readFileSync(archive));
  } finally {
    rmSync(archive, { force: true });
  }
  await sh(
    session,
    [
      "set -euo pipefail",
      `sudo rm -rf ${HOME_DIR}/air-template`,
      `sudo mkdir -p ${HOME_DIR}/air-template`,
      `sudo tar -xzf "$HOME"/air-template.tgz -C ${HOME_DIR}/air-template --strip-components=1`,
      `sudo chown -R ${BOX_USER}:${BOX_USER} ${HOME_DIR}/air-template`,
      'rm -f "$HOME"/air-template.tgz',
    ].join("\n")
  );
}

const SETUP_LOG = `${HOME_DIR}/air-template-setup.log`;
const SETUP_RC = `${HOME_DIR}/air-template-setup.rc`;

// setup.sh runs for tens of minutes; a single exec that long dies at the
// provider's HTTP edge, so it runs detached and the script polls for its
// exit code file.
async function setupInProgress(session) {
  const out = await shOut(
    session,
    // Bracketed so pgrep never matches this probe's own command line.
    `pgrep -f '${HOME_DIR}/air-templat[e]/setup.sh' >/dev/null && echo running || true`
  );
  return out.trim() === "running";
}

async function runSetup(session, { attach = false } = {}) {
  if (attach) {
    log("setup.sh already running in this session; attaching");
  } else {
    await sh(
      session,
      [
        "set -euo pipefail",
        `rm -f ${SETUP_RC}`,
        // Own session + no controlling terminal, so the exec's process tree
        // going away with the client does not take setup.sh with it.
        `setsid nohup bash -c 'export HOME=${HOME_DIR}; cd ${HOME_DIR}; ` +
          // Absolute path: setup.sh derives TEMPLATE_DIR from BASH_SOURCE after
          // it has already cd'd into ~/hermes-agent.
          `bash ${HOME_DIR}/air-template/setup.sh; echo $? > ${SETUP_RC}' ` +
          `> ${SETUP_LOG} 2>&1 < /dev/null &`,
      ].join("\n"),
      { as: BOX_USER }
    );
  }
  const started = Date.now();
  let lastLines = "";
  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 30_000));
    // /home/user is 750; the VM account reads the box user's files via sudo.
    const rc = await shOut(session, `sudo cat ${SETUP_RC} 2>/dev/null || true`);
    const tail = await shOut(session, `sudo tail -n 3 ${SETUP_LOG} 2>/dev/null || true`);
    if (tail !== lastLines) {
      lastLines = tail;
      log(`setup ${Math.round((Date.now() - started) / 60_000)}m: ${tail.split("\n").pop()}`);
    }
    if (rc.trim() !== "") {
      if (rc.trim() !== "0") {
        const errors = await shOut(session, `sudo tail -n 40 ${SETUP_LOG}`);
        throw new Error(`setup.sh exited ${rc.trim()}:\n${errors}`);
      }
      return;
    }
    if (Date.now() - started > 90 * 60_000) {
      throw new Error("setup.sh did not finish within 90 minutes");
    }
  }
}

async function verify(session) {
  // A fork of the snapshot never boots, so every unit a box needs must
  // already be running here.
  const started = [
    "hermes-gateway",
    "hermes-dashboard",
    "openviking",
    "openviking-index.timer",
    "taskrouter",
    "air-learningd",
  ];
  const deadline = Date.now() + 3 * 60_000;
  for (;;) {
    const active = await shOut(session, `systemctl is-active ${started.join(" ")} || true`);
    const states = active.trim().split("\n");
    log(`units: ${states.join(" ")}`);
    if (states.every((state) => state === "active")) break;
    if (states.includes("failed") || Date.now() > deadline) {
      throw new Error(`expected ${started.join(", ")} active after setup`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  const host = await shOut(
    session,
    "systemctl show hermes-host -p ActiveState -p Result -p ConditionResult | tr '\\n' ' '"
  );
  log(`hermes-host (expected skipped: ConditionResult=no): ${host}`);
  if (!/ConditionResult=no/.test(host)) {
    throw new Error("hermes-host ran on a Tenki box; ConditionPathExists is missing from the unit");
  }
  const failed = await shOut(session, "systemctl --failed --no-legend | wc -l");
  if (failed.trim() !== "0") {
    const list = await shOut(session, "systemctl --failed --no-legend");
    throw new Error(`failed units after setup:\n${list}`);
  }
  await shOut(
    session,
    `sudo -H -u ${BOX_USER} bash -lc 'test -s ~/.hermes/.template-hermes-ref && test -d ~/.hermes-venv && ovctl status >/dev/null'`
  );
  await sh(session, `rm -f ${SETUP_LOG} ${SETUP_RC}`, { as: BOX_USER });
}

// Async create + poll: the synchronous variant holds one HTTP request open
// for the whole snapshot and times out at the edge (524) on a full disk.
async function snapshot(session) {
  const name = `air-template-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  log(`snapshotting as ${name}`);
  await sh(session, "sync");
  // The create call itself has dropped mid-request (ECONNRESET) on a loaded
  // VM; the name is unique per run, so look for a snapshot the provider did
  // create before asking again.
  let pending = null;
  for (let attempt = 1; !pending; attempt++) {
    try {
      pending = await tk.createSnapshotAsync(session.id, { name });
    } catch (error) {
      const existing = (await tk.listSnapshots()).find((snap) => snap.name === name);
      if (existing) {
        pending = existing;
      } else if (attempt >= 3) {
        throw error;
      } else {
        log(`createSnapshotAsync failed (${error.message}); retrying`);
        await new Promise((resolve) => setTimeout(resolve, 15_000));
      }
    }
  }
  const snap = await tk.waitSnapshotReady(pending.id, 30 * 60 * 1000);
  await tk.updateSnapshot(snap.id, { tags: ["air-template"] });
  return snap;
}

const session = await obtainSession();
log(`session ${session.id} (${session.state})`);
try {
  // A rerun with --session while a previous invocation's setup.sh is still
  // going must not re-upload over it or start a second copy.
  if (!snapshotOnly) {
    const attach = Boolean(sessionArg) && (await setupInProgress(session));
    if (!attach) {
      await bootstrap(session);
      await uploadTemplate(session);
    }
    await runSetup(session, { attach });
  }
  await verify(session);
  const snap = await snapshot(session);
  log(`snapshot ${snap.id} state=${snap.state} size=${snap.sizeBytes}`);
  console.log(`TENKI_TEMPLATE_ID=tenki:${snap.id}`);
} finally {
  if (keep) {
    log(`leaving build session ${session.id} running (--keep)`);
  } else {
    log(`closing build session ${session.id}`);
    await session.closeIfOpen().catch((error) => log(`close failed: ${error.message}`));
  }
}
