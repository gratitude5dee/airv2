/**
 * Next.js instrumentation hook — runs once on server boot (R-ARCH-02).
 * Production refuses to come up missing a required secret; dev and test
 * warn but boot. Request-time reads stay lazy via lib/env accessors.
 */
import { validateEnv } from "./lib/env";

export function register(): void {
  validateEnv();
}
