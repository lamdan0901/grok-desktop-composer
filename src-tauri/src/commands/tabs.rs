use crate::commands::settings::read_settings;
use crate::grok::process_manager::ProcessManager;
use tauri::{AppHandle, State};

#[tauri::command]
pub fn start_tab(
    app: AppHandle,
    pm: State<'_, ProcessManager>,
    tab_id: String,
    cwd: Option<String>,
) -> Result<(), String> {
    let settings = read_settings(&app)?;
    pm.start_tab(tab_id, cwd, &settings)
}

#[tauri::command]
pub fn stop_tab(pm: State<'_, ProcessManager>, tab_id: String) -> Result<(), String> {
    pm.stop_tab(&tab_id)
}

#[tauri::command]
pub fn restart_tab(
    app: AppHandle,
    pm: State<'_, ProcessManager>,
    tab_id: String,
) -> Result<(), String> {
    let settings = read_settings(&app)?;
    pm.restart_tab(tab_id, &settings)
}

#[tauri::command]
pub fn acp_write(
    pm: State<'_, ProcessManager>,
    tab_id: String,
    line: String,
) -> Result<(), String> {
    pm.write_line(&tab_id, line)
}

#[tauri::command]
pub fn list_running_tabs(pm: State<'_, ProcessManager>) -> Result<Vec<String>, String> {
    pm.running_tab_ids()
}
