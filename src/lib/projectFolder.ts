import { ask, message, open } from "@tauri-apps/plugin-dialog";

export async function pickProjectFolder(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Open project folder",
  });
  if (selected === null) return null;
  if (typeof selected === "string") return selected;
  return null;
}

export async function confirmRemoveProject(
  name: string,
  hasRunning: boolean,
): Promise<boolean> {
  const detail = hasRunning
    ? "Some threads still have work in progress. Remove this project from the sidebar anyway?"
    : "This removes the project from the sidebar. Your files on disk are not deleted.";
  try {
    return await ask(`Remove "${name}" from your projects?\n\n${detail}`, {
      title: "Remove project",
      kind: "warning",
    });
  } catch {
    return window.confirm(`Remove "${name}" from your projects?\n\n${detail}`);
  }
}

export async function confirmCloseRunningTab(title: string): Promise<boolean> {
  try {
    return await ask(
      `"${title}" still has a request in progress. Close this tab anyway?`,
      { title: "Close tab", kind: "warning" },
    );
  } catch {
    return window.confirm(
      `"${title}" still has a request in progress. Close this tab anyway?`,
    );
  }
}

export async function notifyMaxTabs(max: number): Promise<void> {
  return notifyMaxSessions(max);
}

export async function notifyMaxSessions(max: number): Promise<void> {
  try {
    await message(
      `You can run at most ${max} agents at the same time. Wait for or close a busy thread to continue.`,
      {
        title: "Agent limit",
        kind: "info",
      },
    );
  } catch {
    window.alert(
      `You can run at most ${max} agents at the same time. Wait for or close a busy thread to continue.`,
    );
  }
}