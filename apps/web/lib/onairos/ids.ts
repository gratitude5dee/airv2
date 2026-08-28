/**
 * How an Onairos link is spelled in the shared `connections` table. Split
 * out of sync.ts so a caller that already holds connection rows can read
 * the step's status from them without pulling in the sync machinery.
 */
export const ONAIROS_PROVIDER = "onairos";
export const ONAIROS_TOOLKIT = "persona";
