use crate::commands::settings::read_settings;
use crate::grok::cli::GrokCli;
use crate::grok::signals_watcher::SignalsWatcherManager;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GrokSessionEntry {
    pub id: String,
    pub summary: String,
    pub created: Option<String>,
    pub updated: Option<String>,
    pub status: Option<String>,
    pub cwd: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SummaryInfo {
    cwd: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GrokSessionMeta {
    pub title: Option<String>,
    pub model_id: Option<String>,
    pub agent_name: Option<String>,
    pub cwd: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub num_chat_messages: Option<u64>,
    pub head_branch: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SummaryFile {
    info: Option<SummaryInfo>,
    #[serde(default)]
    session_summary: Option<String>,
    #[serde(default)]
    generated_title: Option<String>,
    #[serde(default)]
    current_model_id: Option<String>,
    #[serde(default)]
    agent_name: Option<String>,
    #[serde(default)]
    created_at: Option<String>,
    #[serde(default)]
    updated_at: Option<String>,
    #[serde(default)]
    num_chat_messages: Option<u64>,
    #[serde(default)]
    head_branch: Option<String>,
}

fn sessions_root() -> PathBuf {
    let base = std::env::var("USERPROFILE")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("C:\\Users"));
    base.join(".grok").join("sessions")
}

fn is_uuid(s: &str) -> bool {
    let parts: Vec<&str> = s.split('-').collect();
    if parts.len() != 5 {
        return false;
    }
    let lens = [8, 4, 4, 4, 12];
    parts
        .iter()
        .zip(lens.iter())
        .all(|(p, &len)| p.len() == len && p.chars().all(|c| c.is_ascii_hexdigit()))
}

fn decode_cwd_dir(name: &str) -> Option<String> {
    let decoded = urlencoding::decode(name).ok()?;
    Some(decoded.into_owned())
}

fn read_session_title(session_dir: &Path) -> Option<String> {
    let path = session_dir.join("summary.json");
    let raw = fs::read_to_string(&path).ok()?;
    let summary: SummaryFile = serde_json::from_str(&raw).ok()?;
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

fn read_session_meta(session_dir: &Path) -> Option<GrokSessionMeta> {
    let path = session_dir.join("summary.json");
    let raw = fs::read_to_string(&path).ok()?;
    let summary: SummaryFile = serde_json::from_str(&raw).ok()?;
    let cwd = summary
        .info
        .as_ref()
        .and_then(|i| i.cwd.clone())
        .filter(|c| !c.is_empty());
    Some(GrokSessionMeta {
        title: read_session_title(session_dir),
        model_id: summary.current_model_id.filter(|m| !m.is_empty()),
        agent_name: summary.agent_name.filter(|a| !a.is_empty()),
        cwd,
        created_at: summary.created_at.filter(|s| !s.is_empty()),
        updated_at: summary.updated_at.filter(|s| !s.is_empty()),
        num_chat_messages: summary.num_chat_messages,
        head_branch: summary.head_branch.filter(|b| !b.is_empty()),
    })
}

fn read_summary_meta(session_dir: &Path) -> Option<(String, String)> {
    let path = session_dir.join("summary.json");
    let raw = fs::read_to_string(&path).ok()?;
    let summary: SummaryFile = serde_json::from_str(&raw).ok()?;
    let cwd = summary.info.as_ref().and_then(|i| i.cwd.clone())?;
    let title = read_session_title(session_dir).unwrap_or_else(|| "Session".to_string());
    Some((cwd, title))
}

fn build_session_index() -> HashMap<String, (String, String)> {
    let root = sessions_root();
    let mut index = HashMap::new();
    let Ok(cwd_dirs) = fs::read_dir(&root) else {
        return index;
    };

    for cwd_entry in cwd_dirs.flatten() {
        let encoded_name = cwd_entry.file_name().to_string_lossy().into_owned();
        let fallback_cwd = decode_cwd_dir(&encoded_name);

        let Ok(session_dirs) = fs::read_dir(cwd_entry.path()) else {
            continue;
        };
        for session_entry in session_dirs.flatten() {
            let path = session_entry.path();
            if !path.is_dir() {
                continue;
            }
            let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
                continue;
            };
            if !is_uuid(name) {
                continue;
            }
            if let Some((cwd, title)) = read_summary_meta(&path) {
                index.insert(name.to_string(), (cwd, title));
            } else if let Some(cwd) = fallback_cwd.clone() {
                index.insert(name.to_string(), (cwd, "Session".to_string()));
            }
        }
    }
    index
}

fn parse_sessions_table(stdout: &str) -> Vec<GrokSessionEntry> {
    let index = build_session_index();
    let mut entries = Vec::new();

    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty()
            || line.starts_with("SESSION ID")
            || line.starts_with('(')
            || line.eq_ignore_ascii_case("no sessions found")
        {
            continue;
        }

        let mut parts = line.split_whitespace();
        let id = parts.next().unwrap_or("").to_string();
        if !is_uuid(&id) {
            continue;
        }

        let created = parts.next().map(|s| s.to_string());
        let updated = parts.next().map(|s| s.to_string());
        let status = parts.next().map(|s| s.to_string());
        let summary: String = parts.collect::<Vec<_>>().join(" ");

        let (cwd, indexed_title) = index.get(&id).cloned().unwrap_or_default();
        let summary = if summary.is_empty() {
            indexed_title
        } else {
            summary
        };

        entries.push(GrokSessionEntry {
            id,
            summary,
            created,
            updated,
            status,
            cwd: if cwd.is_empty() { None } else { Some(cwd) },
        });
    }

    entries
}

#[tauri::command]
pub fn list_grok_sessions(
    app: AppHandle,
    limit: Option<u32>,
    query: Option<String>,
) -> Result<Vec<GrokSessionEntry>, String> {
    let settings = read_settings(&app)?;
    let grok = GrokCli::resolve(&settings)?;
    let limit = limit.unwrap_or(30).clamp(1, 100);
    let mut args: Vec<&str> = vec!["sessions"];
    let q = query.as_deref().unwrap_or("").trim();
    if q.is_empty() {
        args.push("list");
    } else {
        args.push("search");
        args.push(q);
    }
    args.push("-n");
    let limit_str = limit.to_string();
    args.push(&limit_str);

    let output = grok.run_capture(&args)?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("grok sessions failed: {stderr}"));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(parse_sessions_table(&stdout))
}

#[tauri::command]
pub fn export_grok_session(
    app: AppHandle,
    session_id: String,
    output_path: String,
) -> Result<(), String> {
    let settings = read_settings(&app)?;
    let grok = GrokCli::resolve(&settings)?;
    let output = grok.run_capture(&["export", &session_id, &output_path])?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("grok export failed: {stderr}"));
    }
    Ok(())
}

#[tauri::command]
pub fn resolve_grok_session_cwd(session_id: String) -> Result<Option<String>, String> {
    let index = build_session_index();
    Ok(index.get(&session_id).map(|(cwd, _)| cwd.clone()))
}

/// Title from `summary.json` (`generated_title` / `session_summary`) — same as `/session-info` and `grok sessions list`.
#[tauri::command]
pub fn get_grok_session_title(
    grok_session_id: String,
    cwd: Option<String>,
) -> Result<Option<String>, String> {
    if grok_session_id.is_empty() {
        return Ok(None);
    }
    let dir = find_session_dir(
        &grok_session_id,
        cwd.as_deref().filter(|c| !c.is_empty()),
    );
    Ok(dir.as_deref().and_then(read_session_title))
}

/// Metadata from `summary.json` — model, agent, cwd, message counts (same family as `/session-info`).
#[tauri::command]
pub fn get_grok_session_meta(
    grok_session_id: String,
    cwd: Option<String>,
) -> Result<Option<GrokSessionMeta>, String> {
    if grok_session_id.is_empty() {
        return Ok(None);
    }
    let dir = find_session_dir(
        &grok_session_id,
        cwd.as_deref().filter(|c| !c.is_empty()),
    );
    Ok(dir.as_deref().and_then(read_session_meta))
}

fn file_mtime_ms(path: &Path) -> Option<i64> {
    let modified = fs::metadata(path).ok()?.modified().ok()?;
    let duration = modified.duration_since(UNIX_EPOCH).ok()?;
    Some(duration.as_millis() as i64)
}

fn session_dir_last_active_ms(dir: &Path) -> Option<i64> {
    let mut best = file_mtime_ms(dir);
    for name in ["chat_history.jsonl", "updates.jsonl", "summary.json"] {
        let path = dir.join(name);
        if path.is_file() {
            if let Some(ms) = file_mtime_ms(&path) {
                best = Some(best.map(|b| b.max(ms)).unwrap_or(ms));
            }
        }
    }
    best
}

fn find_session_dir(grok_session_id: &str, cwd: Option<&str>) -> Option<PathBuf> {
    let root = sessions_root();
    if let Some(cwd) = cwd {
        let encoded = urlencoding::encode(cwd);
        let dir = root.join(encoded.as_ref()).join(grok_session_id);
        if dir.is_dir() {
            return Some(dir);
        }
    }
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

#[tauri::command]
pub fn grok_session_last_active_ms(
    grok_session_id: String,
    cwd: Option<String>,
) -> Result<Option<i64>, String> {
    if grok_session_id.is_empty() {
        return Ok(None);
    }
    let dir = find_session_dir(
        &grok_session_id,
        cwd.as_deref().filter(|c| !c.is_empty()),
    );
    Ok(dir.as_deref().and_then(session_dir_last_active_ms))
}

#[tauri::command]
pub fn read_grok_chat_history(
    grok_session_id: String,
    cwd: Option<String>,
) -> Result<Option<String>, String> {
    if grok_session_id.is_empty() {
        return Ok(None);
    }

    let path = SignalsWatcherManager::resolve_session_file_by_id(
        &grok_session_id,
        "chat_history.jsonl",
    )
    .or_else(|| {
        cwd.as_deref().and_then(|c| {
            SignalsWatcherManager::resolve_chat_history_path(c, &grok_session_id)
        })
    });

    let Some(path) = path else {
        return Ok(None);
    };

    fs::read_to_string(&path)
        .map(Some)
        .map_err(|e| format!("Failed to read {}: {e}", path.display()))
}

#[tauri::command]
pub fn read_grok_updates_jsonl(
    grok_session_id: String,
    cwd: Option<String>,
) -> Result<Option<String>, String> {
    if grok_session_id.is_empty() {
        return Ok(None);
    }

    let path = SignalsWatcherManager::resolve_session_file_by_id(
        &grok_session_id,
        "updates.jsonl",
    )
    .or_else(|| {
        cwd.as_deref().and_then(|c| {
            SignalsWatcherManager::resolve_chat_history_path(c, &grok_session_id)
                .and_then(|p| p.parent().map(|dir| dir.join("updates.jsonl")))
        })
    });

    let Some(path) = path else {
        return Ok(None);
    };

    fs::read_to_string(&path)
        .map(Some)
        .map_err(|e| format!("Failed to read {}: {e}", path.display()))
}