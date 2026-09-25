// vitest alias for the `cloudflare:workers` runtime specifier — enough of
// the DurableObject base for TokenReplay to receive its ctx.
export class DurableObject {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }
}
