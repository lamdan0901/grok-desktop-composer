import { create } from "zustand";

export type ExtensionTab = "skills" | "hooks" | "plugins" | "marketplace" | "mcp";

type State = {
  open: boolean;
  activeTab: ExtensionTab;
  openModal: (tab?: ExtensionTab) => void;
  closeModal: () => void;
  setTab: (tab: ExtensionTab) => void;
};

export const useExtensionsStore = create<State>((set) => ({
  open: false,
  activeTab: "skills",
  openModal: (activeTab = "skills") => set({ open: true, activeTab }),
  closeModal: () => set({ open: false }),
  setTab: (activeTab) => set({ activeTab }),
}));
