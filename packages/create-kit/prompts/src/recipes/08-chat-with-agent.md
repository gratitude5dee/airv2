### Chat with the owner's agent

A thread with the owner's Hermes through Functions → `POST https://air.internal/v1/chat/completions`. Components: `beautiful/chat-composer` (input), `beautiful/stream-text` or `aicss/text-response` (assistant bubbles), `aicss/code-block` for code, `beautiful/tool-chips` when a turn used tools, `libraries/thinking-orbs` while waiting.

```tsx
const { messages, send, pending } = useThread();     // your hook over fetch("/api/chat", { method: "POST", body })
<main className="app">
  <section className="panel thread">
    {messages.map((m) => m.role === "assistant" ? <StreamText key={m.id} text={m.text} /> : <p key={m.id} className="item">{m.text}</p>)}
    {pending && <AirThinkingOrb state="thinking" size={20} />}
  </section>
  <ChatComposer onSubmit={send} disabled={pending} placeholder="Ask…" />
</main>
```

```ts
// functions/index.ts
app.post("/api/chat", async (c) => {
  const { messages } = z.object({ messages: z.array(Msg).max(40) }).parse(await c.req.json());
  const res = await air.ai.chat(c, { model: "fast", messages, stream: true });
  return new Response(res.body, { headers: { "content-type": "text/event-stream" } });
});
```

`model` is one of `fast | balanced | deep`, never a vendor name. The daily cap is the owner's; when the gateway returns 429 the app says "The agent is resting today." Streaming renders progressively; under reduced motion the bubble fills without the caret.
