/**
 * Shared mini-app HTML shell (M7.5, extracted for loader v2). Every renderer
 * emits plain server HTML into this page chrome — nothing is ever written to
 * localStorage/sessionStorage (C17) and the CSP names its frame ancestors
 * explicitly (MA1): the mini origin itself plus the main app, so /home can
 * embed first-party pages in the in-chat dock. frame-ancestors supersedes
 * X-Frame-Options in every engine that supports CSP2, so no XFO is sent —
 * SAMEORIGIN would contradict the allowed app origin.
 */
import { NextResponse } from "next/server";
import { env } from "../env";

export function baseHeaders(): Record<string, string> {
  return {
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy":
      "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; " +
      `frame-ancestors 'self' ${env.appOrigin()}`,
    "Cache-Control": "no-store",
  };
}

export function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function page(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${esc(title)}</title><style>
:root{--bg:#fafafa;--surface:#ffffff;--surface-2:#f4f4f5;--ring:rgba(0,0,0,0.08);--text:#1a1a1a;--muted:#a1a1a1;--shadow:0 0 0 0.5px rgba(0,0,0,0.08),0 1px 2px rgba(0,0,0,0.05),0 2px 4px rgba(0,0,0,0.02)}
@media(prefers-color-scheme:dark){:root{--bg:#101012;--surface:#1a1a1c;--surface-2:#232326;--ring:rgba(255,255,255,0.12);--text:#f5f5f5;--muted:#a3a3a3;--shadow:0 0 0 0.5px rgba(255,255,255,0.12),0 1px 2px rgba(0,0,0,0.4),0 2px 4px rgba(0,0,0,0.3)}}
body{font-family:"Inter",-apple-system,system-ui,sans-serif;background:var(--bg);color:var(--text);margin:0;padding:16px;letter-spacing:-0.12px;-webkit-font-smoothing:antialiased}
h1{font-size:17px;font-weight:600;letter-spacing:-0.02em;margin:0 0 12px}
.cols{display:flex;gap:10px;align-items:flex-start}
.col{flex:1;background:var(--surface-2);border-radius:12px;padding:8px;min-width:0}
.col h2{font-size:11px;font-weight:500;margin:4px 6px 8px;color:var(--muted);text-transform:uppercase;letter-spacing:0.04em}
.card{background:var(--surface);border-radius:10px;box-shadow:var(--shadow);padding:9px 10px;margin-bottom:8px;font-size:13px;line-height:1.4}
.card form{margin-top:6px;display:flex;gap:4px;flex-wrap:wrap}
button{background:var(--text);color:var(--bg);border:0;border-radius:999px;padding:5px 10px;font-size:11px;font-weight:550;cursor:pointer}
button:hover{opacity:0.85}
button.ghost{background:transparent;color:var(--muted);box-shadow:0 0 0 0.5px var(--ring)}
button.ghost:hover{opacity:1;color:var(--text);background:var(--surface-2)}
input[type=text],input[type=password]{background:var(--surface);color:var(--text);border:0.5px solid var(--ring);border-radius:10px;padding:8px 10px;flex:1;font-size:13px;outline:none}
input[type=text]:focus,input[type=password]:focus{border-color:#2b7fff;box-shadow:0 0 0 3px rgba(43,127,255,0.12)}
input[type=text]::placeholder,input[type=password]::placeholder{color:var(--muted)}
.item{display:flex;align-items:center;gap:8px;background:var(--surface);border-radius:10px;box-shadow:var(--shadow);padding:10px 12px;margin-bottom:8px;font-size:13px}
.done{text-decoration:line-through;color:var(--muted)}
.addrow{display:flex;gap:6px;margin-top:12px}
.day{font-size:11px;font-weight:500;margin:14px 2px 6px;color:var(--muted);text-transform:uppercase;letter-spacing:0.04em}
.pending{box-shadow:none;border:1px dashed var(--muted)}
.when{color:var(--muted);font-size:12px;white-space:nowrap}
.muted{color:var(--muted);font-size:12px}
h2{font-size:11px;font-weight:600;letter-spacing:0.08em;color:var(--muted);text-transform:uppercase;margin:16px 0 6px}
h3{font-size:12px;font-weight:600;margin:12px 0 4px}
pre{background:var(--surface-2);border-radius:10px;padding:8px 10px;font-size:11px;white-space:pre-wrap;word-break:break-word;max-height:240px;overflow:auto}
table{width:100%;border-collapse:collapse;font-size:11px}
th,td{text-align:left;padding:4px 6px;border-bottom:0.5px solid var(--ring)}
textarea{background:var(--surface);color:var(--text);border:0.5px solid var(--ring);border-radius:10px;padding:8px 10px;font-size:13px;outline:none;font-family:inherit}
</style></head><body>${body}</body></html>`;
}

export function html(
  body: string,
  extra?: Record<string, string>
): NextResponse {
  return new NextResponse(body, {
    status: 200,
    headers: {
      ...baseHeaders(),
      ...extra,
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

export function forbidden(message: string): NextResponse {
  return new NextResponse(message, { status: 403, headers: baseHeaders() });
}

/**
 * Styled 403 for expired/missing mini-app sessions — signed links are
 * single-use and short-lived by design, so this is a normal dead end that
 * deserves a real page instead of a raw error string. Still a 403.
 */
export function sessionExpired(message: string): NextResponse {
  const body = `<h1>This link has expired</h1><div class="card"><p>${esc(message)}</p><p>Mini-app links are single-use and expire quickly on purpose — nothing is wrong with your account.</p><p>To get back in, ask Air for a fresh link, or reopen the app from its card in Messages or from your home screen.</p></div>`;
  return new NextResponse(page("Link expired", body), {
    status: 403,
    headers: { ...baseHeaders(), "Content-Type": "text/html; charset=utf-8" },
  });
}

export function notFound(): NextResponse {
  return new NextResponse("not found", { status: 404, headers: baseHeaders() });
}

export function withBaseHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(baseHeaders())) {
    response.headers.set(key, value);
  }
  return response;
}
