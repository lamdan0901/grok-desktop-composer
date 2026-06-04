import { create } from "zustand";
import type { ActiveGrokSession } from "@/lib/types";

interface ActiveSessionsState {
  sessions: ActiveGrokSession[];
  setSessions: (sessions: ActiveGrokSession[]) => void;
}

export const useActiveSessionsStore = create<ActiveSessionsState>((set) => ({
  sessions: [],
  setSessions: (sessions) => set({ sessions }),
}));