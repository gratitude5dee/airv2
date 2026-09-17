import "./app.css";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { cn, useLite, useReducedMotion } from "@kit/air";
import "@kit/beautiful/foundation";
import { Squircle } from "@kit/arlan/squircle";
import { ValuePill } from "@kit/beautiful/value-pill";
import NumberTicker from "@kit/fancy/basic-number-ticker";

/**
 * store — a few things with a price and a button each (recipe 10).
 * The Planner replaces PRODUCTS and the copy; images come from the owner's
 * media prefix only (/api/media/* or https://media.wzrd.tech/...). Until the
 * owner supplies images, each tile shows a token-coloured swatch.
 */
interface Product {
  id: string;
  name: string;
  price: string;
  note: string;
  image?: string;
  alt?: string;
}

const PRODUCTS: Product[] = [
  { id: "tee", name: "Tour tee", price: "$28", note: "Heavyweight, black" },
  { id: "lp", name: "Vinyl LP", price: "$32", note: "Gatefold, 180g" },
  { id: "tote", name: "Tote", price: "$18", note: "Natural canvas" },
  { id: "poster", name: "Poster", price: "$12", note: "A2, signed" },
];

const COPY = {
  kicker: "In the bag",
  title: "Merch table",
  // Payments are P2 (goal-create-v12 §13). The Buy action changes local state
  // and says so; nothing here talks to a processor, files a ledger row or
  // charges anyone. When payments land the Planner replaces this string and
  // the stub below.
  stub: "Checkout is coming soon — nothing was charged.",
};

function App() {
  const lite = useLite();
  const reduced = useReducedMotion();
  const [bag, setBag] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const featured = PRODUCTS[0]!;

  // Buy is a stub: it files nothing. See COPY.stub.
  const buy = (id: string) => {
    setBag((b) => [...b, id]);
    setNotice(COPY.stub);
  };

  return (
    <div className={cn("frame", lite && "lite")}>
      <header className="bar">
        <span className="app-pill">{COPY.title}</span>
        <span className="chip" data-test="bag-count">
          {COPY.kicker} · {bag.length}
        </span>
      </header>
      <main className="app">
        {notice && (
          <p className="notice" role="status" data-test="notice">
            {notice}
          </p>
        )}
        <section className="panel">
          <p className="kicker">{COPY.kicker}</p>
          <div className="count" aria-live="polite">
            {reduced ? <span>{bag.length}</span> : <NumberTicker key={bag.length} from={Math.max(0, bag.length - 1)} target={bag.length} />}
          </div>
        </section>
        <Squircle radius={26} smoothing={0.8} className="featured" fill="var(--panel-bg)" stroke="var(--ring)">
          <article className="featured-body" data-test={`product-${featured.id}`}>
            <Swatch product={featured} />
            <h3 className="name">{featured.name}</h3>
            <p className="desc">{featured.note}</p>
            <div className="row">
              <ValuePill tone="accent">{featured.price}</ValuePill>
              <button data-test={`buy-${featured.id}`} onClick={() => buy(featured.id)}>
                Add
              </button>
            </div>
          </article>
        </Squircle>
        <section className="grid">
          {PRODUCTS.slice(1).map((p) => (
            <article key={p.id} className="tile" data-test={`product-${p.id}`}>
              <Swatch product={p} />
              <h3 className="name">{p.name}</h3>
              <p className="desc">{p.note}</p>
              <div className="row">
                <ValuePill tone="accent">{p.price}</ValuePill>
                <button data-test={`buy-${p.id}`} onClick={() => buy(p.id)}>
                  Add
                </button>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}

function Swatch({ product }: { product: Product }) {
  if (product.image) {
    return <img className="swatch" src={product.image} alt={product.alt ?? product.name} loading="lazy" decoding="async" />;
  }
  return <div className="swatch" role="img" aria-label={product.name} />;
}

createRoot(document.getElementById("root")!).render(<App />);
