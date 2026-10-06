/**
 * Wire a PublishCtx over tool execution (CM3 task 6, R-CONN-01). Adapters
 * see only this context: provider credentials never leave the owning
 * gateway, and resumable step state (container/publish ids) round-trips
 * through the caller's persistence hook so a long publish survives a
 * worker deadline.
 *
 * CONNECTOR_PROVIDER picks the execution lane per call — Composio's
 * tools/execute by user id, or WZRD Connect's /v1/actions with the user's
 * runtime token and `air-<userId>` connection alias. Slugs without a
 * mapped action fail as a 400 (fix-content verdict, never a blind retry).
 */
import { ComposioApiError, executeTool } from "../composio/client";
import { env } from "../env";
import { serviceClient } from "../supabase";
import {
  executeAction,
  WzrdConnectApiError,
} from "../wzrdconnect/client";
import {
  WZRD_ACTION_FOR_SLUG,
  wzrdConnectionAlias,
} from "../wzrdconnect/slugs";
import { ensureWzrdConnectToken } from "../wzrdconnect/tokens";
import { PublishError, type PublishCtx } from "./adapter";

async function executeWzrd(
  toolSlug: string,
  userId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const actionId = WZRD_ACTION_FOR_SLUG[toolSlug];
  if (!actionId) {
    throw new PublishError(
      400,
      `tool ${toolSlug} has no WZRD Connect action`
    );
  }
  const { token } = await ensureWzrdConnectToken(serviceClient(), userId);
  return await executeAction({
    token,
    actionId,
    input: args,
    connectionName: wzrdConnectionAlias(userId),
  });
}

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
        if (env.connectorProvider() === "wzrd") {
          return await executeWzrd(toolSlug, options.userId, args);
        }
        return await executeTool(
          toolSlug,
          options.userId,
          args,
          options.connectedAccountId
        );
      } catch (error) {
        // Surface provider HTTP failures (revoked connection, missing
        // account, throttle) as PublishError so classify() can produce a
        // reauth/fix-content/retry verdict instead of a blind retry.
        if (
          error instanceof ComposioApiError ||
          error instanceof WzrdConnectApiError
        ) {
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
