"""Unit tests for the task router's routing pipeline (no model required —
the model path is exercised with stubs so the suite runs anywhere)."""

import json
import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
import promotion_gate
import taskrouter


class DeterministicApproval(unittest.TestCase):
    def test_payment_phrases_need_approval(self):
        for text in (
            "wire $500 to alex for the deposit",
            "renew my domain, it's on the saved card",
            "cancel my comcast subscription",
            "order my usual from doordash",
            "buy 2 tickets to the warriors game tonight",
            "charge it to my credit card",
        ):
            self.assertTrue(taskrouter.deterministic_needs_approval(text), text)

    def test_benign_phrases_do_not(self):
        for text in ("hey what's up", "when am I free next week?", "thanks!"):
            self.assertFalse(taskrouter.deterministic_needs_approval(text), text)

    def test_model_can_never_flip_approval(self):
        """Even a model that says needs_approval=False cannot clear the flag."""
        model_out = {
            "tier": "balanced",
            "tools": ["browser"],
            "needs_approval": False,
            "confidence": 0.95,
            "source": "model",
        }
        with mock.patch.object(taskrouter, "model_classify", return_value=model_out):
            with mock.patch.object(
                taskrouter, "heuristic",
                return_value={"tier": "fast", "tools": [], "needs_approval": True,
                              "confidence": 0.2, "source": "heuristic"},
            ):
                decision, record = taskrouter.route("x")
        self.assertTrue(decision["needs_approval"])
        self.assertEqual(decision["source"], "model")
        self.assertFalse(record["model"]["needs_approval"])  # disagreement kept


class HeuristicsFirstGating(unittest.TestCase):
    def test_confident_heuristic_skips_model(self):
        with mock.patch.object(taskrouter, "model_classify") as classify:
            decision, record = taskrouter.route("wire $500 to alex for the deposit")
        classify.assert_not_called()
        self.assertEqual(decision["source"], "heuristic")
        self.assertFalse(record["model_consulted"])

    def test_ambiguous_text_consults_model(self):
        ambiguous = "the thing from before, can you sort that whole situation out"
        heur = taskrouter.heuristic(ambiguous)
        self.assertLess(heur["confidence"], taskrouter.AMBIGUITY_THRESHOLD)
        model_out = {"tier": "deep", "tools": [], "needs_approval": False,
                     "confidence": 0.8, "source": "model"}
        with mock.patch.object(taskrouter, "model_classify", return_value=model_out):
            decision, record = taskrouter.route(ambiguous)
        self.assertEqual(decision["source"], "model")
        self.assertEqual(decision["tier"], "deep")
        self.assertTrue(record["model_consulted"])

    def test_small_latency_budget_skips_model(self):
        ambiguous = "the thing from before, can you sort that whole situation out"
        with mock.patch.object(taskrouter, "model_classify") as classify:
            decision, _ = taskrouter.route(ambiguous, latency_budget_ms=200)
        classify.assert_not_called()
        self.assertEqual(decision["source"], "heuristic")

    def test_invalid_model_output_falls_back(self):
        ambiguous = "the thing from before, can you sort that whole situation out"
        with mock.patch.object(taskrouter, "model_classify", return_value=None):
            decision, record = taskrouter.route(ambiguous)
        self.assertEqual(decision["source"], "heuristic")
        self.assertIsNone(record["model"])


class PrefetchHints(unittest.TestCase):
    def test_prefetch_is_union_of_engines(self):
        model_out = {"tier": "balanced", "tools": ["email", "calendar"],
                     "needs_approval": False, "confidence": 0.7, "source": "model"}
        with mock.patch.object(taskrouter, "heuristic", return_value={
            "tier": "fast", "tools": ["browser"], "needs_approval": False,
            "confidence": 0.4, "source": "heuristic"}):
            with mock.patch.object(taskrouter, "model_classify", return_value=model_out):
                decision, _ = taskrouter.route("x")
        self.assertEqual(decision["prefetch_tools"], ["browser", "calendar", "email"])


class TraceIdLogJoin(unittest.TestCase):
    def test_caller_trace_id_echoed(self):
        decision, record = taskrouter.route("thanks!", trace_id="tr_join_me")
        self.assertEqual(decision["trace_id"], "tr_join_me")
        self.assertEqual(record["trace_id"], "tr_join_me")

    def test_trace_id_minted_when_absent(self):
        decision, _ = taskrouter.route("thanks!")
        self.assertTrue(decision["trace_id"].startswith("tr_"))
        other, _ = taskrouter.route("thanks!")
        self.assertNotEqual(decision["trace_id"], other["trace_id"])

    def test_log_record_is_content_free(self):
        text = "wire $500 to alex for the deposit"
        _, record = taskrouter.route(text, trace_id="tr_x")
        blob = json.dumps(record)
        self.assertNotIn("wire", blob)
        self.assertNotIn("alex", blob)
        self.assertEqual(record["text_len"], len(text))
        for key in ("trace_id", "tier", "needs_approval", "source", "heuristic"):
            self.assertIn(key, record)


class PromotionGate(unittest.TestCase):
    def test_heuristics_only_pass_gate_on_golden_set(self):
        golden = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "..", "golden.jsonl"
        )
        cases = promotion_gate.load_golden(golden)
        result = promotion_gate.score(cases, use_model=False)
        failures = promotion_gate.evaluate_gate(result)
        self.assertEqual(failures, [], failures)
        self.assertEqual(result["payment_false_negatives"], [])

    def test_gate_flags_payment_false_negative(self):
        result = {
            "tier_accuracy": 0.9,
            "heuristic_tier_accuracy": 0.6,
            "approval_accuracy": 0.99,
            "latency_ms_p95": 10,
            "payment_false_negatives": ["wire $500 to alex"],
        }
        failures = promotion_gate.evaluate_gate(result)
        self.assertEqual(len(failures), 1)
        self.assertIn("payment", failures[0])

    def test_gate_flags_tier_regression_and_latency(self):
        result = {
            "tier_accuracy": 0.5,
            "heuristic_tier_accuracy": 0.7,
            "approval_accuracy": 0.5,
            "latency_ms_p95": 9000,
            "payment_false_negatives": [],
        }
        failures = promotion_gate.evaluate_gate(result)
        self.assertEqual(len(failures), 3)


if __name__ == "__main__":
    unittest.main()
