import { env } from "../env";

/** The product ships dark until both planes have been configured. */
export function museEnabled(): boolean {
  return env.museEnabled();
}

/** Only this trusted control plane can enqueue a command in the Worker DO. */
export function museInternalToken(): string | null {
  return env.museInternalToken();
}
