#!/usr/bin/env python3
"""Preview QA runner for `air-create qa` (goal-create-v11 §9.6).

Drives this Box's agent-browser against a preview-link URL through the
viewport × reduced-motion matrix and prints ONE content-free report on
stdout — counts, ratios, milliseconds, booleans — which `air-create`
posts to `POST /api/create/qa`. Screenshots land in the workspace's
`.build/qa/` for the owner's Files tab. Nothing here copies page text,
URLs, or console bodies into the report.

    air-qa.py <preview-url> <version> <out-dir> [--session <name>]
"""
import json
import os
import subprocess
import sys
import time
from urllib.parse import urlsplit

VIEWPORTS = [(390, 360), (390, 760), (390, 844)]
SETTLE_MS = 1200
MIN_CONTRAST = 4.5
MIN_TARGET_PX = 44

# Measured in the page: lowest text contrast against the effective
# background, count of body-text elements under 4.5:1, count of interactive
# elements whose hit box is under 44px, and horizontal overflow.
MEASURE_JS = r"""
(() => {
  const parse = (c) => {
    const m = /rgba?\(([^)]+)\)/.exec(c || "");
    if (!m) return null;
    const p = m[1].split(",").map((s) => parseFloat(s));
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const blend = (fg, bg) => ({
    r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1,
  });
  const bodyBg = parse(getComputedStyle(document.body).backgroundColor);
  const canvas = bodyBg && bodyBg.a > 0 ? bodyBg : { r: 255, g: 255, b: 255, a: 1 };
  const background = (el) => {
    let node = el;
    while (node && node !== document.documentElement) {
      const bg = parse(getComputedStyle(node).backgroundColor);
      if (bg && bg.a > 0) return bg.a >= 1 ? bg : blend(bg, canvas);
      node = node.parentElement;
    }
    return canvas;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && parseFloat(s.opacity) > 0.1;
  };
  let minContrast = null;
  let contrastViolations = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) {
    const text = walker.currentNode.nodeValue.trim();
    const el = walker.currentNode.parentElement;
    if (!text || !el || seen.has(el) || !visible(el)) continue;
    seen.add(el);
    const s = getComputedStyle(el);
    const fg = parse(s.color);
    if (!fg) continue;
    const bg = background(el);
    const f = fg.a < 1 ? blend(fg, bg) : fg;
    const l1 = lum(f), l2 = lum(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const size = parseFloat(s.fontSize);
    const bold = parseInt(s.fontWeight, 10) >= 700;
    const large = size >= 24 || (size >= 18.66 && bold);
    const threshold = large ? 3 : 4.5;
    minContrast = minContrast === null ? ratio : Math.min(minContrast, ratio);
    if (ratio < threshold) contrastViolations += 1;
  }
  let smallTargets = 0;
  for (const el of document.querySelectorAll("a[href],button,input,select,textarea,[role=button],[role=link],[tabindex]")) {
    if (!visible(el)) continue;
    if (el.tagName === "INPUT" && el.type === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (Math.min(r.width, r.height) < 44) smallTargets += 1;
  }
  const overflow = document.documentElement.scrollWidth > window.innerWidth + 1;
  return { minContrast, contrastViolations, smallTargets, overflow };
})()
"""


def ab(session, *args, check=True):
    cmd = ["agent-browser", "--session", session, *args, "--json"]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    out = proc.stdout.strip()
    if not out:
        if check:
            raise RuntimeError(f"agent-browser {' '.join(args[:2])}: {proc.stderr.strip()[:200]}")
        return {}
    try:
        data = json.loads(out.splitlines()[-1])
    except json.JSONDecodeError:
        if check:
            raise RuntimeError(f"agent-browser {' '.join(args[:2])}: non-JSON output")
        return {}
    if check and not data.get("success", False):
        raise RuntimeError(f"agent-browser {' '.join(args[:2])}: {str(data.get('error'))[:200]}")
    return data.get("data") or {}


def ab_eval(session, js):
    proc = subprocess.run(
        ["agent-browser", "--session", session, "eval", "--stdin", "--json"],
        input=js, capture_output=True, text=True, timeout=120,
    )
    out = proc.stdout.strip()
    if not out:
        raise RuntimeError("agent-browser eval: no output")
    data = json.loads(out.splitlines()[-1])
    if not data.get("success", False):
        raise RuntimeError(f"agent-browser eval: {str(data.get('error'))[:200]}")
    return (data.get("data") or {}).get("result")


def origin_of(url):
    parts = urlsplit(url)
    return f"{parts.scheme}://{parts.netloc}".lower()


def off_origin(requests, origin):
    count = 0
    for req in requests:
        url = str(req.get("url") or "")
        if not url or url.startswith(("data:", "blob:", "about:")):
            continue
        if origin_of(url) != origin:
            count += 1
    return count


def new_since(before, after):
    """Entries appended since `before` (the CLI buffers accumulate across navigations)."""
    return after[len(before):] if len(after) >= len(before) else after


def run_pass(session, url, origin, width, height, reduced, out_dir):
    ab(session, "set", "viewport", str(width), str(height))
    ab(session, "set", "media", "light", "reduced-motion" if reduced else "no-preference")
    ab(session, "console", "--clear", check=False)
    ab(session, "network", "requests", "--clear", check=False)
    console_before = ab(session, "console", check=False).get("messages") or []
    errors_before = ab(session, "errors", check=False).get("errors") or []
    requests_before = ab(session, "network", "requests", check=False).get("requests") or []
    ab(session, "open", url)
    ab(session, "wait", str(SETTLE_MS))
    console = new_since(console_before, ab(session, "console").get("messages") or [])
    errors = new_since(errors_before, ab(session, "errors").get("errors") or [])
    requests = new_since(requests_before, ab(session, "network", "requests").get("requests") or [])
    vitals = ab(session, "vitals", check=False)
    measured = ab_eval(session, MEASURE_JS) or {}
    shot = f"{width}x{height}-{'rm' if reduced else 'motion'}.png"
    ab(session, "screenshot", os.path.join(out_dir, shot), check=False)
    lcp = None
    lcp_data = vitals.get("lcp") if isinstance(vitals, dict) else None
    if isinstance(lcp_data, dict) and isinstance(lcp_data.get("startTime"), (int, float)):
        lcp = max(0.0, float(lcp_data["startTime"]))
    console_errors = sum(1 for m in console if m.get("type") == "error")
    csp = sum(1 for m in console if "Content Security Policy" in str(m.get("text") or ""))
    min_contrast = measured.get("minContrast")
    if isinstance(min_contrast, (int, float)):
        min_contrast = round(min(21.0, max(1.0, float(min_contrast))), 2)
    else:
        min_contrast = None
    return {
        "viewport": {"width": width, "height": height},
        "reduced_motion": reduced,
        "console_errors": max(0, console_errors - csp),
        "page_errors": len(errors),
        "csp_reports": csp,
        "off_origin_requests": off_origin(requests, origin),
        "min_contrast": min_contrast,
        "contrast_violations": int(measured.get("contrastViolations") or 0),
        "small_targets": int(measured.get("smallTargets") or 0),
        "horizontal_overflow": bool(measured.get("overflow")),
        "lcp_ms": lcp,
        "screenshot": shot,
    }


def main(argv):
    if len(argv) < 4:
        sys.stderr.write(__doc__)
        return 2
    url, version, out_dir = argv[1], argv[2], argv[3]
    session = "air-qa"
    if "--session" in argv:
        session = argv[argv.index("--session") + 1]
    os.makedirs(out_dir, exist_ok=True)
    origin = origin_of(url)
    started = time.monotonic()
    passes = []
    failures = []
    try:
        for width, height in VIEWPORTS:
            for reduced in (False, True):
                try:
                    passes.append(run_pass(session, url, origin, width, height, reduced, out_dir))
                except Exception as exc:  # one broken pass must not hide the others
                    failures.append(f"{width}x{height} rm={int(reduced)}: {str(exc)[:160]}")
    finally:
        ab(session, "close", check=False)
    report = {
        "version": version,
        "passes": passes,
        "duration_ms": int((time.monotonic() - started) * 1000),
    }
    json.dump(report, sys.stdout)
    sys.stdout.write("\n")
    for line in failures:
        sys.stderr.write(f"air-qa: pass failed: {line}\n")
    return 0 if passes else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
