import type { AvailableCommand } from "@agentclientprotocol/sdk";
import { create } from "zustand";
import type { SessionId } from "@/lib/types";

export type SlashCommandsLoadStatus = "idle" | "loading" | "loaded";

interface SlashCommandsState {
  bySession: Record<SessionId, AvailableCommand[] | undefined>;
  statusBySession: Record<SessionId, SlashCommandsLoadStatus | undefined>;
  setCommands: (sessionId: SessionId, commands: AvailableCommand[]) => void;
  markLoading: (sessionId: SessionId) => void;
  markIdle: (sessionId: SessionId) => void;
  isCached: (sessionId: SessionId) => boolean;
  clearSession: (sessionId: SessionId) => void;
}

export const useSlashCommandsStore = create<SlashCommandsState>((set, get) => ({
  bySession: {},
  statusBySession: {},

  setCommands: (sessionId, commands) =>
    set((state) => ({
      bySession: {
        ...state.bySession,
        [sessionId]: commands,
      },
      statusBySession: {
        ...state.statusBySession,
        [sessionId]: "loaded",
      },
    })),

  markLoading: (sessionId) =>
    set((state) => ({
      statusBySession: {
        ...state.statusBySession,
        [sessionId]: "loading",
      },
    })),

  markIdle: (sessionId) =>
    set((state) => ({
      statusBySession: {
        ...state.statusBySession,
        [sessionId]: "idle",
      },
    })),

  isCached: (sessionId) => get().statusBySession[sessionId] === "loaded",

  clearSession: (sessionId) =>
    set((state) => {
      const nextBy = { ...state.bySession };
      const nextStatus = { ...state.statusBySession };
      delete nextBy[sessionId];
      delete nextStatus[sessionId];
      return { bySession: nextBy, statusBySession: nextStatus };
    }),
}));