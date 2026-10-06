/**
 * Connector discovery for the active backend (R-CONN-01): the Connect grid
 * in both the settings mini-app and onboarding renders this list. Composio
 * returns its usage-sorted toolkit catalog; WZRD Connect serves the curated
 * airv2 surface (WZRD_CONNECT_TOOLKITS) rather than the worker's full
 * 1500-provider catalog.
 */
import { env } from "../env";
import { listToolkits } from "../composio/client";
import { listProviders } from "../wzrdconnect/client";
import {
  toolkitForWzrdService,
  WZRD_CONNECT_TOOLKITS,
} from "../wzrdconnect/slugs";

export interface ToolkitOption {
  slug: string;
  name: string;
  logo: string | null;
}

export async function connectableToolkits(): Promise<ToolkitOption[]> {
  if (env.connectorProvider() === "wzrd") {
    const providers = await listProviders();
    const byToolkit = new Map(
      providers.map((p) => [toolkitForWzrdService(p.service), p])
    );
    return WZRD_CONNECT_TOOLKITS.filter((slug) =>
      byToolkit.get(slug)?.authTypes?.includes("oauth2")
    ).map((slug) => ({
      slug,
      name: byToolkit.get(slug)?.displayName ?? slug,
      logo: null,
    }));
  }
  const toolkits = await listToolkits();
  return toolkits.map((t) => ({
    slug: t.slug,
    name: t.name,
    logo: t.meta?.logo ?? null,
  }));
}
