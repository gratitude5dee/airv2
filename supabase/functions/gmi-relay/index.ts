// Relay for the GMI request queue: airv2-app runs on Cloudflare workerd and
// console.gmicloud.ai's Cloudflare edge refuses worker egress, so submits
// travel through Deno egress instead.
// Auth: caller sends x-relay-token (GMI_RELAY_KEY). The GMI bearer +
// X-Organization-ID headers pass through verbatim; the key lives only in
// the caller, never stored here.

const UPSTREAM = Deno.env.get("GMI_UPSTREAM") ?? "https://console.gmicloud.ai";
const DEFAULT_PATH = "/api/v1/ie/requestqueue/apikey/requests";

const RELAY_KEY = Deno.env.get("GMI_RELAY_KEY");

Deno.serve(async (req) => {
  if (!RELAY_KEY || req.headers.get("x-relay-token") !== RELAY_KEY) {
    return new Response("forbidden", { status: 403 });
  }
  // URL tail after /gmi-relay → appended to the upstream base (poll path).
  const tail = new URL(req.url).pathname.replace(/^.*\/gmi-relay/, "");
  const target = `${UPSTREAM}${tail || DEFAULT_PATH}`;
  const headers = new Headers();
  for (const h of ["authorization", "x-organization-id", "content-type"]) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }
  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: ["POST", "PUT", "PATCH"].includes(req.method)
        ? req.body
        : undefined,
      redirect: "manual",
    });
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: `relay: ${e}` }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
});
