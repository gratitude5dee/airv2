### Countdown / ticker hero

A number that matters, large. Components: `fancy/basic-number-ticker` (the hero), `fancy/text-rotate` or `fancy/vertical-cut-reveal` for the label, `fancy/simple-marquee` for a one-line ticker under it.

```tsx
<section className="panel hero">
  <p className="kicker">Doors open in</p>
  <NumberTicker from={0} to={hours} autoStart />
  <VerticalCutReveal>hours</VerticalCutReveal>
</section>
<SimpleMarquee baseVelocity={2}><span className="chip">Sat 8pm</span> …</SimpleMarquee>
```

The ticker is the only hero motion; the marquee stops under reduced motion and lite (`useReducedMotion()` → render a static row of chips). Time comes from the client clock; never fetch time from a host.
