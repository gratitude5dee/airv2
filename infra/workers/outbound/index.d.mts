/** Types for the Outbound Worker module, used by the control plane's tests. */
export interface OutboundParams {
  app?: string;
  owner_ref?: string;
  principal?: string;
  role?: string;
  version?: string;
  egress?: string[];
  budget_usd?: number;
  token_ref?: string | null;
}

export interface OutboundEnv {
  CONTROL_PLANE_ORIGIN?: string;
  RUNTIME_TOKENS?: { get(key: string): Promise<string | null> };
  params?: OutboundParams;
}

export function egressAllowed(params: OutboundParams | undefined, host: string): boolean;

declare const worker: {
  fetch(request: Request, env: OutboundEnv): Promise<Response>;
};
export default worker;
