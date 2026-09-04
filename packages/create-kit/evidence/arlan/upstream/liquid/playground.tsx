"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LiquidGroup, LiquidCard } from "./LiquidGroup";
import { PG_PREVIEW, PG_PANEL, Slider, SegmentedControl, GhostButton } from "../swirl/controls";
import { SectionLabel } from "../section-label";
import { hapticTap } from "../../lib/haptics";
import { useSceneSet } from "./use-compact";
import { COMPACT_SET, type ScenePiece } from "./scenes";

const MODES = [
  { id: "geometric", label: "Geometric", k: 22, cell: 5 },
  { id: "goo", label: "Goo", k: 64, cell: 7 },
];
const COMPACT_MODES = [
  { id: "geometric", label: "Geometric", k: 14, cell: 5 },
  { id: "goo", label: "Goo", k: 42, cell: 6 },
];

const REMIX_MS = 620;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function byRole(cards: ScenePiece[]): ScenePiece[] {
  return [...cards].sort((a, b) => b.w * b.h - a.w * a.h);
}

function tweenCards(from: ScenePiece[], to: ScenePiece[], p: number): ScenePiece[] {
  const a = byRole(from);
  const b = byRole(to);
  return a.map((fc, i) => {
    const tc = b[i] ?? fc;
    const src = p < 0.5 ? fc : tc;
    return {
      id: src.id,
      x: lerp(fc.x, tc.x, p),
      y: lerp(fc.y, tc.y, p),
      w: lerp(fc.w, tc.w, p),
      h: lerp(fc.h, tc.h, p),
      radius: lerp(fc.radius, tc.radius, p),
      content: src.content,
    };
  });
}

export function LiquidPlayground() {
  const set = useSceneSet();
  const compact = set === COMPACT_SET;
  const presets = set.playground;
  const { vw: VW, vh: VH } = set;
  const modes = compact ? COMPACT_MODES : MODES;

  const [presetIdx, setPresetIdx] = useState(0);
  const [cards, setCards] = useState<ScenePiece[]>(() => presets[0].pieces.map((c) => ({ ...c })));
  const [mode, setMode] = useState("");
  const [k, setK] = useState(presets[0].k);
  const [cell, setCell] = useState(presets[0].cell);

  const [activePresets, setActivePresets] = useState(presets);
  if (activePresets !== presets) {
    setActivePresets(presets);
    setPresetIdx(0);
    setCards(presets[0].pieces.map((c) => ({ ...c })));
    setK(presets[0].k);
    setCell(presets[0].cell);
    setMode("");
  }

  const stageRef = useRef<HTMLDivElement>(null);

  const spaceRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);

  const morph = useRef<{ from: ScenePiece[]; to: ScenePiece[]; fromK: number; toK: number; start: number; raf: number } | null>(null);

  useEffect(() => {
    if (morph.current?.raf) cancelAnimationFrame(morph.current.raf);
    morph.current = null;
    drag.current = null;
  }, [presets]);

  const remix = () => {
    hapticTap();
    const i = (presetIdx + 1) % presets.length;
    const target = presets[i];
    setPresetIdx(i);
    setMode("");
    setCell(target.cell);

    if (morph.current?.raf) cancelAnimationFrame(morph.current.raf);
    const m = {
      from: cards.map((c) => ({ ...c })),
      to: target.pieces.map((c) => ({ ...c })),
      fromK: k,
      toK: target.k,
      start: 0,
      raf: 0,
    };
    morph.current = m;
    const step = (now: number) => {
      if (!m.start) m.start = now;
      const p = ease(Math.min(1, (now - m.start) / REMIX_MS));
      setCards(tweenCards(m.from, m.to, p));
      setK(Math.round(lerp(m.fromK, m.toK, p)));
      if (p < 1) {
        m.raf = requestAnimationFrame(step);
      } else {

        setCards(target.pieces.map((c) => ({ ...c })));
        setK(target.k);
        morph.current = null;
      }
    };
    m.raf = requestAnimationFrame(step);
  };

  useEffect(() => () => { if (morph.current?.raf) cancelAnimationFrame(morph.current.raf); }, []);

  const applyMode = (id: string) => {
    setMode(id);
    const m = modes.find((x) => x.id === id);
    if (m) {
      setK(m.k);
      setCell(m.cell);
    }
  };

  const toLocal = useCallback(
    (clientX: number, clientY: number) => {

      const el = spaceRef.current ?? stageRef.current;
      if (!el) return { x: 0, y: 0 };
      const r = el.getBoundingClientRect();
      return {
        x: ((clientX - r.left) / r.width) * VW,
        y: ((clientY - r.top) / r.height) * VH,
      };
    },
    [VW, VH],
  );

  const onPointerDown = (id: string) => (e: React.PointerEvent) => {

    if (morph.current?.raf) {
      cancelAnimationFrame(morph.current.raf);
      morph.current = null;
    }
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const p = toLocal(e.clientX, e.clientY);
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    drag.current = { id, dx: p.x - card.x, dy: p.y - card.y };
    hapticTap();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const p = toLocal(e.clientX, e.clientY);
    const { id, dx, dy } = drag.current;

    const slack = VW * 0.055;
    setCards((cs) =>
      cs.map((c) =>
        c.id === id
          ? {
              ...c,
              x: Math.max(-slack, Math.min(VW - c.w + slack, p.x - dx)),
              y: Math.max(-slack, Math.min(VH - c.h + slack, p.y - dy)),
            }
          : c,
      ),
    );
  };
  const endDrag = () => {
    drag.current = null;
  };

  const groupBridges = useMemo(() => [], []);

  const kMax = compact ? 60 : 90;
  const cellMin = compact ? 4 : 3;
  const cellMax = compact ? 10 : 14;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SectionLabel action={<GhostButton onClick={remix}>Remix</GhostButton>}>
        Implementation
      </SectionLabel>

      {}
      <div className={`${PG_PREVIEW} touch-none`}>
        <div
          ref={stageRef}
          className="relative w-full"
          style={{ aspectRatio: `${VW} / ${VH}` }}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="absolute inset-0" style={{ containerType: "size" }}>
            {}
            <div
              ref={spaceRef}
              className="absolute left-1/2 top-1/2"
              style={{
                width: VW,
                height: VH,
                transform: "translate(-50%, -50%)",
                transformOrigin: "center",
                scale: `calc(100cqw / ${set.pgDiv})`,
              }}
            >
              <LiquidGroup
                k={k}
                cardRadius={set.cardRadius}
                cell={cell}
                smooth={2}
                bridges={groupBridges}
                fill="var(--bg-surface)"
                className="h-full w-full"
              >
                {cards.map((c) => (
                  <LiquidCard key={c.id} id={c.id} x={c.x} y={c.y} w={c.w} h={c.h} radius={c.radius}>
                    <div
                      onPointerDown={onPointerDown(c.id)}
                      className="h-full w-full cursor-grab active:cursor-grabbing"
                    >
                      {c.content}
                    </div>
                  </LiquidCard>
                ))}
              </LiquidGroup>
            </div>
          </div>
        </div>
      </div>

      {/* Panel */}
      <div className={`${PG_PANEL} gap-3.5`}>
        <SegmentedControl
          options={modes.map((m) => ({ id: m.id, label: m.label }))}
          activeId={mode}
          onPick={applyMode}
          fill
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Slider label="Blend" value={k} min={0} max={kMax} step={1}
            format={(v) => `${v}`} onChange={(v) => { setMode(""); setK(v); }} />
          <Slider label="Detail" value={cell} min={cellMin} max={cellMax} step={1}
            format={(v) => `${v}px`} onChange={(v) => { setMode(""); setCell(v); }} />
        </div>
      </div>
    </div>
  );
}
