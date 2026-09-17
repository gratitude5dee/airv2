### 3D game (`game-3d` template, `three`)

A scene, a camera, a tap. This shape is not `lite`: WebGL and a renderer are the point. Components: `fancy/scramble-in` for the title, `fancy/basic-number-ticker` for the score; the scene comes from `three` once it is vendored. **`three` is not in `vendor/sbom.json` yet (MC5):** `import * as THREE from "three"` is a hard `foreign-import` finding today, so the recipe and the scaffold ship a Canvas 2D poster — a projected wireframe drawn by hand — under lite, and that poster is the whole game until the tarball lands. Keep the `three` code behind one `Scene` component so swapping the poster for the renderer is one file.

```tsx
const lite = useLite();
const reduced = useReducedMotion();
<section className="panel hero">
  <h1 data-test="title"><ScrambleIn text="Orbit" autoStart /></h1>
  {lite || reduced ? <Poster data-test="poster" /> : <Scene onScore={setScore} />}   {/* Poster: Canvas 2D still frame */}
  <p className="kicker">Score</p>
  <NumberTicker from={0} target={score} className="count" data-test="score" />
  <button data-test="start" onClick={start}>Start</button>
</section>
```

`air.json` says `surface.lite: false`; the weight (~150 KiB gz for the `three` core) fits the 1 MiB hard budget, not the 300 KiB lite budget. The `libraries/metal-fx` rule applies: under lite, reduced motion or no WebGL the app renders one complete still frame — never a black canvas, never a spinner. Pause the loop when `document.hidden`; dispose geometries on unmount; no postprocessing, no shadows, one light.
