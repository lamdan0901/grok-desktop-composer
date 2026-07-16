mod commands;
mod grok;

use commands::active_sessions::{
    read_active_grok_sessions, start_active_sessions_watch,
};
use commands::fs::{list_project_files, read_project_image, read_text_file, write_text_file};
use commands::auth::{check_auth, run_grok_login, run_grok_logout};
use commands::cli::{check_cli_ready, grok_version};
use commands::extensions::{list_grok_skills, read_grok_skill};
use commands::models::list_grok_models;
use commands::plan::{
    grok_sessions_root, read_plan_file, resolve_plan_path, unwatch_plan_file, watch_plan_file,
};
use commands::signals::{
    read_session_signals, read_session_signals_at_path, resolve_signals_path,
    resolve_signals_path_by_id, unwatch_session_signals, watch_grok_session,
    watch_session_signals,
};
use commands::sessions::{
    export_grok_session, get_grok_session_meta, get_grok_session_title,
    grok_session_last_active_ms, list_grok_sessions, read_grok_chat_history,
    read_grok_updates_jsonl, resolve_grok_session_cwd,
};
use commands::settings::{get_settings, set_settings};
use commands::tabs::{acp_write, list_running_tabs, restart_tab, start_tab, stop_tab};
use grok::active_sessions_watcher::ActiveSessionsWatcherManager;
use grok::plan_watcher::PlanWatcherManager;
use grok::process_manager::ProcessManager;
use grok::signals_watcher::SignalsWatcherManager;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let handle = app.handle().clone();
            app.manage(ProcessManager::new(handle.clone()));
            app.manage(PlanWatcherManager::new(handle.clone()));
            app.manage(SignalsWatcherManager::new(handle.clone()));
            let active_mgr = ActiveSessionsWatcherManager::new(handle);
            active_mgr
                .start_watch()
                .map_err(|e| format!("active sessions watcher: {e}"))?;
            app.manage(active_mgr);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_settings,
            set_settings,
            grok_version,
            check_cli_ready,
            check_auth,
            list_grok_models,
            run_grok_login,
            run_grok_logout,
            start_tab,
            stop_tab,
            restart_tab,
            acp_write,
            list_running_tabs,
            resolve_plan_path,
            read_plan_file,
            watch_plan_file,
            unwatch_plan_file,
            grok_sessions_root,
            list_grok_sessions,
            export_grok_session,
            get_grok_session_title,
            get_grok_session_meta,
            resolve_grok_session_cwd,
            grok_session_last_active_ms,
            read_grok_chat_history,
            read_grok_updates_jsonl,
            resolve_signals_path,
            resolve_signals_path_by_id,
            read_session_signals,
            read_session_signals_at_path,
            watch_session_signals,
            watch_grok_session,
            unwatch_session_signals,
            read_active_grok_sessions,
            start_active_sessions_watch,
            read_text_file,
            write_text_file,
            list_project_files,
            read_project_image,
            list_grok_skills,
            read_grok_skill,
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                if let Some(pm) = app.try_state::<ProcessManager>() {
                    pm.stop_all();
                }
                if let Some(plan_pm) = app.try_state::<PlanWatcherManager>() {
                    plan_pm.unwatch_all();
                }
                if let Some(signals_pm) = app.try_state::<SignalsWatcherManager>() {
                    signals_pm.unwatch_all();
                }
                if let Some(active_pm) = app.try_state::<ActiveSessionsWatcherManager>() {
                    active_pm.stop_watch();
                }
            }
        });
}
