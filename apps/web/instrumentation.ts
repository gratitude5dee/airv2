/**
 * Next.js instrumentation hook — runs once per server start. Installs the
 * real x402 payment gate over the Session A stub (lib/miniapps/gates.ts).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { installX402Gate } = await import("./lib/payments/x402");
    installX402Gate();
  }
}
