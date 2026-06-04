import { save } from "@tauri-apps/plugin-dialog";
import { exportGrokSession } from "./sessions";

export async function exportSessionTranscript(
  grokSessionId: string,
  suggestedName: string,
): Promise<boolean> {
  const path = await save({
    title: "Export transcript",
    defaultPath: `${suggestedName.replace(/[^\w.-]+/g, "_")}.md`,
    filters: [{ name: "Markdown", extensions: ["md"] }],
  });
  if (!path) return false;
  await exportGrokSession(grokSessionId, path);
  return true;
}