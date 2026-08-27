#!/usr/bin/env python3
"""Local task router — loopback-only, ADVISORY-ONLY shadow classifier.

A small GGUF model (llama.cpp, same portable toolchain OpenViking builds)
classifies an incoming message into a routing proposal:

    POST http://127.0.0.1:1917/route   {"text": "..."}
    -> {"tier": "fast|balanced|deep",
        "tools": ["browser"|"filesystem"|"email"|"calendar"|"creative"],
        "needs_approval": bool,
        "confidence": 0.0-1.0,
        "source": "model"|"heuristic"}

Invariants:
  - The output is a PROPOSAL. The control plane / gateway is the only
    authorizer: entitlements, trust tiers, spend caps, and the approval queue
    are enforced there. Nothing consumes this output authoritatively yet
    (shadow mode); when something does, it must treat it as untrusted input.
  - Binds 127.0.0.1 only. No provider key, no network egress.
  - Decisions are logged to ~/.taskrouter/decisions.jsonl (box filesystem,
    never shared Postgres) for offline agreement measurement.
  - Model output is validated against closed enums; any deviation falls back
    to the deterministic heuristics, so a confused model can only ever pick
    from the same closed set the heuristics use.
"""

import json
import os
import re
import time
from http.server import BaseHTTPRequestHandler, HTTPServer

HOME = os.path.expanduser("~")
MODEL_PATH = os.environ.get(
    "TASKROUTER_MODEL", os.path.join(HOME, ".taskrouter", "model.gguf")
)
LOG_PATH = os.path.join(HOME, ".taskrouter", "decisions.jsonl")
TIERS = ("fast", "balanced", "deep")
TOOLS = ("browser", "filesystem", "email", "calendar", "creative")
MAX_TEXT = 4000

_llm = None
_llm_failed = False


def get_llm():
    """Lazy-load the model; a missing/broken model just means heuristics."""
    global _llm, _llm_failed
    if _llm is not None or _llm_failed:
        return _llm
    try:
        from llama_cpp import Llama

        _llm = Llama(
            model_path=MODEL_PATH,
            n_ctx=2048,
            n_threads=max(1, (os.cpu_count() or 2) - 1),
            verbose=False,
        )
    except Exception:
        _llm_failed = True
        _llm = None
    return _llm


SIDE_EFFECT_RE = re.compile(
    r"\b(send|reply|email|post|publish|tweet|buy|purchase|order|pay|book|"
    r"subscribe|delete|cancel|transfer)\b",
    re.I,
)
DEEP_RE = re.compile(
    r"\b(research|analy[sz]e|compare|plan|write|draft|design|build|debug|"
    r"investigate|summarize .{40,})\b",
    re.I,
)
TOOL_RES = {
    "browser": re.compile(r"\b(browse|website|url|http|search|look up|google)\b", re.I),
    "filesystem": re.compile(r"\b(file|folder|document|save|download|note)\b", re.I),
    "email": re.compile(r"\b(email|inbox|mail|reply)\b", re.I),
    "calendar": re.compile(r"\b(calendar|schedule|meeting|remind|event)\b", re.I),
    "creative": re.compile(r"\b(image|video|draw|picture|art|song|design)\b", re.I),
}


def heuristic(text):
    tools = [name for name, rx in TOOL_RES.items() if rx.search(text)]
    needs_approval = bool(SIDE_EFFECT_RE.search(text))
    if DEEP_RE.search(text) or len(text) > 800:
        tier = "deep"
    elif tools or needs_approval:
        tier = "balanced"
    else:
        tier = "fast"
    return {
        "tier": tier,
        "tools": tools,
        "needs_approval": needs_approval,
        "confidence": 0.3,
        "source": "heuristic",
    }


PROMPT = (
    "You are a task router. Classify the user message into JSON with keys: "
    'tier (one of "fast","balanced","deep"), tools (subset of '
    '["browser","filesystem","email","calendar","creative"]), '
    "needs_approval (true if the task causes an external side effect like "
    "sending, publishing, buying), confidence (0..1). "
    "Reply with ONLY the JSON object.\n\nMessage:\n"
)


def classify(text):
    llm = get_llm()
    if llm is None:
        return heuristic(text)
    try:
        out = llm.create_chat_completion(
            messages=[{"role": "user", "content": PROMPT + text}],
            max_tokens=128,
            temperature=0.0,
            response_format={"type": "json_object"},
        )
        raw = json.loads(out["choices"][0]["message"]["content"])
        tier = raw.get("tier")
        tools = raw.get("tools")
        needs_approval = raw.get("needs_approval")
        confidence = raw.get("confidence")
        if (
            tier not in TIERS
            or not isinstance(tools, list)
            or any(t not in TOOLS for t in tools)
            or not isinstance(needs_approval, bool)
            or not isinstance(confidence, (int, float))
        ):
            return heuristic(text)
        return {
            "tier": tier,
            "tools": sorted(set(tools)),
            "needs_approval": needs_approval,
            "confidence": max(0.0, min(1.0, float(confidence))),
            "source": "model",
        }
    except Exception:
        return heuristic(text)


def log_decision(decision, ms):
    try:
        os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
        with open(LOG_PATH, "a") as fh:
            fh.write(json.dumps({"ts": time.time(), "ms": ms, **decision}) + "\n")
    except OSError:
        pass


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):  # quiet
        pass

    def _json(self, code, body):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/health":
            self._json(
                200,
                {
                    "ok": True,
                    "model_loaded": _llm is not None,
                    "model_present": os.path.exists(MODEL_PATH),
                },
            )
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/route":
            self._json(404, {"error": "not found"})
            return
        try:
            length = min(int(self.headers.get("Content-Length", "0")), 1 << 20)
            doc = json.loads(self.rfile.read(length) or b"{}")
            text = str(doc.get("text", ""))[:MAX_TEXT]
        except (ValueError, json.JSONDecodeError):
            self._json(400, {"error": "bad request"})
            return
        if not text.strip():
            self._json(400, {"error": "text required"})
            return
        start = time.monotonic()
        decision = classify(text)
        log_decision(decision, round((time.monotonic() - start) * 1000))
        self._json(200, decision)


def main():
    HTTPServer(("127.0.0.1", 1917), Handler).serve_forever()


if __name__ == "__main__":
    main()
