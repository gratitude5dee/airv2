/**
 * Air × Muse's public contract. This file deliberately contains only opaque
 * identifiers and bounded metadata; command and notification text never
 * belongs in Postgres or this control-plane contract.
 */
export const MUSE_SCOPES = [
  "profile",
  "updates:write",
  "control",
  "agent:run",
  "mail:read",
  "mail:draft",
  "files:read",
  "files:write",
  "calendar:write",
  "schedule:write",
  "wallet:read",
  "wallet:request",
] as const;

export type MuseScope = (typeof MUSE_SCOPES)[number];

export const MUSE_SCOPE_COPY: Readonly<Record<MuseScope, string>> = {
  profile: "See that this Air is yours and whether it is awake",
  "updates:write": "Text you updates on your Air line within limits you set",
  control: "Receive the instructions you text with /muse and reply to them",
  "agent:run": "Ask your Air agent to work under your Air plan and policy",
  "mail:read": "Read your Air inbox",
  "mail:draft": "Write email drafts without sending them",
  "files:read": "See files in your Air inbox folder",
  "files:write": "Drop files into your Air inbox folder",
  "calendar:write": "Create calendar changes in your Air account",
  "schedule:write": "Create recurring Air tasks",
  "wallet:read": "See your wallet balances",
  "wallet:request": "Send from your Air wallet",
};

const scopeSet = new Set<string>(MUSE_SCOPES);

export function isMuseScope(value: string): value is MuseScope {
  return scopeSet.has(value);
}

/** Keep a stable order for consent, OAuth grants, and minted keys. */
export function normalizeMuseScopes(values: readonly string[]): MuseScope[] {
  const wanted = new Set(values.filter(isMuseScope));
  return MUSE_SCOPES.filter((scope) => wanted.has(scope));
}

export type MuseModeDefault = "off" | "30m" | "until_off";

export interface MuseSettings {
  updates_enabled: boolean;
  quiet_hours: { start: string; end: string };
  daily_cap: number;
  mode_default: MuseModeDefault;
  wake_email: boolean;
}

export type MuseSettingsPatch = {
  [Key in keyof MuseSettings]?: MuseSettings[Key] | undefined;
};

export const DEFAULT_MUSE_SETTINGS: MuseSettings = {
  updates_enabled: true,
  quiet_hours: { start: "22:00", end: "07:00" },
  daily_cap: 30,
  mode_default: "off",
  wake_email: false,
};

export interface MuseGrantInput {
  userId: string;
  clientId: string;
  clientName: string | null;
  scopes: MuseScope[];
}
