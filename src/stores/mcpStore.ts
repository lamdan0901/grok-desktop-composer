import { create } from "zustand";

export type McpServerStatus = "ready" | "initializing" | "unavailable" | "needsauth";
export type McpInitializationPhase = "running" | "complete";
export type McpInitializationFailure = Extract<
  McpServerStatus,
  "unavailable" | "needsauth"
>;

export interface McpInitializationState {
  phase: McpInitializationPhase;
  total: number;
  connected: number;
  failures: Record<string, McpInitializationFailure>;
}

export function formatMcpInitialization(state: McpInitializationState): string {
  if (state.phase === "running") {
    return `Starting MCP servers ${state.connected}/${state.total}…`;
  }
  const failures = Object.entries(state.failures)
    .map(([name, status]) => `${name} ${status === "needsauth" ? "needs authentication" : "unavailable"}`)
    .join(", ");
  return `MCP ready: ${state.connected}/${state.total}${failures ? ` · ${failures}` : ""}`;
}

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
  initializationByTab: Record<string, McpInitializationState>;
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
  setInitializationProgress: (tabId: string, total: number, connected: number) => void;
  applyInitializationServerStatus: (
    tabId: string,
    name: string,
    status: McpServerStatus | undefined,
  ) => void;
  completeInitialization: (tabId: string) => void;
  getInitialization: (tabId: string) => McpInitializationState | undefined;
  clearInitialization: (tabId: string) => void;
  getServers: (tabId: string) => McpServerEntry[];
  clearTab: (tabId: string) => void;
}

const EMPTY: McpServerEntry[] = [];

export const useMcpStore = create<McpState>((set, get) => ({
  serversByTab: {},
  initializationByTab: {},
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
  setInitializationProgress: (tabId, total, connected) =>
    set((s) => {
      const current = s.initializationByTab[tabId];
      const next: McpInitializationState = {
        phase: "running",
        total,
        connected,
        failures: !current || current.phase === "complete" ? {} : current.failures,
      };
      return { initializationByTab: { ...s.initializationByTab, [tabId]: next } };
    }),
  applyInitializationServerStatus: (tabId, name, status) =>
    set((s) => {
      const current = s.initializationByTab[tabId];
      if (!current) return s;

      const failures = { ...current.failures };
      if (status === "ready") delete failures[name];
      else if (status === "unavailable" || status === "needsauth") failures[name] = status;
      else return s;

      return {
        initializationByTab: {
          ...s.initializationByTab,
          [tabId]: { ...current, failures },
        },
      };
    }),
  completeInitialization: (tabId) =>
    set((s) => {
      const current = s.initializationByTab[tabId];
      if (!current) return s;
      return {
        initializationByTab: {
          ...s.initializationByTab,
          [tabId]: { ...current, phase: "complete" },
        },
      };
    }),
  getInitialization: (tabId) => get().initializationByTab[tabId],
  clearInitialization: (tabId) =>
    set((s) => {
      const { [tabId]: _removed, ...rest } = s.initializationByTab;
      return { initializationByTab: rest };
    }),
  getServers: (tabId) => get().serversByTab[tabId] ?? EMPTY,
  clearTab: (tabId) =>
    set((s) => {
      const { [tabId]: _removedServer, ...serversByTab } = s.serversByTab;
      const { [tabId]: _removedInitialization, ...initializationByTab } =
        s.initializationByTab;
      return { serversByTab, initializationByTab };
    }),
}));
