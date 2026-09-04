"use client";

/** React wrapper over the vanilla Typer class (arlan.me, MIT). */
import { useEffect, useRef, type CSSProperties } from "react";
import { Typer, type TyperOptions } from "./typer";
import "./typer.css";
import { useReducedMotion } from "../../air";

export type { TyperOptions, TyperType } from "./typer";
export { Typer, TyperGroup, ALL_VARIATIONS } from "./typer";

export interface TyperTextProps extends TyperOptions {
  readonly text: string;
  /** "in" types the text in; "out" types it away; "inout" does both. */
  readonly play?: "in" | "out" | "inout";
  readonly as?: "span" | "p" | "h1" | "h2" | "h3";
  readonly className?: string;
  readonly style?: CSSProperties;
}

export function TyperText({ text, play = "in", as = "span", className, style, ...opts }: TyperTextProps) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced) {
      el.textContent = text;
      return;
    }
    const t = new Typer(el, opts);
    if (play === "in") t.in();
    else if (play === "out") t.out();
    else t.inOut();
    return () => t.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, play, reduced]);
  const Tag = as as "span";
  return (
    <Tag ref={ref as never} data-typer className={className} style={style}>
      {text}
    </Tag>
  );
}

export default TyperText;
