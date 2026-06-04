use notify::event::{ModifyKind, RenameMode};
use notify::{Config, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionSignals {
    #[serde(default)]
    pub turn_count: u32,
    #[serde(default)]
    pub user_message_count: u32,
    #[serde(default)]
    pub tool_call_count: u32,
    #[serde(default)]
    pub context_window_usage: u32,
    #[serde(default)]
    pub context_tokens_used: u64,
    #[serde(default)]
    pub context_window_tokens: u64,
    #[serde(default)]
    pub compaction_count: u32,
    #[serde(default)]
    pub session_duration_seconds: u64,
    #[serde(default)]
    pub primary_model_id: Option<String>,
    #[serde(default)]
    pub models_used: Vec<String>,
    #[serde(default)]
    pub tools_used: Vec<String>,
    #[serde(default)]
    pub error_count: u32,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignalsChangedPayload {
    pub tab_id: String,
    pub signals: SessionSignals,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionTitleChangedPayload {
    pub tab_id: String,
    pub title: String,
}

#[derive(Debug, Deserialize)]
struct SummaryFileTitle {
    #[serde(default)]
    session_summary: Option<String>,
    #[serde(default)]
    generated_title: Option<String>,
}

struct TabWatch {
    _watcher: RecommendedWatcher,
}

pub struct SignalsWatcherManager {
    app: AppHandle,
    watches: Mutex<HashMap<String, TabWatch>>,
}

impl SignalsWatcherManager {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            watches: Mutex::new(HashMap::new()),
        }
    }

    fn sessions_root() -> PathBuf {
        let base = std::env::var("USERPROFILE")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("C:\\Users"));
        base.join(".grok").join("sessions")
    }

    fn dir_for_cwd(cwd: &str) -> PathBuf {
        let encoded = urlencoding::encode(cwd);
        Self::sessions_root().join(encoded.as_ref())
    }

    /// Grok may store sessions under several encodings of the same cwd (plain vs `\\?\` UNC).
    fn cwd_variants(cwd: &str) -> Vec<String> {
        let mut out = Vec::new();
        let mut push = |s: &str| {
            if !s.is_empty() && !out.iter().any(|v| v == s) {
                out.push(s.to_string());
            }
        };
        push(cwd);
        let normalized = cwd.replace('/', "\\");
        push(&normalized);
        if let Some(stripped) = normalized.strip_prefix(r"\\?\") {
            push(stripped);
        } else {
            push(&format!(r"\\?\{}", normalized));
        }
        out
    }

    pub fn resolve_signals_path(cwd: &str, grok_session_id: &str) -> Option<PathBuf> {
        if grok_session_id.is_empty() {
            return None;
        }

        for variant in Self::cwd_variants(cwd) {
            let direct = Self::dir_for_cwd(&variant)
                .join(grok_session_id)
                .join("signals.json");
            if direct.is_file() {
                return Some(direct);
            }
        }

        Self::resolve_signals_path_by_id(grok_session_id)
    }

    pub fn resolve_signals_path_by_id(grok_session_id: &str) -> Option<PathBuf> {
        Self::resolve_session_file_by_id(grok_session_id, "signals.json")
    }

    pub fn resolve_chat_history_path(cwd: &str, grok_session_id: &str) -> Option<PathBuf> {
        if grok_session_id.is_empty() {
            return None;
        }

        for variant in Self::cwd_variants(cwd) {
            let direct = Self::dir_for_cwd(&variant)
                .join(grok_session_id)
                .join("chat_history.jsonl");
            if direct.is_file() {
                return Some(direct);
            }
        }

        Self::resolve_session_file_by_id(grok_session_id, "chat_history.jsonl")
    }

    pub fn resolve_session_file_by_id(grok_session_id: &str, filename: &str) -> Option<PathBuf> {
        if grok_session_id.is_empty() {
            return None;
        }

        let root = Self::sessions_root();
        let Ok(cwd_dirs) = fs::read_dir(&root) else {
            return None;
        };
        for cwd_entry in cwd_dirs.flatten() {
            let candidate = cwd_entry.path().join(grok_session_id).join(filename);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
        None
    }

    pub fn read_signals(path: &str) -> Result<SessionSignals, String> {
        let p = Path::new(path);
        if !p.is_file() {
            return Err(format!("signals.json not found at {}", p.display()));
        }
        let raw = fs::read_to_string(p).map_err(|e| format!("Failed to read signals.json: {e}"))?;
        serde_json::from_str(&raw).map_err(|e| format!("Invalid signals.json: {e}"))
    }

    pub fn read_signals_for_session(cwd: &str, grok_session_id: &str) -> Result<SessionSignals, String> {
        let path = Self::resolve_signals_path(cwd, grok_session_id).ok_or_else(|| {
            format!("signals.json not found for session {grok_session_id}")
        })?;
        Self::read_signals(path.to_string_lossy().as_ref())
    }

    pub fn read_signals_at_path(path: &str) -> Result<SessionSignals, String> {
        Self::read_signals(path)
    }

    pub fn resolve_session_dir(cwd: &str, grok_session_id: &str) -> Option<PathBuf> {
        if grok_session_id.is_empty() {
            return None;
        }
        for variant in Self::cwd_variants(cwd) {
            let dir = Self::dir_for_cwd(&variant).join(grok_session_id);
            if dir.is_dir() {
                return Some(dir);
            }
        }
        let root = Self::sessions_root();
        let Ok(cwd_dirs) = fs::read_dir(&root) else {
            return None;
        };
        for cwd_entry in cwd_dirs.flatten() {
            let dir = cwd_entry.path().join(grok_session_id);
            if dir.is_dir() {
                return Some(dir);
            }
        }
        None
    }

    fn read_summary_title(summary_path: &Path) -> Option<String> {
        let raw = fs::read_to_string(summary_path).ok()?;
        let summary: SummaryFileTitle = serde_json::from_str(&raw).ok()?;
        let title = summary
            .generated_title
            .or(summary.session_summary)?
            .trim()
            .to_string();
        if title.is_empty() {
            None
        } else {
            Some(title)
        }
    }

    fn emit_title_if_present(app: &AppHandle, tab_id: &str, summary_path: &Path) {
        if let Some(title) = Self::read_summary_title(summary_path) {
            let payload = SessionTitleChangedPayload {
                tab_id: tab_id.to_string(),
                title,
            };
            let _ = app.emit("session-title-changed", payload);
        }
    }

    pub fn watch_grok_session(
        &self,
        tab_id: String,
        cwd: &str,
        grok_session_id: &str,
    ) -> Result<(), String> {
        let session_dir = Self::resolve_session_dir(cwd, grok_session_id)
            .ok_or_else(|| format!("Session directory not found for {grok_session_id}"))?;
        self.watch_session_dir(tab_id, session_dir)
    }

    /// Watch a Grok session folder for `signals.json` and `summary.json` updates.
    pub fn watch_session_dir(&self, tab_id: String, session_dir: PathBuf) -> Result<(), String> {
        self.unwatch(&tab_id)?;

        let signals_path = session_dir.join("signals.json");
        let summary_path = session_dir.join("summary.json");

        let (tx, rx) = mpsc::channel();
        let mut watcher = RecommendedWatcher::new(tx, Config::default())
            .map_err(|e| format!("Failed to start session watcher: {e}"))?;

        watcher
            .watch(&session_dir, RecursiveMode::NonRecursive)
            .map_err(|e| format!("Failed to watch session directory: {e}"))?;

        let app = self.app.clone();
        let tab = tab_id.clone();
        let signals_watch = signals_path.clone();
        let summary_watch = summary_path.clone();

        std::thread::spawn(move || {
            while let Ok(Ok(event)) = rx.recv() {
                // Ignore Remove — Grok often rewrites JSON atomically.
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

                let touched_signals = event.paths.iter().any(|p| p == &signals_watch);
                let touched_summary = event.paths.iter().any(|p| p == &summary_watch);
                if !touched_signals
                    && !touched_summary
                    && !signals_watch.exists()
                    && !summary_watch.exists()
                {
                    continue;
                }

                std::thread::sleep(Duration::from_millis(50));

                if touched_summary || summary_watch.exists() {
                    SignalsWatcherManager::emit_title_if_present(&app, &tab, &summary_watch);
                }

                if !touched_signals && !signals_watch.exists() {
                    continue;
                }

                match SignalsWatcherManager::read_signals(
                    signals_watch.to_string_lossy().as_ref(),
                ) {
                    Ok(signals) => {
                        let payload = SignalsChangedPayload {
                            tab_id: tab.clone(),
                            signals,
                        };
                        let _ = app.emit("signals-changed", payload);
                    }
                    Err(_) => continue,
                }
            }
        });

        self.watches
            .lock()
            .map_err(|e| e.to_string())?
            .insert(tab_id.clone(), TabWatch { _watcher: watcher });

        Self::emit_title_if_present(&self.app, &tab_id, &summary_path);

        if signals_path.is_file() {
            if let Ok(signals) = Self::read_signals(signals_path.to_string_lossy().as_ref()) {
                let payload = SignalsChangedPayload { tab_id, signals };
                let _ = self.app.emit("signals-changed", payload);
            }
        }

        Ok(())
    }

    pub fn watch_signals(&self, tab_id: String, path: String) -> Result<(), String> {
        let signals_path = PathBuf::from(&path);
        let session_dir = signals_path
            .parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| "Invalid signals path".to_string())?;
        self.watch_session_dir(tab_id, session_dir)
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

#[cfg(test)]
mod tests {
    use super::SignalsWatcherManager;

    #[test]
    fn resolves_known_session_by_id_scan() {
        let cwd = r"C:\Users\AndersonHo\Desktop\mine\test\desktop-composer";
        let id = "019e9105-d965-7ae2-9411-9d73c36d553d";
        let path = SignalsWatcherManager::resolve_signals_path(cwd, id)
            .or_else(|| SignalsWatcherManager::resolve_signals_path_by_id(id));
        assert!(
            path.is_some(),
            "expected signals.json for session {id} under ~/.grok/sessions"
        );
    }

    #[test]
    fn resolves_chat_history_for_active_desktop_composer_session() {
        let id = "019e9147-a242-7002-bdd0-fbc1919b2fc5";
        let path =
            SignalsWatcherManager::resolve_session_file_by_id(id, "chat_history.jsonl");
        assert!(
            path.as_ref().is_some_and(|p| p.is_file()),
            "expected chat_history.jsonl for session {id}"
        );
    }
}