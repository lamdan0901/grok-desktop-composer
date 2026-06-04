/**
 * @deprecated Import from workspaceStore instead.
 * Kept for gradual migration — maps tab terminology to sessions.
 */
export {
  getSessionCwd,
  isSessionBusy as isTabBusy,
  stopSessionProcess as stopTabProcess,
  useWorkspaceStore as useTabsStore,
} from "@/stores/workspaceStore";