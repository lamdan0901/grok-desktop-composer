import { grokSessionLastActiveMs } from "@/lib/sessions";
import { useWorkspaceStore } from "@/stores/workspaceStore";

/** Fill missing `lastActiveAt` from on-disk Grok session files. */
export async function hydrateMissingSessionTimestamps(): Promise<void> {
  const { projects, sessions, setSessionLastActiveAt } =
    useWorkspaceStore.getState();

  await Promise.all(
    sessions.map(async (session) => {
      if (session.lastActiveAt != null && session.lastActiveAt > 0) return;
      if (!session.grokSessionId) return;

      const cwd = projects.find((p) => p.id === session.projectId)?.cwd;
      if (!cwd) return;

      try {
        const ms = await grokSessionLastActiveMs(session.grokSessionId, cwd);
        if (ms != null && ms > 0) {
          setSessionLastActiveAt(session.id, ms);
        }
      } catch {
        // Browser preview or missing session dir — leave timestamp unset.
      }
    }),
  );
}