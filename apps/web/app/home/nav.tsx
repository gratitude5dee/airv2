"use client";

/**
 * Grouped left rail (spec §2): AIR / APPS / PERSONAL / BANK / SETTINGS.
 * Nav state lives in the URL (`/home?s=air.chat`) — the page owns routing;
 * this component just renders the groups, the AIR thread list, the Bots
 * drawer toggle, and the globally visible Needs You badge (D5/D1: the old
 * TABS array and 13-way ternary are retired together).
 */

export type Section =
  | "air.chat"
  | "apps.installed"
  | "apps.ads"
  | "personal.needs"
  | "personal.calendar"
  | "personal.history"
  | "personal.people"
  | "bank.wallet"
  | "bank.vault"
  | "settings.profile"
  | "settings.connectors"
  | "settings.skills";

export const DEFAULT_SECTION: Section = "air.chat";

const SECTIONS = new Set<string>([
  "air.chat",
  "apps.installed",
  "apps.ads",
  "personal.needs",
  "personal.calendar",
  "personal.history",
  "personal.people",
  "bank.wallet",
  "bank.vault",
  "settings.profile",
  "settings.connectors",
  "settings.skills",
]);

export function parseSection(raw: string | null): Section {
  return raw && SECTIONS.has(raw) ? (raw as Section) : DEFAULT_SECTION;
}

const GROUPS: [string, [Section, string][]][] = [
  [
    "APPS",
    [
      ["apps.installed", "Installed"],
      ["apps.ads", "Ads"],
    ],
  ],
  [
    "PERSONAL",
    [
      ["personal.needs", "Needs you"],
      ["personal.calendar", "Calendar"],
      ["personal.history", "History"],
      ["personal.people", "People"],
    ],
  ],
  [
    "BANK",
    [
      ["bank.wallet", "Wallet"],
      ["bank.vault", "Vault"],
    ],
  ],
  [
    "SETTINGS",
    [
      ["settings.profile", "Profile"],
      ["settings.connectors", "Connectors"],
      ["settings.skills", "Skills"],
    ],
  ],
];

export interface ThreadItem {
  id: string;
  title: string;
}

export function HomeNav({
  section,
  onNavigate,
  needsCount,
  threads,
  activeThread,
  onSelectThread,
  onNewThread,
  botsOpen,
  onToggleBots,
}: {
  section: Section;
  onNavigate: (next: Section) => void;
  /** Pending Needs You count — globally visible badge (spec §8). */
  needsCount: number;
  threads: ThreadItem[];
  activeThread: string;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
  botsOpen: boolean;
  onToggleBots: () => void;
}) {
  return (
    <nav
      className="flex h-fit flex-row flex-wrap gap-1 rounded-2xl p-1.5 shadow-[0_0_0_0.5px_var(--ring)] md:flex-col md:rounded-[20px]"
      aria-label="Sections"
    >
      <p className="muted m-0 hidden px-2 pt-1 text-[10px] font-semibold tracking-[0.1em] md:block">
        AIR
      </p>
      <button
        aria-current={section === "air.chat" ? "page" : undefined}
        className={"seg" + (section === "air.chat" ? " pill-active" : "")}
        onClick={() => onNavigate("air.chat")}
      >
        Chat
      </button>
      {section === "air.chat" ? (
        <div className="hidden flex-col gap-0.5 pl-2 md:flex">
          <button
            className={
              "seg !py-1 !text-[12px]" +
              (activeThread === "air-main" ? " pill-active" : "")
            }
            aria-current={activeThread === "air-main" ? "true" : undefined}
            onClick={() => onSelectThread("air-main")}
            title="The shared conversation — same one as on iMessage."
          >
            Main
          </button>
          {threads.map((t) => (
            <button
              key={t.id}
              className={
                "seg !py-1 !text-[12px]" +
                (activeThread === t.id ? " pill-active" : "")
              }
              aria-current={activeThread === t.id ? "true" : undefined}
              onClick={() => onSelectThread(t.id)}
            >
              <span className="block truncate">{t.title}</span>
            </button>
          ))}
          <button
            className="seg !py-1 !text-[12px] text-[var(--muted)]"
            onClick={onNewThread}
          >
            + New thread
          </button>
        </div>
      ) : null}
      <button
        className={"seg" + (botsOpen ? " pill-active" : "")}
        aria-pressed={botsOpen}
        onClick={onToggleBots}
      >
        Bots
      </button>
      {GROUPS.map(([group, items]) => (
        <div key={group} className="contents md:flex md:flex-col md:gap-1">
          <p className="muted m-0 hidden px-2 pt-2 text-[10px] font-semibold tracking-[0.1em] md:block">
            {group}
          </p>
          {items.map(([key, label]) => (
            <button
              key={key}
              aria-current={section === key ? "page" : undefined}
              className={
                "seg flex items-center justify-between gap-1" +
                (section === key ? " pill-active" : "")
              }
              onClick={() => onNavigate(key)}
            >
              <span>{label}</span>
              {key === "personal.needs" && needsCount > 0 ? (
                <span
                  className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white"
                  aria-label={`${needsCount} pending`}
                >
                  {needsCount > 9 ? "9+" : needsCount}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ))}
    </nav>
  );
}
