import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
let directory = "";
let corrupt = false;
vi.mock("../box/client", () => ({
  writeFile: vi.fn(async (_box: string, file: string, content: string) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, corrupt ? "truncated" : content);
  }),
  command: vi.fn(async (_box: string, cmd: string) => {
    try {
      return { exitCode: 0, stdout: execFileSync("/bin/sh", ["-c", cmd], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }), stderr: "" };
    } catch {
      return { exitCode: 1, stdout: "", stderr: "commit failed" };
    }
  }),
}));
import { writeArchiveFile } from "./archiveWrite";
beforeEach(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), "air-archive-atomic-")); corrupt = false; });
afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

describe("atomic archive commit on a real filesystem", () => {
  it("commits verified Unicode content with private permissions and shell-safe paths", async () => {
    const destination = path.join(directory, "owner's $(echo unsafe).json");
    await writeArchiveFile("box", destination, '{"text":"🧠"}', async () => undefined);
    expect(fs.readFileSync(destination, "utf8")).toBe('{"text":"🧠"}');
    expect(fs.statSync(destination).mode & 0o777).toBe(0o600);
    expect(fs.readdirSync(directory)).toEqual([path.basename(destination)]);
  });
  it("keeps the old file when staging returns incomplete bytes", async () => {
    const destination = path.join(directory, "archive.json");
    fs.writeFileSync(destination, "original");
    corrupt = true;
    await expect(writeArchiveFile("box", destination, "replacement", async () => undefined)).rejects.toThrow("commit failed");
    expect(fs.readFileSync(destination, "utf8")).toBe("original");
    expect(fs.readdirSync(directory)).toEqual(["archive.json"]);
  });
  it("does not replace the file after the lease is lost during upload", async () => {
    const destination = path.join(directory, "archive.json");
    fs.writeFileSync(destination, "original");
    let renewals = 0;
    await expect(writeArchiveFile("box", destination, "replacement", async () => {
      if (++renewals === 2) throw new Error("lease lost");
    })).rejects.toThrow("lease lost");
    expect(fs.readFileSync(destination, "utf8")).toBe("original");
    expect(fs.readdirSync(directory)).toEqual(["archive.json"]);
  });
});
