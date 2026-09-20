/**
 * Dev-only: render every onboarding slide to static HTML for visual review.
 *   npx tsx scripts/preview-onboarding.ts <outDir> [themeId] [state]
 * `state` is `empty` (fresh account) or `built` (a finished digital twin,
 * the default) — the booth slide and the Get started summary differ most.
 * Not imported by the app.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import {
  renderOnboarding,
  SLIDE_GROUPS,
  type OnboardingSnapshot,
} from "../lib/miniapps/apps/onboarding";
import {
  defaultOnboardingState,
  isOnboardingStep,
} from "../lib/miniapps/onboarding";
import type { IdentityMediaView } from "../lib/identity/assets";
import type { TwinConsent } from "../lib/identity/consent";
import type { DigitalTwin } from "../lib/identity/twinRow";
import { isThemeId, theme, DEFAULT_THEME } from "../lib/miniapps/themes";

const [
  outDir = "/tmp/onboarding-preview",
  themeArg = DEFAULT_THEME,
  stateArg = "built",
] = process.argv.slice(2);
const current = theme(isThemeId(themeArg) ? themeArg : DEFAULT_THEME);
const built = stateArg !== "empty";

/** A flat placeholder swatch — previews never need real photos. */
const swatch = (label: string, hue: number): string =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 240'><rect width='240' height='240' fill='hsl(${hue} 40% 42%)'/><circle cx='120' cy='96' r='46' fill='hsl(${hue} 45% 78%)'/><rect x='52' y='150' width='136' height='70' rx='34' fill='hsl(${hue} 45% 78%)'/><text x='120' y='230' font-family='sans-serif' font-size='16' text-anchor='middle' fill='white'>${label}</text></svg>`
  )}`;

const view = (
  assetId: string,
  role: IdentityMediaView["role"],
  hue: number,
  source: IdentityMediaView["source"] = "upload",
  kind: IdentityMediaView["kind"] = "image"
): IdentityMediaView => ({
  assetId,
  role,
  kind,
  url: kind === "image" ? swatch(role.replace(/_/g, " "), hue) : "about:blank",
  position: 0,
  source,
  status: "ready",
  label: null,
  createdAt: "2026-09-01T10:00:00Z",
});

const identityMedia: IdentityMediaView[] = built
  ? [
      view("a-profile", "profile_image", 210, "generated"),
      view("a-sheet", "character_sheet", 150, "generated"),
      view("a-selfie-1", "selfie", 20, "booth"),
      view("a-selfie-2", "selfie", 40, "booth"),
      view("a-selfie-3", "selfie", 60),
      view("a-alt", "alt_image", 280, "generated"),
      view("a-video", "reference_video", 0, "upload", "video"),
      view("a-voice-1", "voice_sample", 0, "booth", "audio"),
      view("a-voice-2", "voice_sample", 0, "upload", "audio"),
    ]
  : [];

const consent = (scope: TwinConsent["scope"]): TwinConsent => ({
  id: `c-${scope}`,
  user_id: "user-preview",
  scope,
  policy_version: "2026-09-twin-v1",
  surface: "onboarding",
  evidence_asset_id: null,
  granted_at: "2026-09-01T09:58:00Z",
  revoked_at: null,
});

const twin: DigitalTwin | null = built
  ? {
      id: "twin-1",
      user_id: "user-preview",
      provider: "heygen",
      provider_twin_id: null,
      provider_avatar_id: null,
      provider_group_id: null,
      provider_voice_id: null,
      consent_video_key: null,
      video_asset_id: null,
      status: "avatar_only",
      created_at: "2026-09-01T10:00:00Z",
      updated_at: "2026-09-01T10:20:00Z",
      likeness_consent_id: "c-likeness",
      voice_provider: "elevenlabs",
      voice_id: "voice_preview",
      voice_status: "ready",
      voice_error: null,
      voice_consent_id: "c-voice",
      voice_source_asset_ids: ["a-voice-1", "a-voice-2"],
      voice_idempotency_key: "k",
      voice_created_at: "2026-09-01T10:10:00Z",
      voice_deleted_at: null,
      avatar_provider: "fal",
      avatar_status: "ready",
      avatar_config: { model: "minimax/h3-max/lip-sync/image-to-video", resolution: "768P" },
      avatar_preview_asset_id: "a-preview",
      avatar_error: null,
      avatar_consent_id: "c-video_avatar",
      sharing: "private",
    }
  : null;

const snapshot: OnboardingSnapshot = {
  state: defaultOnboardingState(),
  environment: "ubuntu",
  username: "gratitude",
  address: "gratitude@wzrd.tech",
  mailboxDomain: "wzrd.tech",
  identityMedia,
  avatarAssetId: built ? "a-profile" : null,
  twin,
  twinAvailable: false,
  consents: built
    ? [consent("likeness"), consent("voice"), consent("video_avatar")]
    : [],
  voiceAvailable: true,
  avatarAvailable: true,
  speechAvailable: true,
  twinPreviewUrl: null,
  connections: [
    { toolkit: "gmail", status: "active", connected_at: "2026-08-01" },
    { toolkit: "googlecalendar", status: "pending", connected_at: null },
  ],
  managers: [
    {
      manager: "bitwarden",
      enabled: false,
      status: "off",
      provenance_count: 0,
      warnings: "",
      last_synced_at: null,
    },
  ],
  vaultItemCount: 2,
  onairos: { available: true, connected: false, connect_url: null },
  speedTier: "balanced",
  modelFamily: "openai",
  gmiModel: null,
  merchant: null,
  link: {
    installed: true,
    session_authenticated: false,
    agent_payment_grant: "unknown",
    authenticated: false,
    verification_url: null,
    phrase: null,
    updated_at: null,
  },
  pluginSessions: 1,
  ingest: {
    chunks: 3,
    messages: 14203,
    last_upload_at: "2026-08-17T10:00:00Z",
    from_date: "2026-05-01",
    to_date: "2026-08-17",
    cursor: "2026-08-17T09:58:12.000Z",
    pending_resolutions: 0,
  },
  imports: {
    sources: {
      hermes: { files: 12, bytes: 40_000 },
      codex: { files: 88, bytes: 2_400_000 },
      claude: { files: 41, bytes: 1_100_000 },
    },
    last_upload_at: "2026-08-20T10:00:00Z",
    dictionary_started_at: null,
    dictionary_built_at: null,
    dictionary_run_id: null,
    dictionary_indexed_for: null,
  },
  importCommand:
    "curl -fsSL https://app.wzrd.tech/agent-context-import.sh -o /tmp/air-import.sh && AIR_IMPORT_ENDPOINT=https://app.wzrd.tech/api/me/agent-context bash /tmp/air-import.sh tkt_example_ticket_value",
  browserProfile: {
    enabled: false,
    browser: null,
    files: 0,
    bytes: 0,
    imported_at: null,
  },
  browserProfileCommand:
    "curl -fsSL https://app.wzrd.tech/browser-profile-import.sh -o /tmp/air-browser-import.sh && AIR_BROWSER_ENDPOINT=https://app.wzrd.tech/api/me/browser-profile bash /tmp/air-browser-import.sh tkt_example_ticket_value",
  ingestCommand:
    "curl -fsSL https://app.wzrd.tech/imessage-ingest.sh -o /tmp/air-ingest.sh && AIR_INGEST_ENDPOINT=https://app.wzrd.tech/api/me/imessage-history bash /tmp/air-ingest.sh tkt_example_ticket_value",
  boxBusy: false,
  awakeBoxId: "bx_preview",
  linkPairing: false,
  resolutions: null,
};

mkdirSync(outDir, { recursive: true });
for (const slide of SLIDE_GROUPS) {
  const first = slide.sections.find((section) =>
    isOnboardingStep(section.key)
  );
  const step = first && isOnboardingStep(first.key) ? first.key : "welcome";
  const html = renderOnboarding(current, snapshot, step, null);
  writeFileSync(`${outDir}/${slide.id}.html`, html);
  // The twin slide's panels fold into a stepper; write each step's deep
  // link too so a screenshot pass can open every panel.
  if (slide.id === "booth") {
    for (const step of ["consent", "selfies", "voice", "twin", "avatar"] as const) {
      writeFileSync(
        `${outDir}/booth-${step}.html`,
        renderOnboarding(current, snapshot, step, null)
      );
    }
  }
}
process.stdout.write(`${SLIDE_GROUPS.length} slides -> ${outDir}\n`);
