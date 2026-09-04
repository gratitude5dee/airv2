/**
 * Stand-in for arlan.me's site-level view-transition bus: Kit apps have no
 * cross-page transitions, so the card is never "in transition".
 */
export function onTransitionChange(_cb: (active: boolean) => void): () => void {
  return () => {};
}
