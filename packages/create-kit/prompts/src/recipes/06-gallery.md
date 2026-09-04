### Gallery

Images from the owner's media prefix (`/api/media/*` on the app origin or `https://media.wzrd.tech` via `img-src`), never anywhere else. Components: `.grid` of `.tile` from the shell, `fancy/stacking-cards` for a stacked hero, `fancy/simple-carousel` when the set is ≤ 8, `arlan/squircle` for the tile shape.

```tsx
<section className="grid">
  {photos.map((p) => (
    <figure key={p.src} className="tile squircle">
      <img src={p.src} alt={p.alt} loading="lazy" decoding="async" />
      <figcaption className="muted">{p.caption}</figcaption>
    </figure>
  ))}
</section>
```

Each image ≤ 2 MiB, sized for 390px × DPR 3 at most. No lightbox motion beyond a 200ms fade; no pinch-zoom implementation (the webview does it). Under lite the carousel becomes the grid.
