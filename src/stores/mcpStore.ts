import { create } from "zustand";

export type McpServerStatus = "ready" | "initializing" | "unavailable" | "needsauth";

export interface McpToolEntry {
  name: string;
  displayName?: string;
  description?: string;
  enabled: boolean;
}
export interface McpServerSessionState {
  enabled: boolean;
  status?: McpServerStatus;
  tools: McpToolEntry[];
  authRequired: boolean;
}
export interface McpServerEntry {
  name: string;
  displayName?: string;
  source: "managed" | "local";
  sourceLabel?: string;
  type: "http" | "stdio" | "managedGateway";
  url?: string;
  command?: string;
  args?: string[];
  env?: { name: string; value: string }[];
  session?: McpServerSessionState;
}

interface McpState {
  /** Read-cache of grok's MCP catalog, keyed by tab (per-session status). */
  serversByTab: Record<string, McpServerEntry[]>;
  setServers: (tabId: string, servers: McpServerEntry[]) => void;
  applyServerStatus: (
    tabId: string,
    status: {
      name: string;
      status?: McpServerStatus;
      enabled?: boolean;
      tools?: McpToolEntry[];
      authRequired?: boolean;
    },
  ) => void;
  getServers: (tabId: string) => McpServerEntry[];
  clearTab: (tabId: string) => void;
}

const EMPTY: McpServerEntry[] = [];

export const useMcpStore = create<McpState>((set, get) => ({
  serversByTab: {},
  setServers: (tabId, servers) =>
    set((s) => ({ serversByTab: { ...s.serversByTab, [tabId]: servers } })),
  applyServerStatus: (tabId, status) =>
    set((s) => {
      const list = s.serversByTab[tabId] ?? [];
      const next = list.map((srv) =>
        srv.name === status.name
          ? {
              ...srv,
              session: {
                enabled: status.enabled ?? srv.session?.enabled ?? false,
                status: status.status ?? srv.session?.status,
                tools: status.tools ?? srv.session?.tools ?? [],
                authRequired: status.authRequired ?? srv.session?.authRequired ?? false,
              },
            }
          : srv,
      );
      return { serversByTab: { ...s.serversByTab, [tabId]: next } };
    }),
  getServers: (tabId) => get().serversByTab[tabId] ?? EMPTY,
  clearTab: (tabId) =>
    set((s) => {
      const { [tabId]: _removed, ...rest } = s.serversByTab;
      return { serversByTab: rest };
    }),
}));
