import { describe, expect, it } from "vitest";
import { isSendablePath, stripSendFileMarkers } from "./outbound";

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
