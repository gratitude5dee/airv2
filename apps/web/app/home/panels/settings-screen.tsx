"use client";

/**
 * Settings assembly (spec §7): Profile and Plugin Sign-In side by side on
 * top, CONNECTORS and SKILLS as tabs beneath. Tabs are the existing nav
 * sections (settings.connectors / settings.skills) so deep links keep
 * working; the connector OAuth full-redirect + resync-on-entry contract is
 * untouched — ConnectorsPanel reloads whenever its tab activates.
 */
import type { ComponentProps } from "react";
import type { Section } from "../nav";
import { PluginPanel } from "../plugin-panel";
import { ProfilePanel } from "./profile-panel";
import { ConnectorsPanel } from "./connectors-panel";
import { SkillsPanel } from "./skills-panel";

type ProfileProps = ComponentProps<typeof ProfilePanel>;

export function SettingsScreen({
  section,
  onNavigate,
  me,
  onOpenWallet,
}: {
  section: Section;
  onNavigate: (next: Section) => void;
  me: ProfileProps["me"];
  onOpenWallet: () => void;
}) {
  if (!section.startsWith("settings.")) return null;
  const tab: Section =
    section === "settings.skills" ? "settings.skills" : "settings.connectors";
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
      <div className="grid content-start gap-4 md:grid-cols-2">
        <ProfilePanel active me={me} onOpenWallet={onOpenWallet} />
        <div className="grid content-start gap-3">
          <h3 className="chrome m-0 !text-[12px]">Plugin sign-in</h3>
          <PluginPanel />
        </div>
      </div>
      <div className="flex gap-2" role="tablist" aria-label="Settings tabs">
        {(
          [
            ["settings.connectors", "Connectors"],
            ["settings.skills", "Skills"],
          ] as [Section, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={"seg !rounded-[8px]" + (tab === key ? " pill-active" : "")}
            onClick={() => onNavigate(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <ConnectorsPanel active={tab === "settings.connectors"} />
      <SkillsPanel active={tab === "settings.skills"} />
    </div>
  );
}
