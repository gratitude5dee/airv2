/** Monotonic client timing. Stop before reconciliation sleeps or ledger reads. */
export class CaseTiming {
  private readonly started: number;
  private firstDelta: number | null = null;
  private ended: number | null = null;
  constructor(private readonly clock: () => number = () => performance.now()) {
    this.started = clock();
  }
  delta(text: string): void {
    if (text && this.firstDelta === null && this.ended === null) {
      this.firstDelta = this.clock();
    }
  }
  stop(): void {
    this.ended ??= this.clock();
  }
  snapshot(): { agent_ms: number; ttft_ms: number | null } {
    if (this.ended === null) throw new Error("case timing has not stopped");
    return {
      agent_ms: Math.max(0, this.ended - this.started),
      ttft_ms: this.firstDelta === null ? null : Math.max(0, this.firstDelta - this.started),
    };
  }
}
