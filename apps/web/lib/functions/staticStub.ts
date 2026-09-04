/**
 * The static stub Worker source, embedded so deploy.ts can upload it without
 * a filesystem read at request time. Canonical copy:
 * infra/workers/static-stub/index.mjs — kept identical by staticStub.test.ts.
 */
export const STATIC_STUB_MODULE = "// Air static stub (V11 §11.6): the main_module every Drop app deploys with.\n// Serves the bundle through the ASSETS binding and nothing else — no\n// Functions, no bindings beyond ASSETS, no egress. Uploaded by\n// lib/functions/deploy.ts; the string there must match this file byte for\n// byte (lib/functions/staticStub.test.ts).\nexport default {\n  async fetch(request, env) {\n    const url = new URL(request.url);\n    if (url.pathname === \"/api\" || url.pathname.startsWith(\"/api/\")) {\n      return new Response(JSON.stringify({ error: \"no_functions\" }), {\n        status: 404,\n        headers: { \"content-type\": \"application/json\", \"cache-control\": \"no-store\" },\n      });\n    }\n    if (request.method !== \"GET\" && request.method !== \"HEAD\") {\n      return new Response(\"method not allowed\", { status: 405 });\n    }\n    return env.ASSETS.fetch(request);\n  },\n};\n";

export const STATIC_STUB_MAIN = "index.mjs";
