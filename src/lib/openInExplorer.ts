import { revealItemInDir } from "@tauri-apps/plugin-opener";

export async function openPathInExplorer(path: string): Promise<void> {
  try {
    await revealItemInDir(path);
  } catch {
    // Browser preview or permission denied
  }
}