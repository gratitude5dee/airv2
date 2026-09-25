import { afterEach, describe, expect, it, vi } from "vitest";
import { createRecordingSpectrumSender } from "./recording";
import { createSpectrumSender } from "./sender";
import { createFastReactionSender } from "./fast-reaction";

interface RecordedEvent {
  kind: string;
  spaceId?: string;
  phone?: string;
  body?: string;
  at?: string;
  [key: string]: unknown;
}

function stubRecorder() {
  const events: RecordedEvent[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      events.push(JSON.parse(String(init?.body)) as RecordedEvent);
      return new Response("ok");
    })
  );
  return events;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("createRecordingSpectrumSender", () => {
  it("posts one event per outbound action, in send order", async () => {
    const events = stubRecorder();
    const sender = createRecordingSpectrumSender("http://127.0.0.1:1/record");

    await sender.startTyping("space-1", "+15551234567");
    await sender.markRead("space-1", "+15551234567", "msg-1");
    await sender.sendText("space-1", "+15551234567", "first bubble");
    await sender.sendReply("space-1", "+15551234567", "msg-1", "threaded");
    await sender.react("space-1", "+15551234567", "msg-1", "👀");
    await sender.sendRichLink("space-1", "+15551234567", "https://example.com");
    await sender.sendAttachment(
      "space-1",
      "+15551234567",
      Buffer.from("bytes"),
      { name: "a.png", mimeType: "image/png" }
    );
    await sender.close();

    expect(events.map((event) => event.kind)).toEqual([
      "typing",
      "markRead",
      "sendText",
      "sendReply",
      "react",
      "sendRichLink",
      "sendAttachment",
    ]);
    expect(events[2]).toMatchObject({
      kind: "sendText",
      spaceId: "space-1",
      phone: "+15551234567",
      body: "first bubble",
    });
    expect(events[6]).toMatchObject({
      kind: "sendAttachment",
      name: "a.png",
      mimeType: "image/png",
      bytes: 5,
    });
    for (const event of events) {
      expect(event.at).toEqual(expect.any(String));
    }
  });

  it("records one event per streamed chunk", async () => {
    const events = stubRecorder();
    const sender = createRecordingSpectrumSender("http://127.0.0.1:1/record");

    async function* stream() {
      yield "hello ";
      yield "world";
    }
    await sender.streamText("space-1", "+15551234567", stream());
    await sender.close();

    expect(events.map((event) => event.kind)).toEqual(["streamText", "streamText"]);
    expect(events[0]).toMatchObject({ chunkIndex: 0, text: "hello " });
    expect(events[1]).toMatchObject({ chunkIndex: 1, text: "world" });
  });

  it("records sendApp/editApp with resolved urls and returns the documented fallbacks", async () => {
    const events = stubRecorder();
    const sender = createRecordingSpectrumSender("http://127.0.0.1:1/record");

    const session = {
      chatGuid: "chat",
      messageGuid: "msg",
      sessionId: "sess",
      targetMessageGuid: "target",
    };
    const sent = await sender.sendApp(
      "space-1",
      "+15551234567",
      async () => "https://signed.example/card",
      { caption: "cap" }
    );
    const edited = await sender.editApp(
      "space-1",
      "+15551234567",
      session,
      () => "https://signed.example/card2"
    );
    const location = await sender.requestLocation(
      "space-1",
      "+15551234567",
      "+15550001111",
      "client-1"
    );
    const shared = await sender.getSharedLocation("+15551234567", "+15550001111");
    const attachment = await sender.getAttachment("att-1", "+15551234567");
    await sender.close();

    expect(sent).toBeUndefined();
    expect(edited).toBeUndefined();
    expect(location).toBeUndefined();
    expect(shared).toBeUndefined();
    expect(attachment).toBeUndefined();
    expect(events.map((event) => event.kind)).toEqual([
      "sendApp",
      "editApp",
      "requestLocation",
    ]);
    expect(events[0]).toMatchObject({ url: "https://signed.example/card" });
    // Reads (getAttachment, getSharedLocation) are not outbound bubbles —
    // they leave no events.
  });

  it("still resolves sends when the listener is down", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connection refused");
      })
    );
    const sender = createRecordingSpectrumSender("http://127.0.0.1:1/record");
    await expect(
      sender.sendText("space-1", "+15551234567", "hi")
    ).resolves.toBeUndefined();
    await sender.close();
  });
});

describe("eval sender seam", () => {
  it("createSpectrumSender returns the recording fake when EVAL_SPECTRUM_RECORD_URL is set", async () => {
    const events = stubRecorder();
    vi.stubEnv("EVAL_SPECTRUM_RECORD_URL", "http://127.0.0.1:1/record");
    delete process.env["SPECTRUM_PROJECT_ID"];
    delete process.env["SPECTRUM_PROJECT_SECRET"];

    const sender = await createSpectrumSender();
    await sender.sendText("space-1", "+15551234567", "hi");
    await sender.close();

    expect(events).toEqual([
      expect.objectContaining({ kind: "sendText", body: "hi" }),
    ]);
  });

  it("createFastReactionSender stays off so reactions flow through the recording sender", async () => {
    vi.stubEnv("EVAL_SPECTRUM_RECORD_URL", "http://127.0.0.1:1/record");
    delete process.env["SPECTRUM_PROJECT_ID"];
    delete process.env["SPECTRUM_PROJECT_SECRET"];

    await expect(
      createFastReactionSender("+15551234567")
    ).resolves.toBeUndefined();
  });
});
