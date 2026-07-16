import { create } from "zustand";

export interface QueueItem {
  id: string;
  text: string;
  position?: number;
  status?: string;
}

interface QueueState {
  bySession: Record<string, QueueItem[]>;
  setSnapshot: (sessionId: string, items: QueueItem[]) => void;
  clearSession: (sessionId: string) => void;
}

export const useQueueStore = create<QueueState>((set) => ({
  bySession: {},
  setSnapshot: (sessionId, items) =>
    set((state) => ({ bySession: { ...state.bySession, [sessionId]: items } })),
  clearSession: (sessionId) =>
    set((state) => {
      const { [sessionId]: _removed, ...bySession } = state.bySession;
      return { bySession };
    }),
}));

export function ingestQueueSnapshot(sessionId: string, params: unknown): void {
  const value =
    params && typeof params === "object"
      ? (params as Record<string, unknown>)
      : {};
  const rows = Array.isArray(value.queue)
    ? value.queue
    : Array.isArray(value.items)
      ? value.items
      : [];
  const items = rows.flatMap((row, index) => {
    if (!row || typeof row !== "object") return [];
    const item = row as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id : "";
    const text =
      typeof item.text === "string"
        ? item.text
        : typeof item.prompt === "string"
          ? item.prompt
          : "";
    if (!id || !text) return [];
    return [{
      id,
      text,
      position: typeof item.position === "number" ? item.position : index,
      status: typeof item.status === "string" ? item.status : undefined,
    }];
  });
  useQueueStore.getState().setSnapshot(sessionId, items);
}
