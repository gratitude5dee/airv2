import "./app.css";
import { createRoot } from "react-dom/client";
import { cn, useLite, useReducedMotion } from "@kit/air";
import { SwingTypeCard } from "@kit/arlan/swing-type";
import { Squircle } from "@kit/arlan/squircle";
import VerticalCutReveal from "@kit/fancy/vertical-cut-reveal";
import SimpleMarquee from "@kit/fancy/simple-marquee";

/**
 * landing — one promise, one proof strip, one tap (recipe 09).
 * The Planner replaces COPY, PROOF and CTA_HREF; the structure stays.
 *
 * Full-surface variant: swap SwingTypeCard for RushTypeCard from
 * "@kit/arlan/rush-type" (WebGL1, not lite) and set surface.lite to false in
 * air.json; keep SwingTypeCard as the useLite() fallback.
 */
const COPY = {
  kicker: "October tour",
  headline: "Twelve cities, one van",
  subline: "New record, old friends, every night a different room.",
  cta: "Get tickets",
};
const CTA_HREF = "https://example.com/tickets";
const PROOF = ["Sold out · Berlin", "Sold out · Lisbon", "Added · Oslo", "New · Dublin"];

function ProofStrip({ still }: { still: boolean }) {
  const chips = PROOF.map((p) => (
    <span key={p} className="chip proof-chip">
      {p}
    </span>
  ));
  if (still) return <div className="row proof-row" data-test="proof">{chips}</div>;
  return (
    <div className="proof-row" data-test="proof">
      <SimpleMarquee baseVelocity={1.5} repeat={3}>
        {chips}
      </SimpleMarquee>
    </div>
  );
}

function App() {
  const lite = useLite();
  const reduced = useReducedMotion();
  const still = lite || reduced;
  return (
    <div className={cn("frame", lite && "lite")}>
      <header className="bar">
        <span className="app-pill">{COPY.kicker}</span>
      </header>
      <main className="app">
        <section className="panel stage" aria-label="hero">
          <SwingTypeCard /> {/* the one hero motion; a still under reduced motion */}
        </section>
        <section className="panel">
          <p className="kicker">{COPY.kicker}</p>
          <h1 data-test="headline">{COPY.headline}</h1>
          <p className="subline">
            {still ? COPY.subline : <VerticalCutReveal splitBy="words" staggerDuration={0.04}>{COPY.subline}</VerticalCutReveal>}
          </p>
          <Squircle radius={22} smoothing={0.8} className="cta" fill="var(--accent)">
            <a data-test="cta" className="cta-link" href={CTA_HREF}>
              {COPY.cta}
            </a>
          </Squircle>
        </section>
        <ProofStrip still={still} />
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
