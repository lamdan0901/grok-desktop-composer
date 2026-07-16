import { invoke } from "@tauri-apps/api/core";

export type GrokSkillDiskEntry = { id: string; path: string; hasSkillMd: boolean };

export async function listGrokSkills(): Promise<GrokSkillDiskEntry[]> {
  const rows = await invoke<Array<{ id: string; path: string; has_skill_md: boolean }>>(
    "list_grok_skills",
  );
  return rows.map((row) => ({ id: row.id, path: row.path, hasSkillMd: row.has_skill_md }));
}

export function readGrokSkill(skillId: string): Promise<string> {
  if (!/^[A-Za-z0-9._-]+$/.test(skillId)) throw new Error("Invalid skill id");
  return invoke<string>("read_grok_skill", { skillId });
}
