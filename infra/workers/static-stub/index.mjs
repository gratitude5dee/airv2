// Air static stub (V11 §11.6): the main_module every Drop app deploys with.
// Serves the bundle through the ASSETS binding and nothing else — no
// Functions, no bindings beyond ASSETS, no egress. Uploaded by
// lib/functions/deploy.ts; the string there must match this file byte for
// byte (lib/functions/staticStub.test.ts).
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ error: "no_functions" }), {
        status: 404,
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("method not allowed", { status: 405 });
    }
    return env.ASSETS.fetch(request);
  },
};
