# functions/ — @air/functions SDK (placeholder)

Reserved for the `@air/functions` SDK source and types (V11 §11.6): router,
`air.user(req)`, `air.db`, `air.kv`, `air.ai.chat()`, `air.state`, `air.media`.
MC5 (lane E) owns it and publishes it here from `packages/air-functions/` via the
Kit build; until then this directory holds no code and the Build Service resolves no
`@air/functions` specifier. `hono` and `zod`, the two runtime imports a Worker may use
alongside the SDK, are already pinned in `vendor/`.
