use crate::grok::signals_watcher::{SessionSignals, SignalsWatcherManager};
use tauri::State;

#[tauri::command]
pub fn resolve_signals_path(cwd: String, grok_session_id: String) -> Option<String> {
    SignalsWatcherManager::resolve_signals_path(&cwd, &grok_session_id)
        .map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn resolve_signals_path_by_id(grok_session_id: String) -> Option<String> {
    SignalsWatcherManager::resolve_signals_path_by_id(&grok_session_id)
        .map(|p| p.to_string_lossy().into_owned())
}

#[tauri::command]
pub fn read_session_signals(cwd: String, grok_session_id: String) -> Result<SessionSignals, String> {
    SignalsWatcherManager::read_signals_for_session(&cwd, &grok_session_id)
}

#[tauri::command]
pub fn read_session_signals_at_path(path: String) -> Result<SessionSignals, String> {
    SignalsWatcherManager::read_signals_at_path(&path)
}

#[tauri::command]
pub fn watch_session_signals(
    sm: State<'_, SignalsWatcherManager>,
    tab_id: String,
    path: String,
) -> Result<(), String> {
    sm.watch_signals(tab_id, path)
}

#[tauri::command]
pub fn watch_grok_session(
    sm: State<'_, SignalsWatcherManager>,
    tab_id: String,
    cwd: String,
    grok_session_id: String,
) -> Result<(), String> {
    sm.watch_grok_session(tab_id, &cwd, &grok_session_id)
}

#[tauri::command]
pub fn unwatch_session_signals(
    sm: State<'_, SignalsWatcherManager>,
    tab_id: String,
) -> Result<(), String> {
    sm.unwatch(&tab_id)
}