/**
 * Command-lane invariants (berd.goal.md §MA-B3, buzz.goal.md §MA-Z3): sealed
 * args never outlive the claim, envelopes are single-use and short-lived,
 * signatures bind to the per-device key, and completion refuses replays and
 * foreign envelopes.
 */
import { beforeAll, describe, expect, it } from "vitest";
import {
  BERD_LANE,
  BUZZ_LANE,
  claimEnvelopes,
  completeEnvelope,
  enqueueEnvelope,
  laneLink,
  mintEnvelopeKey,
  sealEnvelopeKey,
  signEnvelope,
} from "@/lib/miniapps/commandLane";
import { FakeDb } from "@/lib/miniapps/testing/fakeSupabase";
import { createHash, createHmac } from "node:crypto";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-session-secret";
  delete process.env.COMMAND_LANE_KEY;
});

const USER = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

function makeLink(db: FakeDb, token: string, envelopeKey: string): void {
  db.rows("berd_links").push({
    id: "link-1",
    user_id: USER,
    status: "paired",
    token_hash: createHash("sha256").update(token).digest("hex"),
    envelope_key_sealed: sealEnvelopeKey(envelopeKey),
  });
}

describe("command lane", () => {
  it("claims an envelope once, delivers args, and nulls the ciphertext", async () => {
    const db = new FakeDb();
    const token = "berd_deadbeef";
    const key = mintEnvelopeKey();
    makeLink(db, token, key);
    const supabase = db.client();

    const queued = await enqueueEnvelope(
      supabase,
      BERD_LANE,
      USER,
      "default",
      "agents",
      "create",
      { name: "scout", stdin: "system prompt content" }
    );
    expect(queued.ok).toBe(true);
    expect(db.rows("berd_envelopes")[0]!.args_sealed).toBeTruthy();
    expect(
      String(db.rows("berd_envelopes")[0]!.args_sealed)
    ).not.toContain("system prompt content");

    const link = await laneLink(supabase, BERD_LANE, token, "berd_", "paired");
    expect(link).not.toBeNull();
    const { envelopes } = await claimEnvelopes(supabase, BERD_LANE, link!);
    expect(envelopes).toHaveLength(1);
    expect(envelopes[0]!.args).toEqual({
      name: "scout",
      stdin: "system prompt content",
    });
    expect(envelopes[0]!.singleUse).toBe(true);
    // Ledger keeps names and states only after the claim.
    expect(db.rows("berd_envelopes")[0]!.args_sealed).toBeNull();
    expect(db.rows("berd_envelopes")[0]!.state).toBe("sent");

    // Second poll: nothing left to claim.
    const again = await claimEnvelopes(supabase, BERD_LANE, link!);
    expect(again.envelopes).toHaveLength(0);
  });

  it("signs envelopes with the per-device key over canonical fields", async () => {
    const key = mintEnvelopeKey();
    const fields = {
      id: "env-1",
      group: "agents",
      verb: "create",
      args: { name: "scout" },
      issuedAt: "2026-08-24T10:00:00.000Z",
      expiresAt: "2026-08-24T10:02:00.000Z",
      singleUse: true as const,
    };
    const sig = signEnvelope(key, fields);
    const expected = createHmac("sha256", Buffer.from(key, "hex"))
      .update(
        [
          fields.id,
          fields.group,
          fields.verb,
          fields.issuedAt,
          fields.expiresAt,
          JSON.stringify(fields.args),
        ].join("\n")
      )
      .digest("hex");
    expect(sig).toBe(expected);
    expect(signEnvelope(mintEnvelopeKey(), fields)).not.toBe(sig);
    expect(signEnvelope(key, { ...fields, verb: "delete" })).not.toBe(sig);
  });

  it("fails expired envelopes at claim time and drops their args", async () => {
    const db = new FakeDb();
    const token = "berd_deadbeef";
    makeLink(db, token, mintEnvelopeKey());
    const supabase = db.client();
    await enqueueEnvelope(supabase, BERD_LANE, USER, "default", "info", "refresh", null);
    db.rows("berd_envelopes")[0]!.expires_at = new Date(
      Date.now() - 1000
    ).toISOString();

    const link = await laneLink(supabase, BERD_LANE, token, "berd_", "paired");
    const { envelopes, expiredIds } = await claimEnvelopes(
      supabase,
      BERD_LANE,
      link!
    );
    expect(envelopes).toHaveLength(0);
    expect(expiredIds).toHaveLength(1);
    expect(expiredIds[0]!.resourceId).toBe("default");
    expect(db.rows("berd_envelopes")[0]!.state).toBe("failed");
    expect(db.rows("berd_envelopes")[0]!.args_sealed).toBeNull();
  });

  it("refuses completion replays and foreign envelopes", async () => {
    const db = new FakeDb();
    const token = "buzz_deadbeef";
    const key = mintEnvelopeKey();
    db.rows("buzz_links").push({
      id: "link-1",
      user_id: USER,
      status: "connected",
      token_hash: createHash("sha256").update(token).digest("hex"),
      envelope_key_sealed: sealEnvelopeKey(key),
    });
    const supabase = db.client();
    await enqueueEnvelope(
      supabase,
      BUZZ_LANE,
      USER,
      "default",
      "messages",
      "send",
      { channelId: "c1", stdin: "hi" }
    );
    const link = await laneLink(
      supabase,
      BUZZ_LANE,
      token,
      "buzz_",
      "connected"
    );
    const { envelopes } = await claimEnvelopes(supabase, BUZZ_LANE, link!);
    expect(envelopes).toHaveLength(1);

    const foreign = { ...link!, user_id: OTHER };
    expect(
      await completeEnvelope(
        supabase,
        BUZZ_LANE,
        foreign,
        envelopes[0]!.id,
        true,
        null
      )
    ).toBeNull();

    const done = await completeEnvelope(
      supabase,
      BUZZ_LANE,
      link!,
      envelopes[0]!.id,
      true,
      "sent"
    );
    expect(done?.verb).toBe("send");
    expect(db.rows("buzz_intents")[0]!.state).toBe("done");

    // Replay: the row is no longer 'sent'.
    expect(
      await completeEnvelope(
        supabase,
        BUZZ_LANE,
        link!,
        envelopes[0]!.id,
        false,
        "again"
      )
    ).toBeNull();
  });

  it("bounds in-flight envelopes and argument size", async () => {
    const db = new FakeDb();
    const supabase = db.client();
    for (let i = 0; i < 30; i += 1) {
      const queued = await enqueueEnvelope(
        supabase,
        BERD_LANE,
        USER,
        "default",
        "info",
        "refresh",
        null
      );
      expect(queued.ok).toBe(true);
    }
    const over = await enqueueEnvelope(
      supabase,
      BERD_LANE,
      USER,
      "default",
      "info",
      "refresh",
      null
    );
    expect(over.ok).toBe(false);

    const huge = await enqueueEnvelope(
      supabase,
      BERD_LANE,
      OTHER,
      "default",
      "agents",
      "create",
      { stdin: "x".repeat(20 * 1024) }
    );
    expect(huge.ok).toBe(false);
  });

  it("returns no envelopes for a link without an envelope key", async () => {
    const db = new FakeDb();
    const token = "berd_pre0067";
    db.rows("berd_links").push({
      id: "link-old",
      user_id: USER,
      status: "paired",
      token_hash: createHash("sha256").update(token).digest("hex"),
      envelope_key_sealed: null,
    });
    const supabase = db.client();
    await enqueueEnvelope(supabase, BERD_LANE, USER, "default", "info", "refresh", null);
    const link = await laneLink(supabase, BERD_LANE, token, "berd_", "paired");
    const { envelopes } = await claimEnvelopes(supabase, BERD_LANE, link!);
    expect(envelopes).toHaveLength(0);
  });
});
