/**
 * Augments the `onairos` package types with `initializeApiKey`, which the
 * runtime bundle exports but the shipped onairos.d.ts omits in 8.6.x. The
 * signature matches the vendor's own declaration in later releases.
 */
declare module "onairos" {
  export function initializeApiKey(config: {
    apiKey: string;
    environment?: string;
    enableLogging?: boolean;
    googleClientIds?: {
      webClientId?: string;
      iosClientId?: string;
      androidClientId?: string;
      serverClientId?: string;
    };
  }): Promise<unknown>;
}
