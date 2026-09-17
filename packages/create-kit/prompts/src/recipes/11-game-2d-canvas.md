### 2D canvas game (`game-2d` template)

One `<canvas>` sized to the panel at `devicePixelRatio`, a `requestAnimationFrame` loop that reads a `ref`, tap to act. Components: `arlan/typer` for the title line, `fancy/basic-number-ticker` for the score readout, `beautiful/value-pill` for the best score; the game itself is plain Canvas 2D and needs no catalog component. The loop is the screen's one motion.

```tsx
const { state, update, canWrite } = useAirState<{ best: number }>({ best: 0 });   // resource: best
const [score, setScore] = useState(0);
const [running, setRunning] = useState(false);
useEffect(() => {
  if (!running) return;
  let raf = 0, last = performance.now();
  const tick = (now: number) => { step(now - last); last = now; draw(); raf = requestAnimationFrame(tick); };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}, [running]);
<section className="panel hero">
  <h1><TyperText text="Skyline dash" play="in" /></h1>
  <canvas ref={canvasRef} data-test="stage" onPointerDown={jump} aria-label="game" />
  <div className="row"><span data-test="score"><NumberTicker from={0} target={score} /></span><ValuePill>best {state.best}</ValuePill></div>
  <button data-test="start" onClick={() => setRunning(true)}>Play</button>
</section>
```

The frame budget is 16ms on a phone: draw with rects and arcs, no filters, no per-frame allocations, no `getImageData`. Pause when `document.hidden`. Under reduced motion the canvas still advances (the game is the motion) but every ambient effect — parallax, screen shake, particles — is off; under lite there is one canvas and no backdrop. The high score is the owner's `useAirState` document; guests play and see the board but never write.
