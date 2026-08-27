"""Box-local Air Learning Plane (goal.md V10).

Everything in this package runs INSIDE the owner's Box. Raw episodes,
traces, tasks, fixtures, candidates, and profile bodies never leave the Box
(constraint L1). The only outbound shape is the content-free
air.learning-receipt.v1, drained by the control plane over the existing
compute abstraction.
"""

__version__ = "0.1.0"

SCHEMA_RECEIPT = "air.learning-receipt.v1"
SCHEMA_TRACE = "air.trace.v1"
SCHEMA_OVERLAY = "air.policy-overlay.v1"
SCHEMA_EXPERIMENT = "air.experiment.v1"
SCHEMA_RESULT = "air.experiment-result.v1"
