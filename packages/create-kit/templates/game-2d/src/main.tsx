import "./app.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { cn, useAirState, useLite, useReducedMotion } from "@kit/air";
import "@kit/beautiful/foundation";
import TyperText from "@kit/arlan/typer";
import { ValuePill } from "@kit/beautiful/value-pill";
import NumberTicker from "@kit/fancy/basic-number-ticker";

/**
 * game-2d — a one-tap Canvas 2D runner (recipe 11). Plain Canvas 2D: rects
 * and arcs, no filters, no per-frame allocation, no getImageData. The loop
 * is the screen's one motion; under reduced motion the ambient skyline is
 * off and the game still runs (the game *is* the motion). The high score is
 * the owner's useAirState document ("best"); guests play and never write.
 * The Planner replaces COPY and the tuning in RULES.
 */
const COPY = {
  title: "Skyline dash",
  hint: "Tap to jump",
  play: "Play",
  again: "Play again",
  over: "Crashed",
};

const RULES = {
  gravity: 0.0026, // px/ms²
  jump: -0.72, // px/ms
  speed: 0.22, // px/ms, grows with score
  gapMs: 1400,
  runner: 22,
};

interface Block {
  x: number;
  w: number;
  h: number;
}

interface World {
  y: number; // runner offset above ground (0 = on ground)
  vy: number;
  blocks: Block[];
  elapsed: number;
  sinceBlock: number;
  alive: boolean;
}

function fresh(): World {
  return { y: 0, vy: 0, blocks: [], elapsed: 0, sinceBlock: 0, alive: true };
}

/** Theme tokens for the canvas: read once per frame from the document, never literal. */
function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "currentColor";
}

function App() {
  const lite = useLite();
  const reduced = useReducedMotion();
  const { state, update, canWrite } = useAirState<{ best: number }>({ best: 0 }); // resource: best
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const world = useRef<World>(fresh());
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const [score, setScore] = useState(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
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
    const ground = h - 28;
    const ink = token("--ink");
    const accent = token("--accent");
    const muted = token("--ink-muted");
    const wd = world.current;
    if (!reduced && !lite) {
      // ambient skyline, off under reduced motion and lite
      ctx.fillStyle = muted;
      ctx.globalAlpha = 0.18;
      const shift = (wd.elapsed * 0.02) % 60;
      for (let x = -shift; x < w; x += 60) {
        const bh = 30 + ((x * 7) % 50);
        ctx.fillRect(x, ground - bh, 36, bh);
      }
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = muted;
    ctx.fillRect(0, ground, w, 2);
    ctx.fillStyle = ink;
    for (const b of wd.blocks) ctx.fillRect(b.x, ground - b.h, b.w, b.h);
    ctx.fillStyle = accent;
    const r = RULES.runner;
    ctx.beginPath();
    ctx.arc(48 + r / 2, ground - r / 2 - wd.y, r / 2, 0, Math.PI * 2);
    ctx.fill();
  }, [lite, reduced]);

  const step = useCallback((dt: number, w: number) => {
    const wd = world.current;
    if (!wd.alive) return;
    const ms = Math.min(dt, 40);
    wd.elapsed += ms;
    wd.sinceBlock += ms;
    const speed = RULES.speed + Math.min(0.2, wd.elapsed / 60000);
    wd.vy += RULES.gravity * ms;
    wd.y = Math.max(0, wd.y - wd.vy * ms);
    if (wd.y === 0) wd.vy = 0;
    for (const b of wd.blocks) b.x -= speed * ms;
    wd.blocks = wd.blocks.filter((b) => b.x + b.w > -10);
    if (wd.sinceBlock > RULES.gapMs) {
      wd.sinceBlock = 0;
      wd.blocks.push({ x: w + 10, w: 18 + (wd.blocks.length % 3) * 6, h: 22 + ((wd.elapsed / 700) % 3) * 8 });
    }
    const rx = 48;
    const r = RULES.runner;
    for (const b of wd.blocks) {
      const hit = b.x < rx + r && b.x + b.w > rx && wd.y < b.h;
      if (hit) wd.alive = false;
    }
  }, []);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    let shown = -1;
    const tick = (now: number) => {
      const canvas = canvasRef.current;
      if (document.hidden) {
        last = now;
        raf = requestAnimationFrame(tick);
        return;
      }
      step(now - last, canvas?.clientWidth ?? 390);
      last = now;
      draw();
      const wd = world.current;
      const tenths = Math.floor(wd.elapsed / 100);
      if (tenths !== shown) {
        shown = tenths;
        setScore(tenths);
      }
      if (!wd.alive) {
        setRunning(false);
        setOver(true);
        // save-best: owner only; a guest's update is refused with canWrite=false and nothing else happens
        if (tenths > state.best && canWrite !== false) void update((s) => ({ best: Math.max(s.best, tenths) }));
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, step, draw, state.best, canWrite, update]);

  useEffect(() => {
    draw();
  }, [draw]);

  const start = () => {
    world.current = fresh();
    setScore(0);
    setOver(false);
    setRunning(true);
  };

  const jump = () => {
    const wd = world.current;
    if (!running || !wd.alive) return;
    if (wd.y === 0) wd.vy = RULES.jump;
  };

  return (
    <div className={cn("frame", lite && "lite")}>
      <header className="bar">
        <span className="app-pill">{COPY.title}</span>
        <ValuePill tone="accent">best {state.best}</ValuePill>
      </header>
      <main className="app">
        <section className="panel">
          <h1 data-test="title">{COPY.title}</h1>
          <p className="kicker">
            <TyperText text={COPY.hint} play="in" />
          </p>
          <canvas
            ref={canvasRef}
            className="stage"
            data-test="stage"
            role="img"
            aria-label={running ? "game running" : COPY.hint}
            onPointerDown={jump}
          />
          <div className="row scoreboard">
            <span className="score" data-test="score" aria-live="polite">
              {score}
            </span>
            {over && <span className="chip on" data-test="status">{COPY.over}</span>}
            {over && !reduced && <NumberTicker key={score} from={0} target={score} className="muted" />}
          </div>
          <div className="row actions">
            {!running && (
              <button data-test="start" onClick={start}>
                {over ? COPY.again : COPY.play}
              </button>
            )}
            {running && (
              <button data-test="jump" className="ghost" onClick={jump}>
                Jump
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
