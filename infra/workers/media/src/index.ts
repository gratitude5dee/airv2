import { Container, getContainer } from "@cloudflare/containers";
import { bearerMatches, instanceName } from "./auth";

export interface Env {
  MEDIA: DurableObjectNamespace<MediaContainer>;
  MEDIA_SERVICE_TOKEN?: string;
  MEDIA_INSTANCES?: string;
}

export class MediaContainer extends Container<Env> {
  override defaultPort = 8080;
  override sleepAfter = "5m";
}

const json = (body: unknown, status: number): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/healthz") return json({ ok: true }, 200);
    if (!pathname.startsWith("/v1/")) return json({ error: "not found" }, 404);
    if (!(await bearerMatches(request.headers.get("authorization"), env.MEDIA_SERVICE_TOKEN))) {
      return json({ error: "unauthorized" }, 401);
    }
    const forwarded = new Request(request);
    forwarded.headers.delete("authorization");
    return await getContainer(env.MEDIA, instanceName(env.MEDIA_INSTANCES)).fetch(forwarded);
  },
} satisfies ExportedHandler<Env>;
