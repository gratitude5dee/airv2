#!/usr/bin/env python3
"""learningctl: CLI over the air-learningd Unix socket.

This is the only surface the control plane touches (through the compute
abstraction's runCommand), and the only surface the owner's shell touches.

Usage:
  learningctl status
  learningctl settings.set '{"mode":"observe"}'
  learningctl turn.completed '{"trace_id":"tr_..","outcome":"completed"}'
  learningctl feedback.record '{"trace_id":"tr_..","reason":"wrong_result"}'
  learningctl receipts.drain '{"limit":100}'
  learningctl candidates.list
  learningctl candidate.approve '{"candidate_id":"cand_.."}'
  learningctl candidate.reject '{"candidate_id":"cand_.."}'
  learningctl profile.rollback '{"reason":"owner_rejection"}'
"""

import json
import sys

sys.path.insert(0, "/opt/air/learning")

from air_learning.daemon import call  # noqa: E402


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__, file=sys.stderr)
        return 2
    method = sys.argv[1]
    params = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}
    try:
        response = call(method, params)
    except (ConnectionRefusedError, FileNotFoundError):
        response = {"ok": False, "error": "air-learningd not running", "error_class": "daemon_down"}
    print(json.dumps(response))
    return 0 if response.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
