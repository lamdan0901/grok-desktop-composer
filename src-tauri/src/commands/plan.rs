use crate::grok::plan_watcher::PlanWatcherManager;
use tauri::State;

#[tauri::command]
pub fn resolve_plan_path(cwd: String, grok_session_id: String) -> String {
    PlanWatcherManager::resolve_plan_path(&cwd, &grok_session_id)
        .to_string_lossy()
        .into_owned()
}

#[tauri::command]
pub fn read_plan_file(path: String) -> Result<String, String> {
    PlanWatcherManager::read_plan_file(&path)
}

#[tauri::command]
pub fn watch_plan_file(
    pm: State<'_, PlanWatcherManager>,
    tab_id: String,
    path: String,
) -> Result<(), String> {
    pm.watch_plan(tab_id, path)
}

#[tauri::command]
pub fn unwatch_plan_file(
    pm: State<'_, PlanWatcherManager>,
    tab_id: String,
) -> Result<(), String> {
    pm.unwatch(&tab_id)
}

#[tauri::command]
pub fn grok_sessions_root() -> Result<String, String> {
    let base = std::env::var("USERPROFILE")
        .map(std::path::PathBuf::from)
        .map_err(|e| e.to_string())?;
    Ok(base.join(".grok").join("sessions").to_string_lossy().into_owned())
}