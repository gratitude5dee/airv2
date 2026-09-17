### Landing funnel (`landing` template)

One promise, one proof, one tap. Components: `arlan/swing-type` (the hero type, one lite motion), `fancy/vertical-cut-reveal` for the headline under it, `fancy/simple-marquee` for a strip of proof chips, `arlan/squircle` around the single CTA card. The full-surface variant may swap the hero for `arlan/rush-type` (non-lite, WebGL1) — then `useLite()` must fall back to `arlan/swing-type`, never to nothing.

```tsx
const lite = useLite();
<main className="app">
  <section className="panel hero" aria-label="hero">
    {lite ? <SwingTypeCard /> : <RushTypeCard />}      {/* one hero motion */}
    <p className="kicker">October tour</p>
    <h1 data-test="headline"><VerticalCutReveal splitBy="words">Twelve cities, one van</VerticalCutReveal></h1>
  </section>
  <Squircle radius={24} smoothing={0.8} className="cta">
    <a data-test="cta" className="cta-link" href="https://dice.fm/">Get tickets</a>
  </Squircle>
  <SimpleMarquee baseVelocity={1.5}><span className="chip">Sold out · Berlin</span> …</SimpleMarquee>
</main>
```

The CTA is a real `<a href>` (the runner asserts `expectHref`), never a button that navigates in script. Under reduced motion the swing type draws its final frame and the marquee becomes a static row of chips; under lite there is one hero and no marquee velocity. No form, no counter: a funnel that asks for a name is the `tool` shape.
