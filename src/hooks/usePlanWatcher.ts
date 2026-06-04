import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import type { PlanChangedPayload } from "@/lib/grok";
import { syncPlanFromDisk } from "@/lib/plan";
import { usePlanStore } from "@/stores/planStore";
import {
  getSessionCwd,
  useWorkspaceStore,
} from "@/stores/workspaceStore";

/**
 * Subscribes to Rust plan.md watcher events and loads plan files when review starts.
 */
export function usePlanWatcher() {
  const projects = useWorkspaceStore((s) => s.projects);
  const sessions = useWorkspaceStore((s) => s.sessions);

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      try {
        unlisten = await listen<PlanChangedPayload>("plan-changed", (e) => {
          const { tabId, path, content } = e.payload;
          usePlanStore.getState().setPlan(tabId, { path, content });
        });
        if (cancelled) {
          unlisten();
        }
      } catch {
        // vite-only preview
      }
    };

    void setup();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    for (const session of sessions) {
      if (session.status !== "plan_review") continue;
      const cwd = getSessionCwd(session, projects);
      if (!cwd || !session.grokSessionId) continue;

      const plan = usePlanStore.getState().bySession[session.id];
      if (plan?.content?.trim() && plan.path) continue;

      usePlanStore.getState().setLoading(session.id, true);
      void syncPlanFromDisk(session.id, cwd, session.grokSessionId).catch(
        (err: unknown) => {
          const message =
            err instanceof Error ? err.message : "Failed to load plan";
          usePlanStore.getState().setError(session.id, message);
        },
      );
    }
  }, [sessions, projects]);
}