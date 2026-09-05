# functions/ — @air/functions SDK (vendored)

`index.ts` is the `@air/functions` SDK the Build Service resolves for a Worker
module (V11 §11.6): router, `air.user(req)`, `air.db`, `air.kv`, `air.ai.chat()`,
`air.state`, `air.actions`, `air.media`. It is a byte-for-byte copy of
`packages/air-functions/src/index.ts`; `apps/web/lib/functions/sdk.test.ts` pins
the two. `hono` and `zod`, the two other imports a Worker may use, are pinned in
`vendor/`.
