/**
 * Harness-neutral client for the agent run surface on a user's compute.
 * Every harness (Hermes api_server, exo-agentd) implements the same
 * contract — POST /v1/runs, SSE /v1/runs/{id}/events, /stop, /approval,
 * /health, /api/sessions — behind the same two secrets (hosted-route token +
 * per-box API_SERVER_KEY), so the Hermes implementation is the
 * implementation; only the target differs per box.
 */
export {
  MAIN_SESSION,
  MAIN_SESSION_TITLE,
  HermesApiError as AgentApiError,
  approveRun,
  createRun,
  ensureSession,
  health,
  listSessions,
  loadConversationHistory,
  runEvents,
  sessionMessages,
  stopRun,
  type HermesBoxTarget as AgentTarget,
  type HermesMessage as AgentMessage,
  type HermesSession as AgentSession,
  type RunRequest,
  type RunResponse,
} from "@/lib/hermes/client";
