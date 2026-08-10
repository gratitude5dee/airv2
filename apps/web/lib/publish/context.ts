/**
 * Wire a PublishCtx over Composio tool execution (CM3 task 6). Adapters see
 * only this context: the OAuth token never leaves Composio, and resumable
 * step state (container/publish ids) round-trips through the caller's
 * persistence hook so a long publish survives a worker deadline.
 */
import { ComposioApiError, executeTool } from "../composio/client";
import { PublishError, type PublishCtx } from "./adapter";

export function makePublishCtx(options: {
  userId: string;
  accountRef: string;
  connectedAccountId?: string;
  state?: Record<string, string>;
  persistState?: (state: Record<string, string>) => Promise<void>;
}): PublishCtx {
  const state = options.state ?? {};
  return {
    userId: options.userId,
    accountRef: options.accountRef,
    state,
    async execute(toolSlug, args) {
      try {
        return await executeTool(
          toolSlug,
          options.userId,
          args,
          options.connectedAccountId
        );
      } catch (error) {
        // Surface Composio HTTP failures (revoked connection, missing
        // account, throttle) as PublishError so classify() can produce a
        // reauth/fix-content/retry verdict instead of a blind retry.
        if (error instanceof ComposioApiError) {
          throw new PublishError(error.status, error.message);
        }
        throw error;
      }
    },
    async saveState() {
      if (options.persistState) {
        await options.persistState(state);
      }
    },
  };
}
