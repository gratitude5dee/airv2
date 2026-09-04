### Status / thinking view

The owner's agent is working on something and the app shows its progress. Components: `aicss/thinking-state` (the phase list), `libraries/thinking-orbs` (the hero, `AirThinkingOrb`), `aicss/streaming-text` or `fancy/typewriter` for the one live line.

```tsx
<main className="app">
  <section className="panel hero">
    <AirThinkingOrb state={status} />          {/* one hero motion */}
    <p className="kicker">Working</p>
    <Typewriter text={currentStep} />          {/* the live line */}
  </section>
  <ThinkingState steps={steps} />              {/* settles; no per-row animation */}
</main>
```

State comes from `useAirState<{ status; steps }>("progress")`, written by the owner's agent, read by everyone. Under reduced motion the orb is a still disc and the typewriter renders the full line.
