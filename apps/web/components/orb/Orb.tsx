/** S1 lattice orb — the "thinking" indicator. */
import type { CSSProperties } from "react";
import styles from "./Orb.module.css";

/** The stage the geometry is tuned on; --orb-k scales it to `size`. */
const STAGE = 28;

/** Default rendered size — 20×20 indicator box. */
const SIZE = 20;

export type OrbVariant = "S1";

const N = 3; // lattice is N×N
const PITCH = 6; // centre-to-centre spacing in stage px; the dot size is CSS
const MID = (N - 1) / 2;

/**
 * Per-cell `animation-delay` in ms. Negative values seed a cell partway
 * into its cycle. S1 radiates from the centre on a round wavefront; the
 * centre leads a beat early so the next swell doesn't sit behind the
 * outer fade.
 */
function cellDelay(x: number, y: number): number {
  const dx = x - MID;
  const dy = y - MID;
  return Math.hypot(dx, dy) * 700 - (dx === 0 && dy === 0 ? 180 : 0);
}

interface Cell {
  key: string;
  left: number;
  top: number;
  delay: number;
  /** Centre cell — the static frame under reduced motion. */
  mid: boolean;
}

/** The 9 lattice cells, with position and phase. */
function latticeCells(): Cell[] {
  const cells: Cell[] = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      cells.push({
        key: x + "," + y,
        left: x * PITCH,
        top: y * PITCH,
        delay: cellDelay(x, y),
        mid: x === MID && y === MID,
      });
    }
  }
  return cells;
}

export interface OrbProps {
  /** Rendered edge length in px. The 28px geometry scales to fit. */
  size?: number;
  /** Accessible label, and the status text when `pill` is set. */
  label?: string;
  /** Wraps the orb and its label in a status pill. */
  pill?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function Orb({ size = SIZE, label, pill, className, style }: OrbProps) {
  const text = label ?? "Thinking…";
  return (
    <span
      className={styles.root + (className ? " " + className : "")}
      data-pill={pill ? "" : undefined}
      style={style}
    >
      <span
        className={styles.glyph}
        role={pill ? undefined : "img"}
        aria-label={pill ? undefined : text}
        aria-hidden={pill ? true : undefined}
        style={
          { width: size, height: size, "--orb-k": size / STAGE } as CSSProperties
        }
      >
        <span className={styles.lattice} data-variant="S1">
          {latticeCells().map((c) => (
            <span
              key={c.key}
              className={styles.cell}
              data-mid={c.mid ? "" : undefined}
              style={{
                left: c.left,
                top: c.top,
                animationDelay: c.delay + "ms",
              }}
            />
          ))}
        </span>
      </span>
      {pill && <span className={styles.pillLabel}>{text}</span>}
    </span>
  );
}
