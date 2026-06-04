use crate::grok::active_sessions_watcher::{
    ActiveGrokSession, ActiveSessionsWatcherManager,
};
use tauri::State;

#[tauri::command]
pub fn read_active_grok_sessions() -> Vec<ActiveGrokSession> {
    ActiveSessionsWatcherManager::read_active_sessions()
}

#[tauri::command]
pub fn start_active_sessions_watch(
    mgr: State<'_, ActiveSessionsWatcherManager>,
) -> Result<(), String> {
    mgr.start_watch()
}