import { create } from "zustand";
import type { SkillEntry } from "@/lib/acp/xaiExtensions";
import type { GrokSkillDiskEntry } from "@/lib/grokExtensions";

type State = {
  skillsByTab: Record<string, SkillEntry[]>;
  diskById: Record<string, GrokSkillDiskEntry>;
  loadingByTab: Record<string, boolean>;
  errorByTab: Record<string, string | undefined>;
  setSkills: (tabId: string, skills: SkillEntry[]) => void;
  setDisk: (rows: GrokSkillDiskEntry[]) => void;
  setLoading: (tabId: string, value: boolean) => void;
  setError: (tabId: string, value?: string) => void;
  clearTab: (tabId: string) => void;
};

export const useSkillStore = create<State>((set) => ({
  skillsByTab: {},
  diskById: {},
  loadingByTab: {},
  errorByTab: {},
  setSkills: (tabId, skills) => set((state) => ({ skillsByTab: { ...state.skillsByTab, [tabId]: skills } })),
  setDisk: (rows) => set({ diskById: Object.fromEntries(rows.map((row) => [row.id, row])) }),
  setLoading: (tabId, value) => set((state) => ({ loadingByTab: { ...state.loadingByTab, [tabId]: value } })),
  setError: (tabId, value) => set((state) => ({ errorByTab: { ...state.errorByTab, [tabId]: value } })),
  clearTab: (tabId) => set((state) => {
    const { [tabId]: _skills, ...skillsByTab } = state.skillsByTab;
    const { [tabId]: _loading, ...loadingByTab } = state.loadingByTab;
    const { [tabId]: _error, ...errorByTab } = state.errorByTab;
    return { skillsByTab, loadingByTab, errorByTab };
  }),
}));
