use notify::event::{ModifyKind, RenameMode};
use notify::{Config, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanChangedPayload {
    pub tab_id: String,
    pub path: String,
    pub content: String,
}

struct TabWatch {
    _watcher: RecommendedWatcher,
}

pub struct PlanWatcherManager {
    app: AppHandle,
    watches: Mutex<HashMap<String, TabWatch>>,
}

impl PlanWatcherManager {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            watches: Mutex::new(HashMap::new()),
        }
    }

    pub fn resolve_plan_path(cwd: &str, grok_session_id: &str) -> PathBuf {
        let base = std::env::var("USERPROFILE")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("C:\\Users"));
        let encoded = urlencoding::encode(cwd);
        base.join(".grok")
            .join("sessions")
            .join(encoded.as_ref())
            .join(grok_session_id)
            .join("plan.md")
    }

    pub fn read_plan_file(path: &str) -> Result<String, String> {
        let p = Path::new(path);
        if !p.is_file() {
            return Ok(String::new());
        }
        std::fs::read_to_string(p).map_err(|e| format!("Failed to read plan.md: {e}"))
    }

    pub fn watch_plan(&self, tab_id: String, path: String) -> Result<(), String> {
        self.unwatch(&tab_id)?;

        let plan_path = PathBuf::from(&path);
        let watch_target = if plan_path.is_file() {
            plan_path
                .parent()
                .map(Path::to_path_buf)
                .unwrap_or_else(|| plan_path.clone())
        } else if let Some(parent) = plan_path.parent() {
            parent.to_path_buf()
        } else {
            return Err("Invalid plan path".to_string());
        };

        let (tx, rx) = mpsc::channel();
        let mut watcher = RecommendedWatcher::new(tx, Config::default())
            .map_err(|e| format!("Failed to start plan watcher: {e}"))?;

        watcher
            .watch(&watch_target, RecursiveMode::NonRecursive)
            .map_err(|e| format!("Failed to watch plan directory: {e}"))?;

        let app = self.app.clone();
        let tab = tab_id.clone();
        let watched_file = plan_path.clone();

        std::thread::spawn(move || {
            while let Ok(Ok(event)) = rx.recv() {
                let relevant = match event.kind {
                    EventKind::Modify(ModifyKind::Data(_))
                    | EventKind::Modify(ModifyKind::Metadata(_))
                    | EventKind::Create(_)
                    | EventKind::Remove(_) => true,
                    EventKind::Modify(ModifyKind::Name(RenameMode::Any)) => true,
                    _ => false,
                };
                if !relevant {
                    continue;
                }

                let touched = event.paths.iter().any(|p| p == &watched_file);
                if !touched && !watched_file.exists() {
                    continue;
                }

                std::thread::sleep(Duration::from_millis(80));

                match PlanWatcherManager::read_plan_file(
                    watched_file.to_string_lossy().as_ref(),
                ) {
                    Ok(content) => {
                        let payload = PlanChangedPayload {
                            tab_id: tab.clone(),
                            path: watched_file.to_string_lossy().into_owned(),
                            content,
                        };
                        let _ = app.emit("plan-changed", payload);
                    }
                    Err(_) => continue,
                }
            }
        });

        self.watches
            .lock()
            .map_err(|e| e.to_string())?
            .insert(tab_id.clone(), TabWatch { _watcher: watcher });

        if let Ok(content) = Self::read_plan_file(path.as_str()) {
            let payload = PlanChangedPayload {
                tab_id,
                path,
                content,
            };
            let _ = self.app.emit("plan-changed", payload);
        }

        Ok(())
    }

    pub fn unwatch(&self, tab_id: &str) -> Result<(), String> {
        let mut watches = self.watches.lock().map_err(|e| e.to_string())?;
        watches.remove(tab_id);
        Ok(())
    }

    pub fn unwatch_all(&self) {
        if let Ok(mut watches) = self.watches.lock() {
            watches.clear();
        }
    }
}