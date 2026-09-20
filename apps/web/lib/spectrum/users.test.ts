import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../env", () => ({
  env: {
    spectrumApiBase: () => "https://spectrum.example",
    spectrumProjectId: () => "project-1",
    spectrumProjectSecret: () => "project-secret",
  },
}));

import {
  createOrUpdateSpectrumSharedUser,
  SpectrumUserProvisionError,
} from "./users";

describe("Spectrum project users", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("idempotently provisions a shared user and returns their own number", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        succeed: true,
        data: {
          id: "spectrum-user-1",
          type: "shared",
          phoneNumber: "+14155550142",
          assignedPhoneNumber: "+14155550999",
        },
      }), { status: 200, headers: { "content-type": "application/json" } }),
    );

    await expect(
      createOrUpdateSpectrumSharedUser("+14155550142"),
    ).resolves.toEqual({
      id: "spectrum-user-1",
      type: "shared",
      phoneNumber: "+14155550142",
      assignedPhoneNumber: "+14155550999",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://spectrum.example/projects/project-1/users/",
      expect.objectContaining({ method: "POST", cache: "no-store" }),
    );
    const request = fetchMock.mock.calls[0]?.[1];
    expect(request?.headers).toEqual(expect.objectContaining({
      authorization: expect.stringMatching(/^Basic /),
      "content-type": "application/json",
    }));
    expect(JSON.parse(String(request?.body))).toEqual({
      type: "shared",
      phoneNumber: "+14155550142",
    });
  });

  it("reports exhausted shared-project capacity without leaking provider data", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ detail: "provider detail" }), { status: 422 }),
    );

    const error = await createOrUpdateSpectrumSharedUser("+14155550142")
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(SpectrumUserProvisionError);
    expect(error).toMatchObject({ kind: "capacity", status: 422 });
    expect(String(error)).not.toContain("provider detail");
  });

  it("rejects a success response without a distinct assigned number", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({
        succeed: true,
        data: { id: "spectrum-user-1", type: "shared", phoneNumber: "+14155550142" },
      }), { status: 200 }),
    );

    await expect(
      createOrUpdateSpectrumSharedUser("+14155550142"),
    ).rejects.toMatchObject({ kind: "invalid_response" });
  });
});
