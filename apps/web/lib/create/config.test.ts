import { afterEach, describe, expect, it } from "vitest";
import { createConfig } from "./config";

const KEYS = [
  "CREATE_INTAKE_MAX_QUESTIONS",
  "CREATE_DEV_TTL_DAYS",
  "CREATE_PROGRESS_TICK_MS",
  "CREATE_MIRROR_ENABLED",
  "WZRD_CREATE_INSTALLATION_ID",
];

afterEach(() => {
  for (const key of KEYS) delete process.env[key];
});

describe("createConfig", () => {
  it("falls back to the spec defaults when unset", () => {
    expect(createConfig.intakeMaxQuestions()).toBe(3);
    expect(createConfig.devTtlDays()).toBe(14);
    expect(createConfig.progressTickMs()).toBe(10_000);
    expect(createConfig.mirrorEnabled()).toBe(false);
    expect(createConfig.mirrorInstallationId()).toBeNull();
  });

  it("clamps numbers into their bounds and ignores garbage", () => {
    process.env["CREATE_INTAKE_MAX_QUESTIONS"] = "9";
    process.env["CREATE_PROGRESS_TICK_MS"] = "100";
    process.env["CREATE_DEV_TTL_DAYS"] = "not-a-number";
    expect(createConfig.intakeMaxQuestions()).toBe(5);
    expect(createConfig.progressTickMs()).toBe(2_000);
    expect(createConfig.devTtlDays()).toBe(14);
  });

  it("reads flags and ids only when present", () => {
    process.env["CREATE_MIRROR_ENABLED"] = "TRUE";
    process.env["WZRD_CREATE_INSTALLATION_ID"] = " 12345 ";
    expect(createConfig.mirrorEnabled()).toBe(true);
    expect(createConfig.mirrorInstallationId()).toBe("12345");
  });
});
