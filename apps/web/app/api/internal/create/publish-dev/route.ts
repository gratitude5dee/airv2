/**
 * V13 §9.1 `POST /api/internal/create/publish-dev` — the job's publish
 * step. `{job_id, version}` promotes the built version to the dev channel
 * with the CR22 gate off (the check step already gated, D5) and the CF3
 * dev-origin URL. Mirrors `dev_url` back on the job row and the `dev_live`
 * intake event, and returns the URL the OwnerRoom broadcasts.
 */
import type { NextRequest } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { adapterErrorResponse, adapterJob, AdapterError } from "@/lib/create/adapter";
import { applyJobFact, devLinkUrl } from "@/lib/create/job";
import { advanceIntake, IntakeError } from "@/lib/create/intake";
import { getRegistryAppById } from "@/lib/miniapps/registry";
import { promoteToDev, ReleaseError } from "@/lib/create/release";

export const maxDuration = 300;

const VERSION_RE = /^v[0-9]{10,16}$/;

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const supabase = serviceClient();
    const { job, body } = await adapterJob<{ job_id?: unknown; version?: unknown }>(
      supabase,
      request
    );
    if (typeof body.version !== "string" || !VERSION_RE.test(body.version)) {
      throw new AdapterError("invalid version", 400);
    }
    const app = await getRegistryAppById(supabase, job.app_id).catch(() => null);
    if (!app || !app.owner_user_id) throw new AdapterError("app not found", 404);

    let release;
    try {
      release = await promoteToDev(supabase, app, body.version, new Date(), {
        gate: false,
        url: devLinkUrl(app.slug),
      });
    } catch (error) {
      if (error instanceof ReleaseError) {
        throw new AdapterError(error.message, error.status);
      }
      throw error;
    }

    await applyJobFact(supabase, job.id, {
      version: body.version,
      dev_url: release.url,
    });
    if (app.appname) {
      try {
        await advanceIntake(supabase, job.user_id, app.appname, "dev_live", {
          app_id: job.app_id,
        });
      } catch (error) {
        if (!(error instanceof IntakeError)) throw error;
      }
    }

    return Response.json({ dev_url: release.url, version: body.version });
  } catch (error) {
    const mapped = adapterErrorResponse(error);
    if (mapped) return mapped;
    throw error;
  }
}
