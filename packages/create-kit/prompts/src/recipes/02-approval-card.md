### Approval card

One decision, two buttons, a receipt. Components: `beautiful/approval-card` (or `aicss/approval-card` for the compact variant), `beautiful/button`, `libraries/border-beam` only while the decision is pending.

```tsx
const { state, update, canWrite } = useAirState<{ decision: "pending" | "approved" | "declined" }>("approval");
<AirBorderBeam active={state.decision === "pending"}>
  <ApprovalCard
    title="Send the invoice to Nadia?"
    detail="$1,240 · net 30"
    onApprove={() => update((s) => ({ ...s, decision: "approved" }))}
    onDecline={() => update((s) => ({ ...s, decision: "declined" }))}
    disabled={canWrite === false}
  />
</AirBorderBeam>
```

Guests see the same card with the buttons disabled and the notice "Guests are read-only." The card is forwardable, so it never contains the thing being approved in full: one line of detail, and the receipt after the decision.
