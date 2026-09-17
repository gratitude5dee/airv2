### Product page (`store` template)

A few things to look at, a price on each, one button per thing. Components: `.grid` of `.tile` from the shell, `arlan/squircle` for the featured tile, `beautiful/value-pill` for the price, `fancy/basic-number-ticker` for the bag count (the one hero motion), `fancy/simple-carousel` when the set is ≤ 8 photos.

```tsx
const { state, update } = useAirState<{ bag: string[] }>({ bag: [] });   // resource: bag (owner-writable)
<section className="panel hero">
  <p className="kicker">In the bag</p>
  <NumberTicker from={0} target={state.bag.length} className="count" />
</section>
<section className="grid">
  {products.map((p) => (
    <article key={p.id} className="tile" data-test={`product-${p.id}`}>
      <img src={p.image} alt={p.alt} loading="lazy" />
      <h3>{p.name}</h3>
      <ValuePill tone="accent">{p.price}</ValuePill>
      <button data-test={`buy-${p.id}`} onClick={() => update((s) => ({ bag: [...s.bag, p.id] }))}>Add</button>
    </article>
  ))}
</section>
```

Buy is a stub: it changes the bag and says "Checkout is coming soon"; payments are P2 (§13) and nothing in the app talks to a processor. Images come from the owner's media prefix only. Under reduced motion the ticker shows the final number; under lite the carousel is the grid.
