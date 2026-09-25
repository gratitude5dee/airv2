/**
 * Boot-time hooks (Next.js instrumentation). R-SEC-09: COMMAND_LANE_KEY is
 * required — the at-rest seal key for Berd/Buzz command envelopes must
 * exist before the first request rather than fail mid-claim in production
 * (see R-ARCH-02's env-validation direction; the full zod schema lands
 * there, this one check rides ahead of it).
 */
export async function register(): Promise<void> {
  if (process.env["NEXT_RUNTIME"] !== "nodejs") return;
  const { env } = await import("@/lib/env");
  env.commandLaneKey();
}
