/**
 * Wire a PublishCtx over Composio tool execution (CM3 task 6). Adapters see
 * only this context: the OAuth token never leaves Composio, and resumable
 * step state (container/publish ids) round-trips through the caller's
 * persistence hook so a long publish survives a worker deadline.
 */
import { executeTool } from "../composio/client";
import type { PublishCtx } from "./adapter";

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
      return await executeTool(
        toolSlug,
        options.userId,
        args,
        options.connectedAccountId
      );
    },
    async saveState() {
      if (options.persistState) {
        await options.persistState(state);
      }
    },
  };
}
