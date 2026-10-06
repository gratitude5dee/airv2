/**
 * Trade tape client (docs/trade/tape.md) — the Bloxwap-style single screen
 * inside the /trade mini-app. Canvas chart (dotted grid, close line, area
 * fill, break-even/target anchors, right-edge price pill), a left market
 * rail, stake chips, and DOWN/UP thumb buttons that run through the same
 * approval pipeline as the ticket. Polls `tape_state`; the preview token
 * never reaches the browser (T2). No localStorage (C17).
 */

interface TapeMarket {
  productId: string;
  symbol: string;
}

interface TapePosition {
  asset: string;
  qty: number;
  avgCostUsd: number | null;
  valueUsd: number;
  pnlUsd: number | null;
}

interface TapePending {
  decisionId: string;
  orderId: string;
  productId: string;
  side: "BUY" | "SELL";
  label: string;
  est: {
    price: string | null;
    fill: string | null;
    fee: string | null;
    total: string | null;
    currency: string | null;
  };
  expiresAt: string | null;
  mode: "paper" | "live";
  caps: { perOrder: number; daily: number; spentToday: number } | null;
}

interface TapeState {
  ok: boolean;
  error?: string;
  at: string;
  product: string;
  price: number | null;
  changePct: number | null;
  candles: [number, number][];
  mode: "paper" | "live";
  connected: boolean;
  equityUsd: number | null;
  cashUsd: number | null;
  position: TapePosition | null;
  pending: TapePending | null;
  stakeUsd: number[];
}

interface TapePayload {
  product: string;
  markets: TapeMarket[];
  mode: "paper" | "live";
  welcomed: boolean;
}

const UP = "#30d158";
const DOWN = "#ff375f";
const INK = "rgba(255,255,255,0.92)";
const DIM = "rgba(255,255,255,0.45)";
const GRID = "rgba(255,255,255,0.14)";
const POLL_MS = 2500;

function mount(rootEl: HTMLElement) {
  const payload: TapePayload = JSON.parse(rootEl.dataset["payload"] ?? "{}");

  let state: TapeState | null = null;
  let product = payload.product || "BTC-USD";
  let stake: string = "25";
  let busy = false;
  let banner: { text: string; tone: "up" | "down" | "flat"; share: string | null } | null = null;
  let targetEditing = false;

  /* ---------- dom skeleton ---------- */

  rootEl.className = "ttape";
  rootEl.innerHTML = `
<div class="tt-head">
  <div class="tt-chiprow">
    <button class="tt-chip tt-prod" type="button"></button>
    <span class="tt-px"></span>
    <span class="tt-chg"></span>
  </div>
</div>
<div class="tt-stage">
  <canvas class="tt-canvas"></canvas>
  <div class="tt-rail"></div>
  <div class="tt-pos" hidden></div>
  <div class="tt-banner" hidden></div>
  <div class="tt-welcome" hidden>
    <div class="tt-welcome-card">
      <div class="tt-welcome-kicker">demo balance · $10,000</div>
      <h3>Trade with your thumb</h3>
      <p><b>UP</b> buys that dollar stake. <b>DOWN</b> sells it back — it never shorts.</p>
      <p>Every order still lands on your approval — nothing moves until you tap <b>Approve</b>.</p>
      <button class="tt-go" type="button">Got it</button>
    </div>
  </div>
</div>
<div class="tt-posctl" hidden>
  <span class="tt-poslabel"></span>
  <button class="tt-ctl" data-ctl="target" type="button">Target</button>
  <button class="tt-ctl tt-ctl-down" data-ctl="close" type="button">Close</button>
</div>
<div class="tt-target" hidden>
  <input class="tt-target-in" inputmode="decimal" placeholder="price $" />
  <button class="tt-ctl" data-ctl="arm" type="button">Arm watch</button>
</div>
<div class="tt-ledger"></div>
<div class="tt-stakes"></div>
<div class="tt-pending" hidden></div>
<div class="tt-buttons">
  <button class="tt-btn tt-down" type="button"><span>DOWN</span><em></em></button>
  <button class="tt-btn tt-up" type="button"><span>UP</span><em></em></button>
</div>
<div class="tt-hint"></div>`;

  const $ = (sel: string) => rootEl.querySelector(sel) as HTMLElement;
  const canvas = $(".tt-canvas") as HTMLCanvasElement;
  const prodEl = $(".tt-prod");
  const pxEl = $(".tt-px");
  const chgEl = $(".tt-chg");
  const railEl = $(".tt-rail");
  const posEl = $(".tt-pos");
  const posctlEl = $(".tt-posctl");
  const posLabel = $(".tt-poslabel");
  const targetEl = $(".tt-target");
  const targetIn = targetEl.querySelector("input") as HTMLInputElement;
  const bannerEl = $(".tt-banner");
  const ledgerEl = $(".tt-ledger");
  const stakesEl = $(".tt-stakes");
  const pendingEl = $(".tt-pending");
  const buttonsEl = $(".tt-buttons");
  const downBtn = buttonsEl.querySelector(".tt-down") as HTMLButtonElement;
  const upBtn = buttonsEl.querySelector(".tt-up") as HTMLButtonElement;
  const hintEl = $(".tt-hint");
  const welcomeEl = $(".tt-welcome");

  const css = document.createElement("style");
  css.textContent = TAPE_CSS;
  rootEl.appendChild(css);

  /* ---------- helpers ---------- */

  const money = (v: number | null | undefined): string =>
    v === null || v === undefined || !Number.isFinite(v)
      ? "—"
      : `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const price = (v: number | null | undefined): string => {
    if (v === null || v === undefined || !Number.isFinite(v)) return "—";
    if (v >= 1000)
      return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
    if (v >= 1) return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
    return v.toPrecision(4);
  };

  const qtyFmt = (v: number): string =>
    v >= 1
      ? v.toLocaleString("en-US", { maximumFractionDigits: 4 })
      : v.toPrecision(3);

  async function post(
    action: string,
    fields: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    const body = new FormData();
    body.set("action", action);
    for (const [k, v] of Object.entries(fields)) body.set(k, v);
    try {
      const res = await fetch(window.location.pathname, {
        method: "POST",
        body,
        credentials: "same-origin",
      });
      return (await res.json()) as Record<string, unknown>;
    } catch {
      return { ok: false, error: "No connection — try again." };
    }
  }

  function toast(text: string) {
    banner = { text, tone: "down", share: null };
    paintBanner();
    window.setTimeout(() => {
      if (banner?.text === text) {
        banner = null;
        paintBanner();
      }
    }, 6000);
  }

  /* ---------- paint ---------- */

  function paint() {
    if (!state) return;
    prodEl.textContent = state.product;
    pxEl.textContent = `$${price(state.price)}`;
    if (state.changePct !== null && state.changePct !== undefined) {
      const up = state.changePct >= 0;
      chgEl.textContent = `${up ? "▲" : "▼"} ${Math.abs(state.changePct).toFixed(2)}%`;
      chgEl.style.color = up ? UP : DOWN;
    } else {
      chgEl.textContent = "";
    }

    const pos = state.position;
    posEl.hidden = !pos;
    posctlEl.hidden = !pos;
    buttonsEl.classList.toggle("tt-holding", !!pos);
    if (pos) {
      const pnl = pos.pnlUsd;
      const tone = pnl === null ? INK : pnl >= 0 ? UP : DOWN;
      posEl.innerHTML = "";
      const chip = document.createElement("span");
      chip.className = "tt-pos-chip";
      chip.style.borderColor = tone;
      chip.innerHTML = `${qtyFmt(pos.qty)} ${pos.asset} · <b style="color:${tone}">${
        pnl === null ? "—" : `${pnl >= 0 ? "+" : "−"}$${Math.abs(pnl).toFixed(2)}`
      }</b>`;
      posEl.appendChild(chip);
      posLabel.textContent = `${pos.asset} position`;
    }

    const cash = state.cashUsd;
    const equity = state.equityUsd;
    ledgerEl.innerHTML = `<span>${money(cash)} cash</span><span>${money(
      equity,
    )} equity</span><span class="tt-mode">${state.mode === "live" ? "live" : "paper"}</span>`;

    downBtn.disabled = busy || !!state.pending || !pos;
    upBtn.disabled = busy || !!state.pending || (cash !== null && cash < 1);
    downBtn.querySelector("em")!.textContent = pos ? `sell $${stake}` : "flat";
    upBtn.querySelector("em")!.textContent = `buy $${stake}`;

    /* While an approval card is up it owns the thumb zone — the
       stakes/buttons/hint are dead weight behind it. */
    stakesEl.hidden = !!state.pending;
    buttonsEl.hidden = !!state.pending;
    hintEl.hidden = !!state.pending;

    for (const el of Array.from(stakesEl.children)) {
      (el as HTMLElement).classList.toggle(
        "on",
        (el as HTMLElement).dataset["stake"] === stake,
      );
    }
    hintEl.textContent = state.pending
      ? ""
      : "every order waits for your approve — nothing auto-fires";
    paintPending();
    draw();
  }

  function paintPending() {
    const p = state?.pending;
    pendingEl.hidden = !p;
    if (!p) {
      pendingEl.innerHTML = "";
      return;
    }
    const ms = p.expiresAt ? Date.parse(p.expiresAt) - Date.now() : 0;
    const expired = p.expiresAt !== null && ms <= 0;
    const left = Math.max(0, Math.floor(ms / 1000));
    const mm = Math.floor(left / 60);
    const ss = String(left % 60).padStart(2, "0");
    const caps = p.caps
      ? `<div class="tt-caps"><span style="width:${Math.min(
          100,
          (p.caps.spentToday / p.caps.daily) * 100,
        )}%"></span></div><div class="tt-capline">today $${p.caps.spentToday.toFixed(
          0,
        )} of $${p.caps.daily} · per-order max $${p.caps.perOrder}</div>`
      : "";
    pendingEl.innerHTML = `
<div class="tt-pcard">
  <div class="tt-pkick">${p.mode} · approval${expired ? " expired" : ` · ${mm}:${ss}`}</div>
  <div class="tt-plabel">${p.label}</div>
  <table class="tt-ptable"><tbody>
    <tr><td>Est. price</td><td>${p.est.price ?? "—"}</td></tr>
    <tr><td>Est. fill</td><td>${p.est.fill ?? "—"}</td></tr>
    <tr><td>Fee</td><td>${p.est.fee ?? "—"}</td></tr>
    <tr><td>Total</td><td><b>${p.est.total ?? "—"} ${p.est.currency ?? ""}</b></td></tr>
  </tbody></table>
  ${caps}
  <div class="tt-prow">
    <button class="tt-ctl" data-res="dismiss" type="button"${busy ? " disabled" : ""}>Deny</button>
    <button class="tt-ctl tt-approve" data-res="approve" type="button"${busy || expired ? " disabled" : ""}>${
      expired ? "Expired" : "Approve"
    }</button>
  </div>
</div>`;
    for (const btn of Array.from(pendingEl.querySelectorAll("[data-res]"))) {
      btn.addEventListener("click", () => resolve(p, (btn as HTMLElement).dataset["res"]!));
    }
  }

  function paintBanner() {
    if (!banner) {
      bannerEl.hidden = true;
      bannerEl.innerHTML = "";
      return;
    }
    bannerEl.hidden = false;
    const color = banner.tone === "up" ? UP : banner.tone === "down" ? DOWN : INK;
    bannerEl.innerHTML = `<span class="tt-bpill" style="border-color:${color};color:${color}">${banner.text}${
      banner.share ? ` <button class="tt-share" type="button">Share win</button>` : ""
    }</span>`;
    const share = bannerEl.querySelector(".tt-share");
    if (share && banner.share) {
      share.addEventListener("click", () => {
        void navigator.clipboard?.writeText(banner!.share!).catch(() => {});
        share.textContent = "copied";
      });
    }
  }

  /* ---------- chart ---------- */

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const gutter = 58; // right-edge price labels
    const plotW = w - gutter;
    const closes = (state?.candles ?? []).map(([, c]) => c);
    const last = state?.price ?? closes[closes.length - 1] ?? null;
    const pos = state?.position;

    let lo = closes.length ? Math.min(...closes) : (last ?? 0);
    let hi = closes.length ? Math.max(...closes) : (last ?? 1);
    if (pos?.avgCostUsd) {
      lo = Math.min(lo, pos.avgCostUsd);
      hi = Math.max(hi, pos.avgCostUsd);
    }
    if (!(hi > lo)) {
      hi = lo + Math.max(lo * 0.001, 1e-8);
    }
    const pad = (hi - lo) * 0.08;
    lo -= pad;
    hi += pad;
    const y = (v: number) => h - ((v - lo) / (hi - lo)) * h;
    const x = (i: number, n: number) => (n <= 1 ? plotW : (i / (n - 1)) * plotW);

    // dotted grid
    ctx.strokeStyle = GRID;
    ctx.fillStyle = GRID;
    ctx.setLineDash([2, 5]);
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const gy = (h / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }
    for (let i = 1; i <= 5; i++) {
      const gx = (plotW / 6) * i;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    const trendUp =
      pos?.pnlUsd !== null && pos?.pnlUsd !== undefined
        ? pos.pnlUsd >= 0
        : closes.length > 1
          ? closes[closes.length - 1]! >= closes[0]!
          : true;
    const line = trendUp ? UP : DOWN;

    // area + line
    if (closes.length > 1) {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, line + "33");
      grad.addColorStop(1, line + "00");
      ctx.beginPath();
      closes.forEach((c, i) => {
        const px = x(i, closes.length);
        const py = y(c);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.strokeStyle = line;
      ctx.lineWidth = 2;
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.lineTo(plotW, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    } else {
      ctx.fillStyle = DIM;
      ctx.font = "12px ui-monospace, monospace";
      ctx.textAlign = "center";
      ctx.fillText("waiting for ticks…", plotW / 2, h / 2);
    }

    // break-even (Bloxwap's dashed anchor → our avg cost)
    if (pos?.avgCostUsd) {
      const by = y(pos.avgCostUsd);
      ctx.strokeStyle = INK;
      ctx.setLineDash([6, 5]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, by);
      ctx.lineTo(plotW, by);
      ctx.stroke();
      ctx.setLineDash([]);
      label(ctx, `BE ${price(pos.avgCostUsd)}`, plotW + 4, by, INK);
    }

    // last-price line + right-edge pill
    if (last !== null) {
      const ly = y(last);
      ctx.strokeStyle = line;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(0, ly);
      ctx.lineTo(plotW, ly);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = line;
      const text = price(last);
      ctx.font = "600 11px ui-monospace, monospace";
      const tw = ctx.measureText(text).width + 10;
      const th = 18;
      const ry = Math.min(Math.max(ly - th / 2, 2), h - th - 2);
      ctx.beginPath();
      ctx.roundRect(plotW + 3, ry, tw, th, 9);
      ctx.fill();
      ctx.fillStyle = "#0b0b0e";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(text, plotW + 8, ry + th / 2 + 0.5);
    }
  }

  function label(
    ctx: CanvasRenderingContext2D,
    text: string,
    lx: number,
    ly: number,
    color: string,
  ) {
    ctx.font = "9px ui-monospace, monospace";
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, lx, ly);
  }

  /* ---------- events ---------- */

  async function refresh() {
    if (document.hidden) return;
    const res = (await post("tape_state", { product })) as TapeState | { ok: false };
    if ((res as TapeState).ok) {
      state = res as TapeState;
      paint();
    }
  }

  async function intent(side: "up" | "down") {
    if (busy || state?.pending) return;
    busy = true;
    paint();
    const res = await post("tape_intent", { product, side, stake });
    busy = false;
    if (res["ok"] && res["pending"]) {
      await refresh();
      return;
    }
    if (res["ok"] === false) toast(String(res["error"] ?? "Didn't file — try again."));
    await refresh();
  }

  async function resolve(p: TapePending, choice: string) {
    if (busy) return;
    busy = true;
    paintPending();
    const res = await post("tape_resolve", { decision: p.decisionId, choice });
    busy = false;
    if (res["ok"]) {
      const state_ = String(res["state"] ?? "");
      if (choice === "dismiss") {
        banner = { text: "Denied — nothing was placed.", tone: "flat", share: null };
      } else if (state_ === "filled" || state_ === "submitted") {
        const pnl = res["pnlUsd"];
        if (typeof pnl === "number" && Number.isFinite(pnl)) {
          const sign = pnl >= 0 ? "+" : "−";
          const text = `${sign}$${Math.abs(pnl).toFixed(2)} USD realized`;
          banner = {
            text,
            tone: pnl >= 0 ? "up" : "down",
            share: `${text} on ${p.productId} — air /trade`,
          };
        } else {
          banner = {
            text: `${p.side === "BUY" ? "Bought" : "Sold"} — ${String(res["detail"] ?? p.label)}`,
            tone: "up",
            share: null,
          };
        }
      } else if (state_ === "rejected" || state_ === "uncertain") {
        banner = { text: String(res["detail"] ?? "Rejected by the venue."), tone: "down", share: null };
      } else {
        banner = { text: String(res["detail"] ?? "Done."), tone: "flat", share: null };
      }
      paintBanner();
      window.setTimeout(() => {
        banner = null;
        paintBanner();
      }, 8000);
    } else {
      toast(String(res["error"] ?? "Didn't go through — try again."));
    }
    await refresh();
  }

  upBtn.addEventListener("click", () => void intent("up"));
  downBtn.addEventListener("click", () => void intent("down"));

  posctlEl.querySelector('[data-ctl="close"]')!.addEventListener("click", () => {
    stake = "max";
    for (const el of Array.from(stakesEl.children)) {
      (el as HTMLElement).classList.toggle("on", el === stakesEl.lastElementChild);
    }
    void intent("down");
  });
  posctlEl.querySelector('[data-ctl="target"]')!.addEventListener("click", () => {
    targetEditing = !targetEditing;
    targetEl.hidden = !targetEditing;
    if (targetEditing && state?.price) {
      targetIn.value = (state.price * 1.05).toPrecision(6);
      targetIn.focus();
    }
  });
  targetEl.querySelector('[data-ctl="arm"]')!.addEventListener("click", async () => {
    const value = targetIn.value.replace(/[$,\s]/g, "");
    if (!value || Number(value) <= 0) return;
    targetEditing = false;
    targetEl.hidden = true;
    const res = await post("tape_target", {
      symbol: product.split("-")[0]!,
      op: ">",
      price: value,
    });
    toast(res["ok"] ? `Watching ${product.split("-")[0]} > $${value} — iMessage when it crosses.` : String(res["error"] ?? "Couldn't set the watch."));
  });

  stakesEl.innerHTML = "";
  for (const opt of [...(payload.mode === "live" ? [10, 25, 100] : [10, 25, 100]), 0, -1]) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tt-stake";
    if (opt === 0) {
      b.textContent = "½";
      b.dataset["stake"] = "half";
    } else if (opt === -1) {
      b.textContent = "MAX";
      b.dataset["stake"] = "max";
    } else {
      b.textContent = `$${opt}`;
      b.dataset["stake"] = String(opt);
    }
    if (b.dataset["stake"] === stake) b.classList.add("on");
    b.addEventListener("click", () => {
      stake = b.dataset["stake"]!;
      paint();
    });
    stakesEl.appendChild(b);
  }

  railEl.innerHTML = "";
  for (const m of payload.markets ?? []) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tt-mkt";
    b.textContent = m.symbol;
    if (m.productId === product) b.classList.add("on");
    b.addEventListener("click", () => {
      product = m.productId;
      for (const el of Array.from(railEl.children)) {
        (el as HTMLElement).classList.toggle(
          "on",
          (el as HTMLElement).textContent === m.symbol,
        );
      }
      void refresh();
    });
    railEl.appendChild(b);
  }

  if (!payload.welcomed) {
    welcomeEl.hidden = false;
    welcomeEl.querySelector(".tt-go")!.addEventListener("click", () => {
      welcomeEl.hidden = true;
      void post("tape_seen", {});
    });
  }

  window.addEventListener("resize", draw);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void refresh();
  });
  window.setInterval(() => void refresh(), POLL_MS);
  void refresh();
}

const TAPE_CSS = `
.ttape [hidden]{display:none!important}
.ttape{position:relative;width:100%;color:${INK};font-variant-numeric:tabular-nums}
.tt-head{display:flex;justify-content:space-between;align-items:center;padding:0 2px 6px}
.tt-chiprow{display:flex;align-items:baseline;gap:8px}
.tt-chip{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:999px;padding:3px 10px;font:600 12px ui-monospace,monospace;color:${INK}}
.tt-px{font:700 20px/1 ui-monospace,monospace}
.tt-chg{font:600 12px ui-monospace,monospace}
.tt-stage{position:relative;width:100%}
.tt-canvas{display:block;width:100%;height:min(300px,60vw);border-radius:12px;background:rgba(255,255,255,0.025)}
.tt-rail{position:absolute;left:6px;top:8px;bottom:8px;display:flex;flex-direction:column;gap:4px;overflow-y:auto;scrollbar-width:none}
.tt-rail::-webkit-scrollbar{display:none}
.tt-mkt{background:rgba(10,10,14,0.55);border:1px solid rgba(255,255,255,0.1);color:${DIM};border-radius:8px;padding:4px 7px;font:600 10px ui-monospace,monospace;cursor:pointer;backdrop-filter:blur(4px)}
.tt-mkt.on{color:${INK};border-color:rgba(255,255,255,0.4)}
.tt-pos{position:absolute;left:56px;top:8px}
.tt-pos-chip{display:inline-block;background:rgba(10,10,14,0.6);border:1px solid ${INK};border-left-width:3px;border-radius:8px;padding:4px 8px;font:600 11px ui-monospace,monospace;backdrop-filter:blur(4px)}
.tt-banner{position:absolute;top:8px;left:0;right:0;display:flex;justify-content:center;pointer-events:none}
.tt-bpill{pointer-events:auto;background:rgba(10,10,14,0.85);border:1.5px solid ${INK};border-radius:999px;padding:5px 12px;font:700 12px ui-monospace,monospace;backdrop-filter:blur(6px)}
.tt-share{margin-left:8px;background:none;border:none;border-left:1px solid rgba(255,255,255,0.2);padding-left:8px;color:inherit;font:inherit;cursor:pointer;text-decoration:underline}
.tt-ledger{display:flex;gap:12px;align-items:baseline;padding:8px 4px 4px;font:500 11px ui-monospace,monospace;color:${DIM}}
.tt-mode{margin-left:auto;text-transform:uppercase;letter-spacing:0.08em}
.tt-stakes{display:flex;gap:6px;padding:4px 2px}
.tt-stake{flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:${DIM};border-radius:10px;padding:8px 0;font:600 12px ui-monospace,monospace;cursor:pointer}
.tt-stake.on{color:#0b0b0e;background:${INK};border-color:${INK}}
.tt-buttons{display:flex;gap:8px;padding:4px 0 2px}
.tt-btn{flex:1;border:none;border-radius:16px;padding:16px 0 14px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;transition:opacity .15s}
.tt-btn span{font:800 18px/1 ui-monospace,monospace;letter-spacing:0.06em}
.tt-btn em{font:500 10px ui-monospace,monospace;font-style:normal;opacity:0.75}
.tt-btn.tt-up{background:${UP};color:#06130a}
.tt-btn.tt-down{background:${DOWN};color:#170409}
.tt-btn:disabled{opacity:0.28;cursor:default}
.tt-hint{text-align:center;font:500 10px ui-monospace,monospace;color:${DIM};padding:4px 0 0;min-height:14px}
.tt-posctl{display:flex;align-items:center;gap:6px;padding:6px 2px 0}
.tt-poslabel{font:600 11px ui-monospace,monospace;color:${DIM};flex:1;text-transform:uppercase;letter-spacing:0.08em}
.tt-ctl{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14);color:${INK};border-radius:10px;padding:8px 14px;font:700 12px ui-monospace,monospace;cursor:pointer}
.tt-ctl-down{border-color:${DOWN}66;color:${DOWN}}
.tt-approve{background:${UP};border-color:${UP};color:#06130a}
.tt-target{display:flex;gap:6px;padding:6px 2px 0}
.tt-target-in{flex:1;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.14);border-radius:10px;color:${INK};padding:8px 10px;font:600 12px ui-monospace,monospace}
.tt-pending{padding:4px 0}
.tt-pcard{border:1.5px dashed rgba(255,255,255,0.35);border-radius:14px;padding:12px;background:rgba(255,255,255,0.03)}
.tt-pkick{font:600 10px ui-monospace,monospace;color:${DIM};text-transform:uppercase;letter-spacing:0.1em}
.tt-plabel{font:700 16px/1.3 ui-monospace,monospace;margin:6px 0 8px}
.tt-ptable{width:100%;border-collapse:collapse;font:500 12px ui-monospace,monospace}
.tt-ptable td{padding:2px 0;color:${DIM}}
.tt-ptable td+td{text-align:right;color:${INK}}
.tt-caps{height:4px;border-radius:2px;background:rgba(255,255,255,0.08);margin-top:8px;overflow:hidden}
.tt-caps span{display:block;height:100%;background:${INK}}
.tt-capline{font:500 10px ui-monospace,monospace;color:${DIM};margin-top:3px}
.tt-prow{display:flex;gap:8px;margin-top:10px}
.tt-prow .tt-ctl{flex:1;padding:11px 0}
.tt-welcome{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(8,8,12,0.82);border-radius:12px;backdrop-filter:blur(6px);z-index:3}
.tt-welcome-card{max-width:280px;text-align:center;padding:20px}
.tt-welcome-kicker{font:600 10px ui-monospace,monospace;color:${UP};text-transform:uppercase;letter-spacing:0.12em}
.tt-welcome-card h3{font:800 22px/1.2 inherit;margin:8px 0 10px;color:${INK}}
.tt-welcome-card p{font:500 12px/1.5 inherit;color:${DIM};margin:0 0 8px}
.tt-welcome-card b{color:${INK}}
.tt-go{margin-top:8px;background:${UP};border:none;color:#06130a;border-radius:12px;padding:11px 26px;font:800 13px ui-monospace,monospace;cursor:pointer}
`;

const rootEl = document.getElementById("trade-tape");
if (rootEl) {
  mount(rootEl);
}
