#!/usr/bin/env python3
"""Preview QA runner for `air-create qa` and `air-create test`
(goal-create-v11 §9.6, goal-create-v12 §8.4).

Drives this Box's agent-browser against a preview-link URL through the
viewport × reduced-motion matrix and prints ONE content-free report on
stdout — counts, ratios, milliseconds, booleans — which `air-create`
posts to `POST /api/create/qa`. Screenshots land in the workspace's
`.build/qa/` for the owner's Files tab. Nothing here copies page text,
URLs, or console bodies into the report.

With `--tests <air.json>` the runner then executes `air.json.tests[]`
(the §8.4 DSL: see / missing / tap / type / wait / changed / expectHref /
viewport / role) at 390×760 with reduced motion on and adds
`{"tests": {"total", "passed", "failed_ids"}}` to the report — ids only,
never DOM text. `role: "guest"` tests need `--guest-url` (a guest grant on
the dev origin); without one they are counted as failed.

    air-qa.py <preview-url> <version> <out-dir> [--session <name>]
              [--tests <air.json>] [--guest-url <url>]
"""
import json
import os
import re
import subprocess
import sys
import time
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

VIEWPORTS = [(390, 360), (390, 760), (390, 844)]
SETTLE_MS = 1200
MIN_CONTRAST = 4.5
MIN_TARGET_PX = 44

# §8.4: every test runs at the expanded card size with reduced motion on.
TEST_VIEWPORT = (390, 760)
TEST_WAIT_MAX_MS = 10_000
TEST_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,63}$")
TEST_VERBS = {"id", "see", "missing", "tap", "type", "wait", "changed", "expectHref", "viewport", "role", "locked"}

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


def strip_token(url):
    parts = urlsplit(url)
    query = [(k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True) if k != "t"]
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(query), parts.fragment))


def redact_token(text):
    """The single-use token must never reach the log (stderr goes to the Box)."""
    return re.sub(r"([?&])t=[^&\s:]*", r"\1t=<redacted>", text)


def redeem(session, url):
    """Exchange the single-use `?t=` token for the app-origin session cookie.

    The Dispatcher redeems a token exactly once and 303s to the same URL
    without `t`; every later pass must open that token-free URL, riding the
    cookie the exchange set (a second `?t=` open is `unauthorized`).
    """
    try:
        ab(session, "open", url)
    except RuntimeError as exc:
        raise RuntimeError(redact_token(str(exc))) from None
    landed = ab_eval(session, "location.href")
    if not isinstance(landed, str) or "t" in dict(parse_qsl(urlsplit(landed).query)):
        raise RuntimeError("preview link was not accepted (expired or already used)")
    return strip_token(url)


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



# ----------------------------------------------------------------- §8.4 tests

# Page-side helpers shared by the test verbs. Each snippet returns a plain
# value (bool / string / null); nothing about the DOM leaves this process
# except a pass/fail per test id.
VISIBLE_JS = """
  const visible = (el) => {
    if (!el || !(el instanceof Element)) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && parseFloat(s.opacity) > 0.05;
  };
"""


def js_see(text):
    """True when `text` is inside the rendered (visible) text of the page."""
    return "(() => {" + VISIBLE_JS + f"""
  const needle = {json.dumps(text)};
  if (!needle) return false;
  if ((document.body.innerText || "").includes(needle)) return true;
  for (const el of document.querySelectorAll("input,textarea")) {{
    if (visible(el) && String(el.value || "").includes(needle)) return true;
  }}
  return false;
}})()"""


def js_missing(selector):
    """True when nothing matching `selector` is visible (absent or hidden)."""
    return "(() => {" + VISIBLE_JS + f"""
  let els;
  try {{ els = document.querySelectorAll({json.dumps(selector)}); }} catch (e) {{ return false; }}
  for (const el of els) if (visible(el)) return false;
  return true;
}})()"""


def js_text_of(selector):
    """The trimmed text of the first match, or null when it is not there."""
    return f"""(() => {{
  let el;
  try {{ el = document.querySelector({json.dumps(selector)}); }} catch (e) {{ return null; }}
  if (!el) return null;
  return String(el.innerText != null ? el.innerText : el.textContent || "").trim();
}})()"""


def js_href_of(selector):
    """The resolved href of the first match (or its closest anchor), or null."""
    return f"""(() => {{
  let el;
  try {{ el = document.querySelector({json.dumps(selector)}); }} catch (e) {{ return null; }}
  if (!el) return null;
  const a = el.closest ? el.closest("a[href]") : null;
  const target = el.href != null ? el : a;
  return target && target.href != null ? String(target.href) : null;
}})()"""


def js_tap(selector):
    """Scroll the first visible match into view and click it; true on success."""
    return "(() => {" + VISIBLE_JS + f"""
  let els;
  try {{ els = document.querySelectorAll({json.dumps(selector)}); }} catch (e) {{ return false; }}
  const el = [...els].find(visible) || els[0];
  if (!el) return false;
  el.scrollIntoView({{ block: "center", inline: "center" }});
  const opts = {{ bubbles: true, cancelable: true, composed: true }};
  for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup"]) {{
    try {{ el.dispatchEvent(new (type.startsWith("pointer") ? PointerEvent : MouseEvent)(type, opts)); }} catch (e) {{}}
  }}
  el.click();
  return true;
}})()"""


def js_type(selector, text):
    """Set a control's value the way React expects (native setter + input/change)."""
    return "(() => {" + VISIBLE_JS + f"""
  let els;
  try {{ els = document.querySelectorAll({json.dumps(selector)}); }} catch (e) {{ return false; }}
  const el = [...els].find(visible) || els[0];
  if (!el) return false;
  const value = {json.dumps(text)};
  el.focus();
  if (el.isContentEditable) {{
    el.textContent = value;
  }} else {{
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, "value");
    if (desc && desc.set) desc.set.call(el, value); else el.value = value;
  }}
  el.dispatchEvent(new Event("input", {{ bubbles: true }}));
  el.dispatchEvent(new Event("change", {{ bubbles: true }}));
  return true;
}})()"""


def parse_viewport(value):
    """`"390x760"`, `[390, 760]` or `{"width": 390, "height": 760}` → (w, h)."""
    if value is None:
        return TEST_VIEWPORT
    if isinstance(value, str):
        m = re.fullmatch(r"\s*(\d{3,4})\s*[x×]\s*(\d{3,4})\s*", value)
        if not m:
            raise ValueError("viewport")
        return int(m.group(1)), int(m.group(2))
    if isinstance(value, (list, tuple)) and len(value) == 2:
        return int(value[0]), int(value[1])
    if isinstance(value, dict):
        return int(value["width"]), int(value["height"])
    raise ValueError("viewport")


def load_tests(path):
    """`air.json.tests[]` as a list of dicts; anything else is an empty list."""
    with open(path, "r", encoding="utf-8") as fh:
        manifest = json.load(fh)
    tests = manifest.get("tests") if isinstance(manifest, dict) else None
    return tests if isinstance(tests, list) else []


def test_id(test, index):
    tid = test.get("id") if isinstance(test, dict) else None
    if isinstance(tid, str) and TEST_ID_RE.match(tid):
        return tid
    return f"test-{index + 1}"


def run_test(session, page, test, out_dir, tid):
    """One §8.4 test. Raises with a verb name (never page text) on failure."""
    unknown = set(test) - TEST_VERBS
    if unknown:
        raise ValueError("unknown verb")
    width, height = parse_viewport(test.get("viewport"))
    ab(session, "set", "viewport", str(width), str(height))
    ab(session, "set", "media", "light", "reduced-motion")
    ab(session, "open", page)
    ab(session, "wait", str(SETTLE_MS))

    changed = test.get("changed")
    before = None
    if changed is not None:
        if not isinstance(changed, str) or not changed:
            raise ValueError("changed")
        before = ab_eval(session, js_text_of(changed))

    typed = test.get("type")
    if typed is not None:
        if not (isinstance(typed, list) and len(typed) == 2 and all(isinstance(v, str) for v in typed)):
            raise ValueError("type")
        selector, text = typed
        if not ab_eval(session, js_type(selector, text)):
            raise AssertionError("type")

    tap = test.get("tap")
    expect_href = test.get("expectHref")
    if expect_href is not None and not isinstance(expect_href, str):
        raise ValueError("expectHref")
    if tap is not None:
        if not isinstance(tap, str) or not tap:
            raise ValueError("tap")
        if expect_href is not None:
            # The link is inspected, not followed: leaving the app origin would
            # end the session and count as off-origin traffic.
            href = ab_eval(session, js_href_of(tap))
            if not isinstance(href, str) or not href.startswith(expect_href):
                raise AssertionError("expectHref")
        elif not ab_eval(session, js_tap(tap)):
            raise AssertionError("tap")
    elif expect_href is not None:
        raise ValueError("expectHref needs tap")

    wait = test.get("wait")
    if wait is not None:
        if not isinstance(wait, (int, float)) or wait < 0:
            raise ValueError("wait")
        ab(session, "wait", str(int(min(TEST_WAIT_MAX_MS, wait))))
    elif tap is not None or typed is not None:
        ab(session, "wait", "250")

    if changed is not None:
        after = ab_eval(session, js_text_of(changed))
        if after is None or after == before:
            raise AssertionError("changed")

    see = test.get("see")
    if see is not None:
        if not isinstance(see, str) or not see:
            raise ValueError("see")
        if not ab_eval(session, js_see(see)):
            raise AssertionError("see")

    missing = test.get("missing")
    if missing is not None:
        if not isinstance(missing, str) or not missing:
            raise ValueError("missing")
        if not ab_eval(session, js_missing(missing)):
            raise AssertionError("missing")

    ab(session, "screenshot", os.path.join(out_dir, f"test-{tid}.png"), check=False)


def run_tests(session, owner_page, guest_url, tests, out_dir, failures):
    """Every test in order; returns the content-free summary for the report."""
    failed_ids = []
    guest_page = None
    guest_tried = False
    for index, test in enumerate(tests):
        tid = test_id(test, index)
        if not isinstance(test, dict):
            failed_ids.append(tid)
            failures.append(f"test {tid}: not an object")
            continue
        role = test.get("role", "owner")
        if role not in ("owner", "guest"):
            failed_ids.append(tid)
            failures.append(f"test {tid}: role")
            continue
        if role == "guest":
            if not guest_url:
                failed_ids.append(tid)
                failures.append(f"test {tid}: guest role needs --guest-url")
                continue
            if not guest_tried:
                guest_tried = True
                try:
                    # A guest grant may also arrive as a single-use link; land it once.
                    ab(session, "open", guest_url)
                    landed = ab_eval(session, "location.href")
                    guest_page = strip_token(landed if isinstance(landed, str) else guest_url)
                except Exception as exc:
                    failures.append(f"guest: {redact_token(str(exc))[:160]}")
            if not guest_page:
                failed_ids.append(tid)
                failures.append(f"test {tid}: guest page unavailable")
                continue
            page = guest_page
        else:
            page = owner_page
        try:
            run_test(session, page, test, out_dir, tid)
        except Exception as exc:  # one failing test never hides the next
            failed_ids.append(tid)
            failures.append(f"test {tid}: {redact_token(str(exc))[:80]}")
    total = len(tests)
    return {"total": total, "passed": total - len(failed_ids), "failed_ids": failed_ids}


def parse_args(argv):
    positional = []
    opts = {"--session": "air-qa", "--tests": None, "--guest-url": None}
    i = 1
    while i < len(argv):
        arg = argv[i]
        if arg in opts:
            if i + 1 >= len(argv):
                raise ValueError(f"{arg} needs a value")
            opts[arg] = argv[i + 1]
            i += 2
        elif arg.startswith("--"):
            raise ValueError(f"unknown option {arg}")
        else:
            positional.append(arg)
            i += 1
    if len(positional) != 3:
        raise ValueError("usage")
    return positional, opts


def main(argv):
    try:
        (url, version, out_dir), opts = parse_args(argv)
    except ValueError as exc:
        sys.stderr.write(__doc__)
        sys.stderr.write(f"\nair-qa: {exc}\n")
        return 2
    session = opts["--session"]
    tests = None
    if opts["--tests"]:
        try:
            tests = load_tests(opts["--tests"])
        except Exception as exc:
            sys.stderr.write(f"air-qa: could not read tests from {opts['--tests']}: {exc.__class__.__name__}\n")
            return 2
    os.makedirs(out_dir, exist_ok=True)
    origin = origin_of(url)
    started = time.monotonic()
    passes = []
    failures = []
    test_summary = None
    try:
        try:
            page = redeem(session, url)
        except Exception as exc:
            failures.append(f"redeem: {str(exc)[:160]}")
            page = None
        if page:
            for width, height in VIEWPORTS:
                for reduced in (False, True):
                    try:
                        passes.append(run_pass(session, page, origin, width, height, reduced, out_dir))
                    except Exception as exc:  # one broken pass must not hide the others
                        failures.append(f"{width}x{height} rm={int(reduced)}: {str(exc)[:160]}")
        if tests is not None:
            if page:
                test_summary = run_tests(session, page, opts["--guest-url"], tests, out_dir, failures)
            else:
                # No page, no evidence: every test counts as failed, by id only.
                ids = [test_id(t, i) for i, t in enumerate(tests)]
                test_summary = {"total": len(ids), "passed": 0, "failed_ids": ids}
    finally:
        ab(session, "close", check=False)
    report = {
        "version": version,
        "passes": passes,
        "duration_ms": int((time.monotonic() - started) * 1000),
    }
    if test_summary is not None:
        report["tests"] = test_summary
    json.dump(report, sys.stdout)
    sys.stdout.write("\n")
    for line in failures:
        sys.stderr.write(f"air-qa: pass failed: {line}\n")
    return 0 if passes else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
