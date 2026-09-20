/**
 * Photon Spectrum project-user provisioning.
 *
 * Air's Pro project uses Spectrum's shared delivery pool, but every project
 * user still receives a distinct `assignedPhoneNumber` (the "Texts on"
 * number shown in Photon). Creating the same phone twice is idempotent, which
 * makes this safe to call after every verified Muse sign-in.
 */
import { env } from "../env";

export interface SpectrumProjectUser {
  id: string;
  type: "shared";
  phoneNumber: string;
  assignedPhoneNumber: string;
}

type SpectrumEnvelope = {
  succeed?: unknown;
  data?: {
    id?: unknown;
    type?: unknown;
    phoneNumber?: unknown;
    assignedPhoneNumber?: unknown;
  };
};

export class SpectrumUserProvisionError extends Error {
  constructor(
    readonly kind: "capacity" | "unauthorized" | "unavailable" | "invalid_response",
    readonly status?: number,
    cause?: unknown,
  ) {
    super(`spectrum_user_${kind}`, { cause });
    this.name = "SpectrumUserProvisionError";
  }
}

function validE164(value: unknown): value is string {
  return typeof value === "string" && /^\+[1-9]\d{7,14}$/.test(value);
}

/** Create or return the shared Spectrum user bound to this verified phone. */
export async function createOrUpdateSpectrumSharedUser(
  phoneNumber: string,
): Promise<SpectrumProjectUser> {
  const projectId = env.spectrumProjectId();
  const credential = Buffer.from(
    `${projectId}:${env.spectrumProjectSecret()}`,
    "utf8",
  ).toString("base64");

  let response: Response;
  try {
    response = await fetch(
      `${env.spectrumApiBase()}/projects/${encodeURIComponent(projectId)}/users/`,
      {
        method: "POST",
        headers: {
          authorization: `Basic ${credential}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ type: "shared", phoneNumber }),
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      },
    );
  } catch (error) {
    throw new SpectrumUserProvisionError("unavailable", undefined, error);
  }

  if (!response.ok) {
    // A verified, canonical US number makes validation errors unexpected.
    // Spectrum uses conflict/validation responses when a shared-project seat
    // cannot be allocated; keep that distinct so the consent page can explain
    // Pro capacity without exposing provider details.
    if (response.status === 409 || response.status === 422) {
      throw new SpectrumUserProvisionError("capacity", response.status);
    }
    if (response.status === 401 || response.status === 403) {
      throw new SpectrumUserProvisionError("unauthorized", response.status);
    }
    throw new SpectrumUserProvisionError("unavailable", response.status);
  }

  const envelope = await response.json().catch(() => null) as SpectrumEnvelope | null;
  const user = envelope?.data;
  if (
    envelope?.succeed !== true ||
    typeof user?.id !== "string" ||
    user.type !== "shared" ||
    user.phoneNumber !== phoneNumber ||
    !validE164(user.assignedPhoneNumber)
  ) {
    throw new SpectrumUserProvisionError("invalid_response", response.status);
  }

  return {
    id: user.id,
    type: "shared",
    phoneNumber,
    assignedPhoneNumber: user.assignedPhoneNumber,
  };
}
