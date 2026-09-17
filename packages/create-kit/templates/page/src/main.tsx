import "./app.css";
import { createRoot } from "react-dom/client";
import { cn, useLite, useReducedMotion } from "@kit/air";
import { ShutterTypeCard } from "@kit/arlan/shutter-type";
import TextHighlighter from "@kit/fancy/text-highlighter";

/**
 * page — one page of reading (recipe 06/07 shape without a form). A title
 * card, sections of copy, a list of links. The shutter type is the one hero
 * motion; the highlighter is a single emphasis that sweeps once in view.
 * The Planner replaces COPY, SECTIONS and LINKS; links are real <a href>.
 */
const COPY = {
  kicker: "Studio",
  title: "About the studio",
  lede: "A small room with a big window, open to the street since 2019.",
  highlight: "open to the street",
};

const SECTIONS = [
  { id: "hours", heading: "Hours", body: "Wednesday to Sunday, noon to seven. Closed on holidays." },
  { id: "find", heading: "Find us", body: "Second floor, ring twice. The lift is slow; the stairs are quick." },
];

const LINKS = [
  { id: 1, label: "Website", href: "https://example.com/" },
  { id: 2, label: "Book a visit", href: "https://example.com/visit" },
];

function Lede({ still }: { still: boolean }) {
  const [before, after] = COPY.lede.split(COPY.highlight);
  if (still || after === undefined) return <p className="lede">{COPY.lede}</p>;
  return (
    <p className="lede">
      {before}
      <TextHighlighter triggerType="inView" highlightColor="var(--accent)">
        {COPY.highlight}
      </TextHighlighter>
      {after}
    </p>
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
        <section className="panel stage" aria-label="title card">
          <ShutterTypeCard /> {/* the one hero motion; a still under reduced motion */}
        </section>
        <section className="panel">
          <p className="kicker">{COPY.kicker}</p>
          <h1 data-test="title">{COPY.title}</h1>
          <Lede still={still} />
        </section>
        {SECTIONS.map((s) => (
          <section key={s.id} className="panel" data-test={`section-${s.id}`}>
            <h2>{s.heading}</h2>
            <p>{s.body}</p>
          </section>
        ))}
        <section className="panel">
          <h2>Links</h2>
          {LINKS.map((l) => (
            <a key={l.id} className="item link" href={l.href} data-test={`link-${l.id}`}>
              <span className="grow">{l.label}</span>
              <span className="chip">Open</span>
            </a>
          ))}
        </section>
      </main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
