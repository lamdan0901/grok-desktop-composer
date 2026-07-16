import type { XaiMethodEntry } from "./xaiMethods";

/** Per-child-process (per-tab) support cache for request-method features. */
const requestSupport = new Map<string, Map<string, boolean>>();
/** Per-tab set of notification methods observed at least once. */
const notificationSeen = new Map<string, Set<string>>();

function isMethodNotFound(err: unknown): boolean {
  return Boolean(err) && typeof err === "object" && (err as { code?: number }).code === -32601;
}

function tabMap(tabId: string): Map<string, boolean> {
  let m = requestSupport.get(tabId);
  if (!m) {
    m = new Map();
    requestSupport.set(tabId, m);
  }
  return m;
}

/**
 * Execute a request-method feature call. `method_not_found` caches unsupported;
 * successful calls cache support but still return fresh data on every call.
 * Other failures are operational errors and are rethrown without caching.
 */
export async function callRequestFeature<T>(
  tabId: string,
  entry: XaiMethodEntry,
  call: () => Promise<T>,
): Promise<{ supported: true; value: T } | { supported: false }> {
  const cache = tabMap(tabId);
  const cached = cache.get(entry.method);
  if (cached === false) return { supported: false };

  try {
    const value = await call();
    cache.set(entry.method, true);
    return { supported: true, value };
  } catch (err) {
    if (isMethodNotFound(err)) {
      cache.set(entry.method, false); // genuine absence — cache it
      return { supported: false };
    }
    throw err; // transient — do not cache; let UI show a real operational error
  }
}

/** Record that a notification-only feature's signal was observed. */
export function markNotificationSeen(tabId: string, method: string): void {
  let s = notificationSeen.get(tabId);
  if (!s) {
    s = new Set();
    notificationSeen.set(tabId, s);
  }
  s.add(method);
}

export function isNotificationFeatureSeen(tabId: string, method: string): boolean {
  return notificationSeen.get(tabId)?.has(method) ?? false;
}

/** Drop all cached detection for a child process (call on reconnect/dispose). */
export function clearFeatureCache(tabId: string): void {
  requestSupport.delete(tabId);
  notificationSeen.delete(tabId);
}
