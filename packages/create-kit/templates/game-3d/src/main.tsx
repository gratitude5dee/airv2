import "./app.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { cn, useLite, useReducedMotion } from "@kit/air";
import ScrambleIn from "@kit/fancy/scramble-in";
import NumberTicker from "@kit/fancy/basic-number-ticker";

/**
 * game-3d — a tap-timing game around a spinning cube (recipe 12).
 *
 * `three` is NOT vendored yet (MC5: vendor/tarballs/three-*.tgz + SBOM). An
 * `import * as THREE from "three"` is a hard `foreign-import` finding today,
 * so <Scene> below is a Canvas 2D stand-in: a hand-projected wireframe cube
 * that keeps the game playable and the file shape ready. When `three` lands,
 * replace the body of <Scene> with a WebGLRenderer, one camera, one light,
 * no shadows, no postprocessing — and keep <Poster> exactly as it is: under
 * lite, reduced motion or no WebGL the app renders one complete still frame
 * (the Kit's metal-fx rule), never a black canvas or a spinner.
 *
 * surface.lite is false: the weight belongs to the 1 MiB hard budget, not
 * the 300 KiB lite budget. The Planner replaces COPY and the tuning.
 */
const COPY = {
  title: "Orbit",
  hint: "tap when it glows",
  start: "Start",
  again: "Again",
  ready: "Ready",
  running: "Running",
  stopped: "Stopped",
  still: "Still frame — motion is off on this surface",
};

const RULES = {
  spinPerMs: 0.0011, // radians per ms
  glowEveryMs: 1800,
  glowForMs: 520,
  roundMs: 20000,
};

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "currentColor";
}

const VERTS: [number, number, number][] = [
  [-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1],
  [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1],
];
const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

/** Draw a projected wireframe cube; the poster and the stand-in scene share it. */
function drawCube(canvas: HTMLCanvasElement, angle: number, glow: boolean) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const size = Math.min(w, h) * 0.26;
  const cx = w / 2;
  const cy = h / 2;
  const ay = angle;
  const ax = angle * 0.7;
  const pts = VERTS.map(([x, y, z]) => {
    // rotate around Y then X, then a simple perspective divide
    const x1 = x * Math.cos(ay) + z * Math.sin(ay);
    const z1 = -x * Math.sin(ay) + z * Math.cos(ay);
    const y1 = y * Math.cos(ax) - z1 * Math.sin(ax);
    const z2 = y * Math.sin(ax) + z1 * Math.cos(ax);
    const p = 3.2 / (3.2 + z2);
    return [cx + x1 * size * p, cy + y1 * size * p] as const;
  });
  ctx.lineWidth = glow ? 3 : 1.5;
  ctx.strokeStyle = glow ? token("--accent") : token("--ink");
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (const [a, b] of EDGES) {
    ctx.moveTo(pts[a]![0], pts[a]![1]);
    ctx.lineTo(pts[b]![0], pts[b]![1]);
  }
  ctx.stroke();
}

/** One complete still frame: what lite, reduced motion and no-WebGL viewers get. */
function Poster() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const paint = () => drawCube(canvas, 0.62, true);
    paint();
    const ro = new ResizeObserver(paint);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);
  return (
    <>
      <canvas ref={ref} className="stage" data-test="poster" role="img" aria-label={COPY.title} />
      <p className="muted still" data-test="still">
        {COPY.still}
      </p>
    </>
  );
}

/** The animated scene. Canvas 2D today; a `three` renderer once it is vendored (see the header). */
function Scene({ running, onTap }: { running: boolean; onTap: (glow: boolean) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const glowRef = useRef(false);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let raf = 0;
    let angle = 0;
    let last = performance.now();
    let clock = 0;
    const tick = (now: number) => {
      const dt = Math.min(now - last, 40);
      last = now;
      if (!document.hidden && running) {
        angle += RULES.spinPerMs * dt;
        clock += dt;
        glowRef.current = clock % RULES.glowEveryMs < RULES.glowForMs;
        drawCube(canvas, angle, glowRef.current);
      }
      raf = requestAnimationFrame(tick);
    };
    drawCube(canvas, angle, false);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);
  return (
    <canvas
      ref={ref}
      className="stage"
      data-test="scene"
      role="img"
      aria-label={running ? COPY.running : COPY.title}
      onPointerDown={() => onTap(glowRef.current)}
    />
  );
}

function App() {
  const lite = useLite();
  const reduced = useReducedMotion();
  const still = lite || reduced;
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState(COPY.ready);
  const [score, setScore] = useState(0);
  const [hit, setHit] = useState<string | null>(null);
  const stopAt = useRef(0);

  const start = () => {
    setScore(0);
    setHit(null);
    setRunning(true);
    setStatus(COPY.running);
    stopAt.current = performance.now() + RULES.roundMs;
  };

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (performance.now() >= stopAt.current) {
        setRunning(false);
        setStatus(COPY.stopped);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [running]);

  const tap = useCallback(
    (glow: boolean) => {
      if (!running) return;
      if (glow) {
        setScore((s) => s + 1);
        setHit("Hit");
      } else {
        setHit("Miss");
      }
    },
    [running]
  );

  return (
    <div className={cn("frame", lite && "lite")}>
      <header className="bar">
        <span className="app-pill">{COPY.title}</span>
        <span className="chip" data-test="status">
          {status}
        </span>
      </header>
      <main className="app">
        <section className="panel">
          <h1 data-test="title">{COPY.title}</h1>
          <p className="kicker">{still ? COPY.hint : <ScrambleIn text={COPY.hint} autoStart />}</p>
          {still ? <Poster /> : <Scene running={running} onTap={tap} />}
          <div className="row scoreboard">
            <span className="score" data-test="score" aria-live="polite">
              {still ? score : <NumberTicker key={score} from={Math.max(0, score - 1)} target={score} transition={{ duration: 0.4 }} />}
            </span>
            {hit && <span className={cn("chip", hit === "Hit" && "on")} data-test="hit">{hit}</span>}
          </div>
          <div className="row actions">
            {!running && (
              <button data-test="start" onClick={start}>
                {status === COPY.stopped ? COPY.again : COPY.start}
              </button>
            )}
            {running && still && (
              <button data-test="tap" className="ghost" onClick={() => tap(true)}>
                Tap
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
