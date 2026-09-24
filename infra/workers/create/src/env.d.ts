/**
 * Bindings and vars for `air-create` (mirrors wrangler.jsonc).
 */
interface Env {
  CREATE_JOB: Workflow;
  OWNER_ROOM: DurableObjectNamespace;
  BROWSER: Fetcher | undefined;
  MEDIA: R2Bucket;
  APPS: DispatchNamespace;
  /** Secrets. */
  CREATE_BRIDGE_SECRET?: string;
  CANDIDATE_SECRET: string;
  LIVE_TOKEN_SECRET: string;
  CONTROL_PLANE_ORIGIN: string;
  /** Vars. */
  DEV_ORIGIN_SUFFIX: string;
  MINI_ORIGIN: string;
  MAX_FIX_ROUNDS?: string;
  BRIEF_WAIT_S?: string;
  CODE_WAIT_S?: string;
  FIX_WAIT_S?: string;
}
