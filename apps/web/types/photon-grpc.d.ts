/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Ambient types for the webpack-aliased chunks inside
 * @photon-ai/advanced-imessage/dist (see next.config.ts). The runtime chunks
 * have no published .d.ts — the mappers/coders are driven structurally.
 */
declare module "photon-grpc-shared" {
  const mod: Record<string, any>;
  export = mod;
}

declare module "photon-grpc-codecs" {
  const mod: Record<string, any>;
  export = mod;
}
