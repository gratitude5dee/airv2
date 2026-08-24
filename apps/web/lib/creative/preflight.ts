/**
 * Read-only provider preflight ported from outsideairworker
 * src/provider-preflight.ts (goal.md M16 task 7): Groq + GMI model lists
 * reachable, exact model access, and each pinned GMI payload schema — without
 * creating a media job. When the creative keys are not configured, the check
 * reports `skipped` instead of failing the health run. Never logs secrets or
 * upstream response bodies.
 */
import { env } from "../env";

const GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models";
const REQUEST_TIMEOUT_MS = 8_000;

export const REQUIRED_GROQ_MODELS = [
  "openai/gpt-oss-20b",
  "qwen/qwen3.6-27b",
] as const;

export const REQUIRED_GMI_MODELS = [
  "gpt-image-2-generate",
  "gpt-image-2-edit",
  "seedance-2-0-fast-260128",
  "gemini-omni-flash-preview",
  "heygen-avatar-v4",
] as const;

/**
 * Every field the lane may send to each selected GMI model. The queue exposes
 * these schemas read-only, letting the health cron catch a contract rename
 * before a media request becomes a paid failure.
 */
export const REQUIRED_GMI_MODEL_PARAMETERS = {
  "gemini-omni-flash-preview": [
    "prompt",
    "reference_image",
    "video",
    "durationSeconds",
    "aspectRatio",
    "resolution",
  ],
  "gpt-image-2-edit": ["prompt", "image", "size", "quality"],
  "gpt-image-2-generate": ["prompt", "size", "quality", "output_format", "n"],
  "seedance-2-0-fast-260128": [
    "prompt",
    "first_frame",
    "duration",
    "resolution",
    "ratio",
    "generate_audio",
    "watermark",
  ],
  "heygen-avatar-v4": ["video_inputs", "dimension", "duration"],
} as const satisfies Record<
  (typeof REQUIRED_GMI_MODELS)[number],
  readonly string[]
>;

type Fetcher = (input: string, init: RequestInit) => Promise<Response>;

export class ProviderPreflightError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderPreflightError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const fetchProviderJson = async (
  provider: "GMI" | "Groq",
  url: string,
  headers: HeadersInit,
  fetcher: Fetcher,
  resource = "model list"
): Promise<unknown> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetcher(url, {
      cache: "no-store",
      headers,
      method: "GET",
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) {
      // Status distinguishes invalid credentials from missing model access.
      // Never read the upstream body here: it may contain account information
      // and must not reach logs.
      const reason =
        response.status === 401 || response.status === 403
          ? "authentication failed while requesting"
          : "rejected the";
      throw new ProviderPreflightError(
        `${provider} ${reason} ${resource} (${response.status})`
      );
    }
    try {
      return await response.json();
    } catch {
      throw new ProviderPreflightError(
        `${provider} returned invalid ${resource} data`
      );
    }
  } catch (error) {
    if (error instanceof ProviderPreflightError) {
      throw error;
    }
    throw new ProviderPreflightError(
      controller.signal.aborted
        ? `${provider} ${resource} timed out`
        : `${provider} ${resource} could not be reached`
    );
  } finally {
    clearTimeout(timeout);
  }
};

const requireModels = (
  provider: "GMI" | "Groq",
  available: ReadonlySet<string>,
  required: readonly string[]
): void => {
  const missing = required.filter((model) => !available.has(model));
  if (missing.length > 0) {
    throw new ProviderPreflightError(
      `${provider} account lacks required model access: ${missing.join(", ")}`
    );
  }
};

const groqModelIds = (payload: unknown): ReadonlySet<string> => {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    throw new ProviderPreflightError("Groq returned an invalid model list");
  }
  const ids: string[] = [];
  for (const item of payload.data) {
    if (!isRecord(item) || typeof item.id !== "string") {
      throw new ProviderPreflightError("Groq returned an invalid model list");
    }
    ids.push(item.id);
  }
  return new Set(ids);
};

const gmiModelIds = (payload: unknown): ReadonlySet<string> => {
  if (!isRecord(payload) || !Array.isArray(payload.model_ids)) {
    throw new ProviderPreflightError("GMI returned an invalid model list");
  }
  const ids: string[] = [];
  for (const id of payload.model_ids) {
    if (typeof id !== "string") {
      throw new ProviderPreflightError("GMI returned an invalid model list");
    }
    ids.push(id);
  }
  return new Set(ids);
};

const gmiParameterNames = (
  model: string,
  payload: unknown
): ReadonlySet<string> => {
  if (!isRecord(payload) || !Array.isArray(payload.parameters)) {
    throw new ProviderPreflightError(`GMI returned invalid details for ${model}`);
  }
  const names: string[] = [];
  for (const parameter of payload.parameters) {
    if (!isRecord(parameter) || typeof parameter.name !== "string") {
      throw new ProviderPreflightError(
        `GMI returned invalid details for ${model}`
      );
    }
    names.push(parameter.name);
  }
  return new Set(names);
};

const requireModelParameters = (
  model: string,
  available: ReadonlySet<string>,
  required: readonly string[]
): void => {
  const missing = required.filter((parameter) => !available.has(parameter));
  if (missing.length > 0) {
    throw new ProviderPreflightError(
      `GMI model ${model} lacks required parameters: ${missing.join(", ")}`
    );
  }
};

/** Checks credentials, exact model access, and each pinned GMI payload schema. */
export async function verifyProviderModels(
  fetcher: Fetcher = (input, init) => fetch(input, init)
): Promise<void> {
  const groqApiKey = env.groqApiKey();
  const gmiApiKey = env.gmiCloudApiKey();
  if (!groqApiKey || !gmiApiKey) {
    throw new ProviderPreflightError("creative provider keys are missing");
  }
  const gmiModelsUrl = `${env.gmiRequestQueueUrl().replace(/\/requests$/, "")}/models`;
  const organizationId = env.gmiOrganizationId();
  const gmiHeaders = {
    Accept: "application/json",
    Authorization: `Bearer ${gmiApiKey}`,
    ...(organizationId ? { "X-Organization-ID": organizationId } : {}),
  };
  const [groqPayload, gmiPayload] = await Promise.all([
    fetchProviderJson(
      "Groq",
      GROQ_MODELS_URL,
      { Accept: "application/json", Authorization: `Bearer ${groqApiKey}` },
      fetcher
    ),
    fetchProviderJson("GMI", gmiModelsUrl, gmiHeaders, fetcher),
  ]);

  requireModels("Groq", groqModelIds(groqPayload), REQUIRED_GROQ_MODELS);
  requireModels("GMI", gmiModelIds(gmiPayload), REQUIRED_GMI_MODELS);

  const details = await Promise.all(
    REQUIRED_GMI_MODELS.map(async (model) => ({
      model,
      payload: await fetchProviderJson(
        "GMI",
        `${gmiModelsUrl}/${encodeURIComponent(model)}`,
        gmiHeaders,
        fetcher,
        "model-details"
      ),
    }))
  );
  for (const { model, payload } of details) {
    requireModelParameters(
      model,
      gmiParameterNames(model, payload),
      REQUIRED_GMI_MODEL_PARAMETERS[model]
    );
  }
}

export interface CreativePreflightResult {
  status: "ok" | "skipped" | "error";
  detail: string | null;
}

/**
 * Health-cron entrypoint: degrades to `skipped` while the creative provider
 * keys are not provisioned instead of failing the whole health run.
 */
export async function creativePreflight(): Promise<CreativePreflightResult> {
  if (!env.groqApiKey() || !env.gmiCloudApiKey()) {
    return { status: "skipped", detail: "creative provider keys not configured" };
  }
  try {
    await verifyProviderModels();
    return { status: "ok", detail: null };
  } catch (error) {
    return {
      status: "error",
      detail:
        error instanceof ProviderPreflightError
          ? error.message
          : "creative preflight failed",
    };
  }
}
