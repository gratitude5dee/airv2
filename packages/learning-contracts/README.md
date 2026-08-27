# learning-contracts

Versioned JSON Schemas for the Air Learning Plane (V10, goal.md). These are
the seam between the web control plane (TypeScript) and the Box-local
learning daemon (`infra/template/learning`, Python): neither side imports the
other's types — both validate against these schemas.

Schemas:

- `experiment.v1.json` — `ExperimentSpec` accepted by the `EvaluationKernel`
- `experiment-result.v1.json` — `ExperimentResult` returned by the kernel
- `trace-envelope.v1.json` — Air-owned canonical episode trace (`air.trace.v1`)
- `policy-overlay.v1.json` — allowlisted personalization candidate manifest
- `learning-receipt.v1.json` — the ONLY shape that may leave the Box
  (content-free operational metadata; see goal.md §15.2)

Contract rules (goal.md §2):

- Raw prompts, responses, tool payloads, fixtures, and profile bodies never
  appear in a receipt (L1).
- `OpaqueLocalRef` values are resolved only inside the Box by
  `air-learningd`; they are not URLs, paths, or dereferenceable hashes.
- Schema changes are additive within a major version; a breaking change is a
  new `air.*.v2` schema, never an edit to v1.
