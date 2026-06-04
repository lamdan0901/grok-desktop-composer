import { invoke } from "@tauri-apps/api/core";
import type { AppSettings } from "./types";

export async function fetchSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("get_settings");
}

export async function persistSettings(
  settings: AppSettings,
): Promise<AppSettings> {
  return invoke<AppSettings>("set_settings", { settings });
}