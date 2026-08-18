/**
 * Box-side browser probes for the Browser subtab (V5). Everything here runs
 * over the typed box command transport and returns metadata only: page
 * titles/URLs from the local CDP endpoint, recording filenames. No box URL,
 * no debug socket, no vault value ever crosses to the client (C16/C19).
 */
import { command } from "../box/client";

const DEBUG_PORT = 9222;
const RECORDINGS_DIR = "/home/user/.hermes/browser_recordings";

export interface BrowserPage {
  title: string;
  url: string;
}

export interface BrowserProbe {
  running: boolean;
  pages: BrowserPage[];
  /** The frontmost page's URL, when a real page is open. */
  currentUrl: string | null;
}

function isInternal(url: string): boolean {
  return (
    url.startsWith("chrome://") ||
    url.startsWith("devtools://") ||
    url.startsWith("chrome-extension://") ||
    url === "about:blank"
  );
}

/** Current pages of the headed browser via the box-local CDP /json list. */
export async function probeBrowser(boxId: string): Promise<BrowserProbe> {
  const result = await command(
    boxId,
    `curl -fsS --max-time 5 http://127.0.0.1:${DEBUG_PORT}/json/list`,
    15
  );
  if (result.exitCode !== 0) {
    return { running: false, pages: [], currentUrl: null };
  }
  let targets: unknown;
  try {
    targets = JSON.parse(result.stdout);
  } catch {
    return { running: false, pages: [], currentUrl: null };
  }
  const pages: BrowserPage[] = [];
  for (const target of Array.isArray(targets) ? targets : []) {
    if (target === null || typeof target !== "object") continue;
    const { type, title, url } = target as {
      type?: unknown;
      title?: unknown;
      url?: unknown;
    };
    if (type !== "page" || typeof url !== "string" || isInternal(url)) continue;
    pages.push({ title: typeof title === "string" ? title : "", url });
  }
  return {
    running: true,
    pages,
    currentUrl: pages[0]?.url ?? null,
  };
}

/** Raise the headed browser window on the box display. Best-effort. */
export async function focusBrowser(boxId: string): Promise<boolean> {
  const result = await command(
    boxId,
    "DISPLAY=:0 xdotool search --onlyvisible --class chrome windowactivate 2>/dev/null || " +
      "DISPLAY=:0 xdotool search --onlyvisible --class chromium windowactivate",
    15
  );
  return result.exitCode === 0;
}

/**
 * Named agent-browser sessions: the daemon keeps one socket dir per session
 * at /tmp/agent-browser-<name>. Names only — for the session pill.
 */
export async function listSessions(boxId: string): Promise<string[]> {
  const result = await command(
    boxId,
    "ls -d /tmp/agent-browser-*/ 2>/dev/null || true",
    15
  );
  if (result.exitCode !== 0) return [];
  const names: string[] = [];
  for (const line of result.stdout.split("\n")) {
    const match = /agent-browser-([\w-]+)\/?$/.exec(line.trim());
    if (match && match[1]) names.push(match[1]);
  }
  return names;
}

export interface BrowserRecording {
  name: string;
  bytes: number;
  modified_at: string | null;
}

/**
 * Recording files when browser.record_sessions is on. Names/sizes only —
 * playback bytes, if ever exposed, go server-to-server through the command
 * transport, never as a box URL.
 */
export async function listRecordings(
  boxId: string
): Promise<BrowserRecording[]> {
  const result = await command(
    boxId,
    `[ -d ${RECORDINGS_DIR} ] && find ${RECORDINGS_DIR} -maxdepth 1 -type f -name '*.webm' ` +
      `-printf '%f\\t%s\\t%T@\\n' | sort -t$'\\t' -k3 -rn | head -20 || true`,
    15
  );
  if (result.exitCode !== 0) return [];
  const recordings: BrowserRecording[] = [];
  for (const line of result.stdout.split("\n")) {
    const [name, size, mtime] = line.trim().split("\t");
    if (!name || !/^[\w.-]+\.webm$/.test(name)) continue;
    const epoch = Number.parseFloat(mtime ?? "");
    recordings.push({
      name,
      bytes: Number.parseInt(size ?? "0", 10) || 0,
      modified_at: Number.isFinite(epoch)
        ? new Date(epoch * 1000).toISOString()
        : null,
    });
  }
  return recordings;
}
