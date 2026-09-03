import { describe, expect, it, vi } from "vitest";
import {
  deliverSendFiles,
  isSendablePath,
  stripSendFileMarkers,
} from "./outbound";
import { command } from "../box/client";
import type { SpectrumSender } from "../spectrum/sender";

vi.mock("../box/client", () => ({
  command: vi.fn(),
}));

async function* chunks(...parts: string[]): AsyncGenerator<string> {
  for (const part of parts) yield part;
}

async function collect(stream: AsyncGenerator<string>): Promise<string> {
  let out = "";
  for await (const chunk of stream) out += chunk;
  return out;
}

describe("stripSendFileMarkers", () => {
  it("removes a whole marker and records the path", async () => {
    const stripped = stripSendFileMarkers(
      chunks("here it is\n[send-file: /home/user/.hermes/outbox/fan.png]\ndone")
    );
    const text = await collect(stripped.deltas);
    expect(text).toBe("here it is\n\ndone");
    expect(stripped.files).toEqual(["/home/user/.hermes/outbox/fan.png"]);
  });

  it("handles a marker split across many deltas", async () => {
    const stripped = stripSendFileMarkers(
      chunks("look [send-fi", "le: /home/user/a", ".png] neat")
    );
    const text = await collect(stripped.deltas);
    expect(text).toBe("look  neat");
    expect(stripped.files).toEqual(["/home/user/a.png"]);
  });

  it("passes ordinary brackets through unchanged", async () => {
    const stripped = stripSendFileMarkers(
      chunks("prices [guest, not Prime] and [attachment:x] stay")
    );
    const text = await collect(stripped.deltas);
    expect(text).toBe("prices [guest, not Prime] and [attachment:x] stay");
    expect(stripped.files).toEqual([]);
  });

  it("flushes a dangling partial marker at end of stream", async () => {
    const stripped = stripSendFileMarkers(chunks("tail [send-file: /home/u"));
    const text = await collect(stripped.deltas);
    expect(text).toBe("tail [send-file: /home/u");
    expect(stripped.files).toEqual([]);
  });

  it("records multiple markers in order", async () => {
    const stripped = stripSendFileMarkers(
      chunks(
        "[send-file: /home/user/1.png][send-file: /home/user/2.jpg]both sent"
      )
    );
    const text = await collect(stripped.deltas);
    expect(text).toBe("both sent");
    expect(stripped.files).toEqual(["/home/user/1.png", "/home/user/2.jpg"]);
  });

  it("strips card markers and records kinds once each, in order", async () => {
    const stripped = stripSendFileMarkers(
      chunks(
        "Let's get you set up.\n[card: onboarding]\nthen your Persona\n[CARD:persona]\n[card: onboarding]"
      )
    );
    const text = await collect(stripped.deltas);
    expect(text).toBe("Let's get you set up.\n\nthen your Persona\n\n");
    expect(stripped.cards).toEqual(["onboarding", "persona"]);
    expect(stripped.files).toEqual([]);
  });

  it("handles a card marker split across deltas without leaking it", async () => {
    const stripped = stripSendFileMarkers(
      chunks("tap the card [ca", "rd: onbo", "arding] above")
    );
    const text = await collect(stripped.deltas);
    expect(text).toBe("tap the card  above");
    expect(stripped.cards).toEqual(["onboarding"]);
  });

  it("leaves card-looking text with spaces or paths alone", async () => {
    const stripped = stripSendFileMarkers(
      chunks("[card: not a kind] and [card:/etc/x] stay")
    );
    const text = await collect(stripped.deltas);
    expect(text).toBe("[card: not a kind] and [card:/etc/x] stay");
    expect(stripped.cards).toEqual([]);
  });
});

describe("isSendablePath", () => {
  it("accepts box-home paths on Linux and macOS", () => {
    expect(isSendablePath("/home/user/.hermes/outbox/a.png")).toBe(true);
    expect(isSendablePath("/Users/air/.hermes/outbox/a.png")).toBe(true);
  });

  it("rejects traversal and out-of-home paths", () => {
    expect(isSendablePath("/etc/passwd")).toBe(false);
    expect(isSendablePath("/home/user/../../etc/shadow")).toBe(false);
    expect(isSendablePath("relative/path.png")).toBe(false);
  });
});

describe("deliverSendFiles", () => {
  it("uses portable commands and single-quotes shell-metacharacter paths", async () => {
    const mocked = vi.mocked(command);
    mocked.mockReset();
    const png = Buffer.from("fake-png-bytes");
    mocked
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: `${png.length}\n`,
        stderr: "",
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: png.toString("base64"),
        stderr: "",
      });
    const sendAttachment = vi.fn().mockResolvedValue(undefined);
    const sender = { sendAttachment } as unknown as SpectrumSender;
    const path = `/home/user/.hermes/outbox/a"$(touch pwned)\`.png`;
    const sent = await deliverSendFiles(sender, "bx_1", "space", "+1", [path]);
    expect(sent).toBe(1);
    const quoted = `'${path}'`;
    expect(mocked).toHaveBeenNthCalledWith(1, "bx_1", `wc -c < ${quoted}`);
    expect(mocked).toHaveBeenNthCalledWith(
      2,
      "bx_1",
      `base64 < ${quoted} | tr -d '\\n'`,
      120
    );
    expect(sendAttachment).toHaveBeenCalledWith("space", "+1", png, {
      name: `a"$(touch pwned)\`.png`,
      mimeType: "image/png",
    });
  });

  it("escapes single quotes inside the path", async () => {
    const mocked = vi.mocked(command);
    mocked.mockReset();
    mocked.mockResolvedValue({ exitCode: 1, stdout: "", stderr: "" });
    const sender = {
      sendAttachment: vi.fn(),
    } as unknown as SpectrumSender;
    const path = "/home/user/it's.png";
    await deliverSendFiles(sender, "bx_1", "space", "+1", [path]);
    expect(mocked).toHaveBeenCalledWith(
      "bx_1",
      `wc -c < '/home/user/it'\\''s.png'`
    );
  });
});
