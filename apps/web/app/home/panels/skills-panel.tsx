"use client";

/**
 * Skills — hub search, suggested row, installed list with updates/detail
 * (extracted verbatim from the old page.tsx skills tab in the redesign
 * phase-1 split; now self-contained).
 */
import { useEffect, useRef, useState } from "react";
import { Orb } from "@/components/orb/Orb";
import { boxErrorNote, pickList } from "../lib";

interface SkillSummary {
  name?: string;
  description?: string;
  enabled?: boolean;
}

interface HubSkill {
  name: string;
  identifier: string;
  source: string;
  trust_level: string;
  description: string;
}

interface SkillUpdate {
  name: string;
  status: "up_to_date" | "update_available" | "unavailable";
}

interface SkillDetail {
  name: string;
  source: string | null;
  trust_level: string | null;
  identifier: string | null;
  installed_at: string | null;
  readme: string | null;
}

interface SuggestedSkill {
  name: string;
  description: string;
}

/** Detail sheet body shared by installed and suggested skill cards. */
function SkillDetailSheet({ detail }: { detail: SkillDetail | null }) {
  return (
    <div className="mt-2 border-t border-[var(--ring)] pt-2">
      {detail === null ? (
        <p className="muted m-0 text-[12px]">Loading details…</p>
      ) : (
        <>
          <p className="muted m-0 text-[11px]">
            {[
              detail.source,
              detail.trust_level,
              detail.installed_at
                ? `Installed ${new Date(
                    detail.installed_at
                  ).toLocaleDateString()}`
                : null,
            ]
              .filter(Boolean)
              .join(" \u00b7 ") || "Bundled skill"}
          </p>
          {detail.readme ? (
            <pre className="m-0 mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-2 text-[11px] leading-relaxed">
              {detail.readme}
            </pre>
          ) : (
            <p className="muted m-0 mt-2 text-[12px]">
              No description file for this skill.
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function SkillsPanel({ active }: { active: boolean }) {
  const [skills, setSkills] = useState<SkillSummary[] | null>(null);
  const [panelNote, setPanelNote] = useState<string | null>(null);
  const [panelFailed, setPanelFailed] = useState(false);
  const panelLoadId = useRef(0);
  const [skillQuery, setSkillQuery] = useState("");
  const [hubResults, setHubResults] = useState<HubSkill[] | null>(null);
  const [hubNote, setHubNote] = useState<string | null>(null);
  const [skillBusy, setSkillBusy] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<SuggestedSkill[]>([]);
  const [skillUpdates, setSkillUpdates] = useState<SkillUpdate[] | null>(null);
  const [updatesNote, setUpdatesNote] = useState<string | null>(null);
  const [skillDetail, setSkillDetail] = useState<SkillDetail | null>(null);
  const [skillDetailFor, setSkillDetailFor] = useState<string | null>(null);

  async function loadInstalledSkills() {
    const loadId = ++panelLoadId.current;
    setPanelFailed(false);
    setPanelNote("Waking your agent… this can take a minute if it was asleep.");
    try {
      const res = await fetch("/api/box/v1/skills");
      if (res.ok) {
        const list = pickList<SkillSummary>(await res.json(), [
          "skills",
          "data",
          "items",
        ]);
        if (loadId !== panelLoadId.current) return;
        setSkills(list);
        setPanelNote(null);
      } else {
        if (loadId !== panelLoadId.current) return;
        setPanelNote(boxErrorNote(res.status, "skills"));
        setPanelFailed(true);
      }
    } catch {
      if (loadId !== panelLoadId.current) return;
      setPanelNote("Couldn't load skills — try again shortly.");
      setPanelFailed(true);
    }
  }

  useEffect(() => {
    if (active && skills === null) {
      void loadSuggested();
      void loadInstalledSkills();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  async function refreshSkills() {
    const res = await fetch("/api/box/v1/skills");
    if (res.ok) {
      setSkills(
        pickList<SkillSummary>(await res.json(), ["skills", "data", "items"])
      );
    }
  }

  async function loadSuggested() {
    try {
      const res = await fetch("/api/skills?suggested=1");
      if (res.ok) {
        const data = (await res.json()) as { suggested?: SuggestedSkill[] };
        setSuggested(data.suggested ?? []);
      }
    } catch {
      // suggestion row is optional
    }
  }

  async function checkSkillUpdates() {
    setUpdatesNote("Checking for updates…");
    setSkillUpdates(null);
    try {
      const res = await fetch("/api/skills?updates=1");
      if (res.ok) {
        const data = (await res.json()) as { updates?: SkillUpdate[] };
        setSkillUpdates(data.updates ?? []);
        setUpdatesNote(null);
      } else {
        setUpdatesNote(
          res.status === 429
            ? "Your agent's computer is busy starting up — try again in a minute."
            : "Update check failed — try again shortly."
        );
      }
    } catch {
      setUpdatesNote("Update check failed — try again shortly.");
    }
  }

  async function updateHubSkill(name: string) {
    setSkillBusy(name);
    setUpdatesNote(null);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", name }),
      });
      if (res.ok) {
        setSkillUpdates(
          (rows) =>
            rows?.map((u) =>
              u.name === name ? { ...u, status: "up_to_date" as const } : u
            ) ?? null
        );
        await refreshSkills();
      } else {
        setUpdatesNote("Update failed — try again shortly.");
      }
    } catch {
      setUpdatesNote("Update failed — try again shortly.");
    } finally {
      setSkillBusy(null);
    }
  }

  async function openSkillDetail(name: string) {
    if (skillDetailFor === name) {
      setSkillDetailFor(null);
      setSkillDetail(null);
      return;
    }
    setSkillDetailFor(name);
    setSkillDetail(null);
    try {
      const res = await fetch(`/api/skills?detail=${encodeURIComponent(name)}`);
      if (res.ok) {
        const data = (await res.json()) as { skill?: SkillDetail };
        setSkillDetail(data.skill ?? null);
      }
    } catch {
      // the sheet shows a fallback when detail is null
    }
  }

  async function searchSkillHub() {
    const q = skillQuery.trim();
    if (!q) return;
    setHubNote("Searching skill registries…");
    setHubResults(null);
    try {
      const res = await fetch(`/api/skills?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = (await res.json()) as { results?: HubSkill[] };
        setHubResults(data.results ?? []);
        setHubNote(null);
      } else {
        setHubNote(
          res.status === 429
            ? "Your agent's computer is busy starting up — try again in a minute."
            : "Search failed — try again shortly."
        );
      }
    } catch {
      setHubNote("Search failed — try again shortly.");
    }
  }

  async function installHubSkill(identifier: string) {
    setSkillBusy(identifier);
    setHubNote(null);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "install", identifier }),
      });
      if (res.ok) {
        setHubNote("Installed.");
        await refreshSkills();
      } else {
        setHubNote("Install failed — try again shortly.");
      }
    } catch {
      setHubNote("Install failed — try again shortly.");
    } finally {
      setSkillBusy(null);
    }
  }

  async function uninstallHubSkill(name: string) {
    setSkillBusy(name);
    setHubNote(null);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "uninstall", name }),
      });
      if (res.ok) {
        await refreshSkills();
      } else {
        setHubNote("Remove failed — it may be a bundled skill.");
      }
    } catch {
      setHubNote("Remove failed — try again shortly.");
    } finally {
      setSkillBusy(null);
    }
  }

  if (!active) return null;

  return (
    <div className="grid flex-1 content-start gap-2 overflow-y-auto">
      <h3 className="m-0 text-[15px] font-semibold">Skills</h3>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void searchSkillHub();
        }}
      >
        <input
          className="input flex-1 !py-1.5 !text-[13px]"
          placeholder="Search the skill hub…"
          value={skillQuery}
          onChange={(e) => setSkillQuery(e.target.value)}
          aria-label="Search skills"
        />
        <button
          type="submit"
          className="btn !px-3 !py-1.5 !text-[12px]"
          disabled={!skillQuery.trim()}
        >
          Search
        </button>
      </form>
      {hubNote ? <p className="muted m-0 text-[12px]">{hubNote}</p> : null}
      {(hubResults ?? []).map((r) => (
        <div key={r.identifier} className="panel rise-in !p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <strong className="text-[13px]">{r.name}</strong>
              <p className="muted m-0 mt-1 text-[12px]">{r.description}</p>
              <p className="muted m-0 mt-1 text-[11px]">
                {[r.source, r.trust_level].filter(Boolean).join(" \u00b7 ")}
              </p>
            </div>
            <button
              className="btn !px-3 !py-1.5 !text-[12px]"
              disabled={skillBusy !== null}
              onClick={() => void installHubSkill(r.identifier)}
            >
              {skillBusy === r.identifier ? "Installing…" : "Install"}
            </button>
          </div>
        </div>
      ))}
      {hubResults !== null && hubResults.length === 0 ? (
        <p className="muted m-0 text-[13px]">No skills found.</p>
      ) : null}
      {suggested.length > 0 ? (
        <>
          <h4 className="m-0 mt-2 text-[13px] font-semibold">
            Suggested for you
          </h4>
          <div className="grid gap-2">
            {suggested.map((s) => {
              const suggestedOpen = skillDetailFor === s.name;
              return (
                <div key={s.name} className="panel rise-in !p-3">
                  <button
                    type="button"
                    className="min-w-0 cursor-pointer border-0 bg-transparent p-0 text-left"
                    onClick={() => void openSkillDetail(s.name)}
                    aria-expanded={suggestedOpen}
                  >
                    <strong className="text-[13px]">{s.name}</strong>
                    <p className="muted m-0 mt-1 text-[12px]">{s.description}</p>
                  </button>
                  {suggestedOpen ? <SkillDetailSheet detail={skillDetail} /> : null}
                </div>
              );
            })}
          </div>
        </>
      ) : null}
      <div className="mt-2 flex items-center justify-between gap-2">
        <h4 className="m-0 text-[13px] font-semibold">Installed</h4>
        <button
          className="btn btn-ghost !px-2.5 !py-1 !text-[12px]"
          disabled={updatesNote === "Checking for updates…"}
          onClick={() => void checkSkillUpdates()}
        >
          Check for updates
        </button>
      </div>
      {updatesNote ? <p className="muted m-0 text-[12px]">{updatesNote}</p> : null}
      {skillUpdates !== null &&
      skillUpdates.every((u) => u.status !== "update_available") ? (
        <p className="muted m-0 text-[12px]">Everything is up to date.</p>
      ) : null}
      {panelNote ? (
        <div className="flex items-center gap-2 py-1">
          <Orb pill label={panelNote} />
          {panelFailed ? (
            <button
              className="btn !px-3 !py-1.5 !text-[12px]"
              onClick={() => void loadInstalledSkills()}
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
      {(skills ?? []).map((s, i) => {
        const update = s.name
          ? skillUpdates?.find((u) => u.name === s.name)
          : undefined;
        const detailOpen = s.name != null && skillDetailFor === s.name;
        return (
          <div key={s.name ?? i} className="panel rise-in !p-3">
            <div className="flex items-start justify-between gap-2">
              <button
                type="button"
                className="min-w-0 cursor-pointer border-0 bg-transparent p-0 text-left"
                disabled={s.name == null}
                aria-expanded={detailOpen}
                onClick={() => {
                  if (s.name) void openSkillDetail(s.name);
                }}
              >
                <strong className="text-[13px]">{s.name ?? "skill"}</strong>
                {s.description ? (
                  <p className="muted m-0 mt-1 text-[12px]">{s.description}</p>
                ) : null}
              </button>
              <div className="flex shrink-0 items-center gap-2">
                {update?.status === "update_available" && s.name ? (
                  <button
                    className="btn !px-3 !py-1.5 !text-[12px]"
                    disabled={skillBusy !== null}
                    onClick={() => void updateHubSkill(s.name as string)}
                  >
                    {skillBusy === s.name ? "Updating…" : "Update"}
                  </button>
                ) : null}
                {s.name ? (
                  <button
                    className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
                    disabled={skillBusy !== null}
                    onClick={() => void uninstallHubSkill(s.name as string)}
                  >
                    {skillBusy === s.name ? "Removing…" : "Remove"}
                  </button>
                ) : null}
              </div>
            </div>
            {detailOpen ? <SkillDetailSheet detail={skillDetail} /> : null}
          </div>
        );
      })}
      {skills !== null && skills.length === 0 ? (
        <p className="muted text-[13px]">No skills installed yet.</p>
      ) : null}
    </div>
  );
}
