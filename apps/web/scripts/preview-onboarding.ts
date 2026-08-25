/**
 * Dev-only: render every onboarding slide to static HTML for visual review.
 *   npx tsx scripts/preview-onboarding.ts <outDir> [themeId]
 * Not imported by the app.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import {
  renderOnboarding,
  type OnboardingSnapshot,
} from "../lib/miniapps/apps/onboarding";
import { ONBOARDING_STEPS, defaultOnboardingState } from "../lib/miniapps/onboarding";
import { isThemeId, theme, DEFAULT_THEME } from "../lib/miniapps/themes";

const [outDir = "/tmp/onboarding-preview", themeArg = DEFAULT_THEME] =
  process.argv.slice(2);
const current = theme(isThemeId(themeArg) ? themeArg : DEFAULT_THEME);

const snapshot: OnboardingSnapshot = {
  state: defaultOnboardingState(),
  environment: "ubuntu",
  username: "gratitude",
  address: "gratitude@agents.wzrd.tech",
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
  ingestCommand:
    "curl -fsSL https://app.wzrd.tech/imessage-ingest.sh -o /tmp/air-ingest.sh && AIR_INGEST_ENDPOINT=https://app.wzrd.tech/api/me/imessage-history bash /tmp/air-ingest.sh tkt_example_ticket_value",
  boxBusy: false,
};

mkdirSync(outDir, { recursive: true });
for (const step of ONBOARDING_STEPS) {
  const html = renderOnboarding(current, snapshot, step, null);
  writeFileSync(`${outDir}/${step}.html`, html);
}
process.stdout.write(`${ONBOARDING_STEPS.length} slides -> ${outDir}\n`);
