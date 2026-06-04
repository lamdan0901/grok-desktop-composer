/** Max concurrent agent runs (busy threads), not idle sidebar history. */
export const MAX_SESSIONS = 8;

/** Max idle threads to restore into the sidebar on startup (no ACP processes). */
export const MAX_SIDEBAR_RESTORE_SESSIONS = 30;

/** @deprecated Use MAX_SESSIONS */
export const MAX_TABS = MAX_SESSIONS;