import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { getTabSession } from "@/lib/acp";
import { listSkills, refreshSkills, setSkillEnabled } from "@/lib/acp/xaiExtensions";
import { listGrokSkills, readGrokSkill } from "@/lib/grokExtensions";
import { useSkillStore } from "@/stores/skillStore";
import { useWorkspaceStore } from "@/stores/workspaceStore";

const PREVIEW_LIMIT = 4000;
const EMPTY_SKILLS = [] as const;

export function SkillsPanel() {
  const tabId = useWorkspaceStore((state) => state.activeSessionId);
  const skills = useSkillStore((state) => (tabId ? state.skillsByTab[tabId] ?? EMPTY_SKILLS : EMPTY_SKILLS));
  const diskById = useSkillStore((state) => state.diskById);
  const loading = useSkillStore((state) => (tabId ? state.loadingByTab[tabId] : false));
  const error = useSkillStore((state) => (tabId ? state.errorByTab[tabId] : undefined));
  const [preview, setPreview] = useState<{ id: string; text: string } | null>(null);
  const [unsupported, setUnsupported] = useState<Set<string>>(new Set());

  async function load() {
    if (!tabId) return;
    const store = useSkillStore.getState();
    store.setLoading(tabId, true);
    store.setError(tabId);
    try {
      const [remote, disk] = await Promise.all([listSkills(tabId), listGrokSkills()]);
      if (remote) store.setSkills(tabId, remote);
      else setUnsupported((current) => new Set(current).add("list"));
      store.setDisk(disk);
    } catch (cause) {
      store.setError(tabId, String(cause));
    } finally {
      store.setLoading(tabId, false);
    }
  }

  useEffect(() => {
    load().catch((cause) => {
      if (tabId) useSkillStore.getState().setError(tabId, String(cause));
    });
  }, [tabId]);

  async function toggle(skillId: string, enabled: boolean) {
    if (!tabId) return;
    const action = enabled ? "Enable" : "Disable";
    if (!window.confirm(`${action} this skill? It can change the instructions and code Grok uses in this project.`)) return;
    try {
      const supported = await setSkillEnabled(tabId, skillId, enabled);
      if (!supported) setUnsupported((current) => new Set(current).add(enabled ? "enable" : "disable"));
      else await load();
    } catch (cause) {
      useSkillStore.getState().setError(tabId, String(cause));
    }
  }

  async function refresh() {
    if (!tabId) return;
    try {
      const supported = await refreshSkills(tabId);
      if (!supported) setUnsupported((current) => new Set(current).add("refresh"));
      else await load();
    } catch (cause) {
      useSkillStore.getState().setError(tabId, String(cause));
    }
  }

  async function showInstructions(id: string) {
    const disk = diskById[id];
    if (!disk?.hasSkillMd) return;
    try {
      setPreview({ id, text: (await readGrokSkill(id)).slice(0, PREVIEW_LIMIT) });
    } catch (cause) {
      if (tabId) useSkillStore.getState().setError(tabId, String(cause));
    }
  }

  async function createSkill() {
    if (!tabId) return;
    const prompt = "/create-skill";
    const store = useWorkspaceStore.getState();
    store.addUserMessage(tabId, prompt);
    store.setSessionStatus(tabId, "running");
    try {
      await getTabSession(tabId).sendPrompt(prompt);
    } catch (cause) {
      store.setSessionStatus(tabId, "idle");
      useSkillStore.getState().setError(tabId, String(cause));
    }
  }

  if (!tabId) return <p className="extensions-empty">Open a thread to manage its skills.</p>;
  if (unsupported.has("list")) return <p className="extensions-empty">Skills are not supported by this Grok session.</p>;

  return (
    <section className="extensions-panel" aria-label="Skills">
      <div className="extensions-panel__actions">
        <button type="button" onClick={() => refresh()} disabled={loading || unsupported.has("refresh")}>
          <RefreshCw size={15} /> Refresh
        </button>
        <button type="button" onClick={() => createSkill()}>Create a skill</button>
      </div>
      {error && <p className="extensions-error">{error}</p>}
      {loading && <p className="extensions-empty">Loading skills…</p>}
      {!loading && skills.length === 0 && <p className="extensions-empty">No skills installed.</p>}
      <ul className="extensions-list">
        {skills.map((skill) => {
          const disk = diskById[skill.id];
          const toggleUnsupported = unsupported.has(skill.enabled ? "disable" : "enable");
          return (
            <li key={skill.id} className="extensions-list__item">
              <div>
                <strong>{skill.name}</strong>
                {skill.description && <p>{skill.description}</p>}
                <small>{skill.source ?? disk?.path ?? "Grok"}</small>
              </div>
              {!toggleUnsupported && (
                <label>
                  <input
                    type="checkbox"
                    aria-label={`${skill.enabled ? "Disable" : "Enable"} ${skill.name}`}
                    checked={skill.enabled}
                    onChange={(event) => toggle(skill.id, event.currentTarget.checked)}
                  />
                  {skill.enabled ? "Enabled" : "Disabled"}
                </label>
              )}
              {disk?.hasSkillMd && (
                <button type="button" onClick={() => showInstructions(skill.id)}>View skill instructions</button>
              )}
              {preview?.id === skill.id && <pre>{preview.text}</pre>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
