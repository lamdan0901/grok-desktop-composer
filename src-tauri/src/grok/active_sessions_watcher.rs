use notify::event::{ModifyKind, RenameMode};
use notify::{Config, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::mpsc;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveGrokSession {
    pub session_id: String,
    pub pid: u32,
    pub cwd: String,
    pub opened_at: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveSessionsChangedPayload {
    pub sessions: Vec<ActiveGrokSession>,
}

struct WatcherHandle {
    _watcher: RecommendedWatcher,
}

pub struct ActiveSessionsWatcherManager {
    app: AppHandle,
    watch: Mutex<Option<WatcherHandle>>,
}

impl ActiveSessionsWatcherManager {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            watch: Mutex::new(None),
        }
    }

    fn grok_home() -> PathBuf {
        let base = std::env::var("USERPROFILE")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("C:\\Users"));
        base.join(".grok")
    }

    fn active_sessions_path() -> PathBuf {
        Self::grok_home().join("active_sessions.json")
    }

    pub fn read_active_sessions() -> Vec<ActiveGrokSession> {
        let path = Self::active_sessions_path();
        if !path.is_file() {
            return Vec::new();
        }
        let raw = match fs::read_to_string(&path) {
            Ok(s) => s,
            Err(_) => return Vec::new(),
        };
        serde_json::from_str(&raw).unwrap_or_default()
    }

    fn emit_snapshot(app: &AppHandle) {
        let sessions = Self::read_active_sessions();
        let payload = ActiveSessionsChangedPayload { sessions };
        let _ = app.emit("active-sessions-changed", payload);
    }

    pub fn start_watch(&self) -> Result<(), String> {
        let mut slot = self.watch.lock().map_err(|e| e.to_string())?;
        if slot.is_some() {
            Self::emit_snapshot(&self.app);
            return Ok(());
        }

        let grok_home = Self::grok_home();
        let active_path = Self::active_sessions_path();
        fs::create_dir_all(&grok_home).ok();

        let (tx, rx) = mpsc::channel();
        let mut watcher = RecommendedWatcher::new(tx, Config::default())
            .map_err(|e| format!("Failed to start active sessions watcher: {e}"))?;

        watcher
            .watch(&grok_home, RecursiveMode::NonRecursive)
            .map_err(|e| format!("Failed to watch .grok directory: {e}"))?;

        let app = self.app.clone();
        std::thread::spawn(move || {
            while let Ok(Ok(event)) = rx.recv() {
                let relevant = matches!(
                    event.kind,
                    EventKind::Modify(ModifyKind::Data(_))
                        | EventKind::Modify(ModifyKind::Metadata(_))
                        | EventKind::Create(_)
                        | EventKind::Modify(ModifyKind::Name(RenameMode::Any))
                );
                if !relevant {
                    continue;
                }

                let touched = event.paths.iter().any(|p| p == &active_path);
                if !touched && !active_path.exists() {
                    continue;
                }

                std::thread::sleep(Duration::from_millis(50));
                ActiveSessionsWatcherManager::emit_snapshot(&app);
            }
        });

        *slot = Some(WatcherHandle { _watcher: watcher });
        Self::emit_snapshot(&self.app);
        Ok(())
    }

    pub fn stop_watch(&self) {
        if let Ok(mut slot) = self.watch.lock() {
            slot.take();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::ActiveSessionsWatcherManager;

    #[test]
    fn reads_active_sessions_without_panic() {
        let _ = ActiveSessionsWatcherManager::read_active_sessions();
    }
}