"""Evaluation backend adapters behind the EvaluationKernel (goal.md §6.2)."""


class AdapterError(Exception):
    """Typed adapter failure: every backend error carries an error_class."""

    error_class = "adapter_error"
