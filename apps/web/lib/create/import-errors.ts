import { NextResponse } from "next/server";
import { GitHubError } from "../github/app";
import { BundleError } from "../miniapps/bundles";
import { PublishError } from "../miniapps/publish";
import { ImportError } from "./import";
import { LintError } from "./lint";
import { VersionError } from "./versions";

/**
 * One response shape for every expected failure on the Import routes. A
 * GitHub-side error becomes a 502 with its status in the text — never the
 * upstream body, which can quote the request (and the token) back.
 */
export function importErrorResponse(error: unknown): NextResponse | null {
  if (
    error instanceof ImportError ||
    error instanceof PublishError ||
    error instanceof BundleError ||
    error instanceof LintError ||
    error instanceof VersionError
  ) {
    return NextResponse.json(
      {
        error: error.message,
        ...(error instanceof LintError ? { findings: error.findings } : {}),
      },
      { status: error.status }
    );
  }
  if (error instanceof GitHubError) {
    const status = error.status === 404 ? 404 : error.status === 401 || error.status === 403 ? 403 : 502;
    return NextResponse.json({ error: error.message }, { status });
  }
  return null;
}
