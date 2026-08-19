/**
 * Onairos personal-context boundary for onboarding step 4 (goal.md §MA9.2).
 * Session H owns the real implementation (SDK/hosted grant → box-side
 * ~/.hermes/context/onairos.md). Until that lib lands, this stub reports
 * unavailable and the step renders "coming soon" + skippable. Session H
 * replaces `onairosProvider` with the real one behind the same interface.
 */

export interface OnairosStatus {
  /** False until Session H's integration lands — the step renders a stub. */
  available: boolean;
  connected: boolean;
  /** Hosted grant URL when a connect flow exists; never a credential. */
  connect_url: string | null;
}

export interface OnairosProvider {
  status(userId: string): Promise<OnairosStatus>;
}

export const onairosProvider: OnairosProvider = {
  async status(): Promise<OnairosStatus> {
    return { available: false, connected: false, connect_url: null };
  },
};
