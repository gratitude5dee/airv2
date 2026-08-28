/**
 * Dev-only: render every onboarding slide to static HTML for visual review.
 *   npx tsx scripts/preview-onboarding.ts <outDir> [themeId]
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
import { isThemeId, theme, DEFAULT_THEME } from "../lib/miniapps/themes";

const [outDir = "/tmp/onboarding-preview", themeArg = DEFAULT_THEME] =
  process.argv.slice(2);
const current = theme(isThemeId(themeArg) ? themeArg : DEFAULT_THEME);

const snapshot: OnboardingSnapshot = {
  state: defaultOnboardingState(),
  environment: "ubuntu",
  username: "gratitude",
  address: "gratitude@agents.wzrd.tech",
  mailboxDomain: "agents.wzrd.tech",
  identityMedia: [],
  avatarAssetId: null,
  twin: null,
  twinAvailable: false,
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
  merchant: null,
  link: {
    installed: true,
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
  linkPairing: false,
};

mkdirSync(outDir, { recursive: true });
for (const slide of SLIDE_GROUPS) {
  const first = slide.sections.find((section) =>
    isOnboardingStep(section.key)
  );
  const step = first && isOnboardingStep(first.key) ? first.key : "welcome";
  const html = renderOnboarding(current, snapshot, step, null);
  writeFileSync(`${outDir}/${slide.id}.html`, html);
}
process.stdout.write(`${SLIDE_GROUPS.length} slides -> ${outDir}\n`);
