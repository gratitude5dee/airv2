/**
 * R-CONN-01: which connector backend new Connect clicks mint rows for,
 * kept in its own leaf so render code never needs the lifecycle module
 * (which test suites mock wholesale).
 */
import { env } from "../env";

export type ConnectorProvider = "composio" | "wzrd_connect";

/** The provider new Connect clicks mint rows for. */
export function connectorProvider(): ConnectorProvider {
  return env.connectorProvider() === "wzrd" ? "wzrd_connect" : "composio";
}

/**
 * The other backend's provider value — mirror queries exclude it with
 * `.neq` rather than matching the active one with `.eq`, so rows written
 * before provider tagging (or seeded without the column) still belong to
 * the active side.
 */
export function excludedConnectorProvider(): ConnectorProvider {
  return connectorProvider() === "wzrd_connect" ? "composio" : "wzrd_connect";
}
