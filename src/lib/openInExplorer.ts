import { openPath as openerOpenPath, revealItemInDir } from "@tauri-apps/plugin-opener";

export async function openPathInExplorer(path: string): Promise<void> {
  try {
    await revealItemInDir(path);
  } catch {
    // Browser preview or permission denied
  }
}

/** Open a file (e.g. a task's output log) with the OS default application. */
export async function openPath(path: string): Promise<void> {
  try {
    await openerOpenPath(path);
  } catch {
    // Browser preview or permission denied
  }
}