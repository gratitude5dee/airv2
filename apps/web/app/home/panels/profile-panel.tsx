"use client";

/**
 * Settings → Profile: the account card (line, email, contact card, wallet
 * link, username). Plugin Sign-In sits beside it in the §7 settings assembly
 * (settings-screen.tsx).
 */
import { useEffect, useState } from "react";
import { DitherAvatar } from "@/components/dither-kit/avatar";
import { DitherButton } from "@/components/dither-kit/button";

interface Me {
  user: { id: string; username: string | null; wallet_address: string | null };
  entitlement: {
    plan: string;
    speed_tier: string;
    tier_models?: { fast: string; balanced: string; deep: string };
    monthly_cap_usd: number;
    spend_mtd_usd: number;
  } | null;
  lines: { phone: string; platform: string }[];
  addresses: { address: string; is_primary: boolean }[];
}

export function ProfilePanel({
  active,
  me,
  onOpenWallet,
}: {
  active: boolean;
  me: Me | null;
  onOpenWallet: () => void;
}) {
  const [username, setUsername] = useState(me?.user.username ?? "");
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (me?.user.username) setUsername(me.user.username);
  }, [me]);

  async function saveUsername() {
    setNote(null);
    const res = await fetch("/api/settings/username", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      eligible?: string | null;
    };
    if (res.ok) setNote("Username saved.");
    else if (data.error === "cooldown")
      setNote(`You can change it again on ${data.eligible ?? "a later date"}.`);
    else if (data.error === "taken") setNote("That username is taken.");
    else setNote("Invalid username.");
  }

  if (!active) return null;

  return (
    <div className="grid content-start gap-3">
      <h3 className="chrome m-0 !text-[12px]">Profile</h3>
      <div className="panel !p-3">
        <div className="mb-2 flex items-center gap-3">
          {me?.user.username ? (
            <div className="tilebox h-9 w-9 overflow-hidden !rounded-[8px]">
              <DitherAvatar name={me.user.username} size={36} />
            </div>
          ) : null}
          <h4 className="m-0 text-[14px] font-semibold">Account</h4>
        </div>
        <p className="muted my-1 text-[12px]">
          {me?.lines[0] ? `iMessage line: ${me.lines[0].phone}` : "No line yet"}
        </p>
        <p className="muted my-1 text-[12px]">
          {me?.addresses?.[0]
            ? `Email: ${me.addresses[0].address}`
            : "Email: set a username to create one"}
        </p>
        {me?.user.username ? (
          <p className="muted my-1 text-[12px]">
            Contact card:{" "}
            <a href={`/@${me.user.username}`}>/@{me.user.username}</a>
          </p>
        ) : null}
        <p className="muted my-1 text-[12px]">
          {me?.user.wallet_address ? (
            <button
              type="button"
              className="cursor-pointer border-0 bg-transparent p-0 underline decoration-dotted underline-offset-2"
              onClick={onOpenWallet}
            >
              Wallet: {me.user.wallet_address.slice(0, 6)}…
              {me.user.wallet_address.slice(-4)}
            </button>
          ) : (
            "Wallet: not set up"
          )}
        </p>
        <div className="mt-2 flex gap-2">
          <input
            className="input"
            placeholder="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <DitherButton color="blue" onClick={() => void saveUsername()}>
            Save
          </DitherButton>
        </div>
        {note ? <p className="muted mb-0 mt-2 text-[12px]">{note}</p> : null}
      </div>
    </div>
  );
}
