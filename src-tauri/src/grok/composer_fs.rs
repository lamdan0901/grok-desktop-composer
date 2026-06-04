//! Parses Composer Write/StrReplace notifications (unit tests). Disk writes are
//! handled in the webview via `applyComposerFileTool` to avoid double-writes.
#![allow(dead_code)]

use crate::commands::fs::{read_text_file, write_text_file};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;

static APPLIED: Mutex<Option<HashMap<String, HashSet<String>>>> = Mutex::new(None);

fn applied() -> std::sync::MutexGuard<'static, Option<HashMap<String, HashSet<String>>>> {
    let mut guard = APPLIED.lock().expect("composer_fs lock");
    if guard.is_none() {
        *guard = Some(HashMap::new());
    }
    guard
}

pub fn clear_tab(tab_id: &str) {
    if let Some(map) = applied().as_mut() {
        map.remove(tab_id);
    }
}

fn already_applied(tab_id: &str, tool_call_id: &str) -> bool {
    let guard = applied();
    guard
        .as_ref()
        .and_then(|m| m.get(tab_id))
        .map(|s| s.contains(tool_call_id))
        .unwrap_or(false)
}

fn mark_applied(tab_id: &str, tool_call_id: &str) {
    if let Some(map) = applied().as_mut() {
        map.entry(tab_id.to_string())
            .or_default()
            .insert(tool_call_id.to_string());
    }
}

fn json_str<'a>(value: &'a Value, key: &str) -> Option<&'a str> {
    value.get(key).and_then(|v| v.as_str())
}

fn path_from_update(update: &Value) -> Option<String> {
    if let Some(path) = update
        .get("rawInput")
        .and_then(|r| json_str(r, "path"))
    {
        return Some(path.to_string());
    }
    if let Some(blocks) = update.get("content").and_then(|c| c.as_array()) {
        for block in blocks {
            if let Some(path) = block.get("path").and_then(|v| v.as_str()) {
                return Some(path.to_string());
            }
        }
    }
    update
        .get("locations")
        .and_then(|l| l.as_array())
        .and_then(|arr| arr.first())
        .and_then(|loc| json_str(loc, "path"))
        .map(|p| p.to_string())
}

fn diff_new_text(update: &Value) -> Option<String> {
    let blocks = update.get("content")?.as_array()?;
    for block in blocks {
        if json_str(block, "type") == Some("diff") {
            if let Some(text) = block.get("newText").and_then(|v| v.as_str()) {
                return Some(text.to_string());
            }
        }
    }
    None
}

fn contents_from_raw(raw: &Value, update: &Value) -> Option<String> {
    raw.get("contents")
        .or_else(|| raw.get("content"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| diff_new_text(update))
}

/// True when this `session/update` line looks like a Composer Write/StrReplace notification.
fn is_file_tool_update(update: &Value) -> bool {
    let session_update = match json_str(update, "sessionUpdate") {
        Some(s) => s,
        None => return false,
    };
    if session_update != "tool_call" && session_update != "tool_call_update" {
        return false;
    }
    if path_from_update(update).is_none() {
        return false;
    }
    let raw = match update.get("rawInput") {
        Some(r) => r,
        None => return diff_new_text(update).is_some(),
    };
    let variant = raw.get("variant").and_then(|v| v.as_str());
    if variant == Some("CursorWrite") || variant == Some("CursorStrReplace") {
        return true;
    }
    if contents_from_raw(raw, update).is_some() {
        return true;
    }
    raw.get("new_string")
        .or_else(|| raw.get("newString"))
        .and_then(|v| v.as_str())
        .is_some()
}

/// Apply Cursor Write/StrReplace tool notifications to disk (Grok expects the ACP client to do this).
pub fn try_apply_tool_notification(
    tab_id: &str,
    cwd: Option<&str>,
    line: &str,
) -> Option<String> {
    let msg: Value = match serde_json::from_str(line) {
        Ok(v) => v,
        Err(_) => return None,
    };
    if json_str(&msg, "method")? != "session/update" {
        return None;
    }
    let update = msg.get("params")?.get("update")?;
    if !is_file_tool_update(update) {
        return None;
    }

    let root = match cwd.filter(|c| !c.trim().is_empty()) {
        Some(r) => r,
        None => {
            return Some(
                "No project folder for this thread — reopen the project and try again.".into(),
            );
        }
    };

    let session_update = json_str(update, "sessionUpdate")?;
    if session_update != "tool_call" && session_update != "tool_call_update" {
        return None;
    }
    let tool_call_id = json_str(update, "toolCallId")?;
    if already_applied(tab_id, tool_call_id) {
        return None;
    }

    let path = path_from_update(update)?;
    let raw = update.get("rawInput");
    let variant = raw
        .and_then(|r| r.get("variant"))
        .and_then(|v| v.as_str());

    let result = match variant {
        Some("CursorWrite") => {
            let content = contents_from_raw(raw?, update)?;
            write_text_file(path.clone(), root.to_string(), content)
        }
        Some("CursorStrReplace") => {
            let r = raw?;
            let old_string = r
                .get("old_string")
                .or_else(|| r.get("oldString"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let new_string = r
                .get("new_string")
                .or_else(|| r.get("newString"))
                .and_then(|v| v.as_str())?;
            let existing =
                read_text_file(path.clone(), root.to_string(), None, None).unwrap_or_default();
            let next = if !old_string.is_empty() && existing.contains(old_string) {
                existing.replacen(old_string, new_string, 1)
            } else {
                new_string.to_string()
            };
            write_text_file(path.clone(), root.to_string(), next)
        }
        _ => {
            if let Some(r) = raw {
                if let Some(content) = contents_from_raw(r, update) {
                    return match write_text_file(path.clone(), root.to_string(), content) {
                        Ok(()) => {
                            mark_applied(tab_id, tool_call_id);
                            None
                        }
                        Err(e) => Some(format!("Failed to write {path}: {e}")),
                    };
                }
            }
            if let Some(content) = diff_new_text(update) {
                write_text_file(path.clone(), root.to_string(), content)
            } else {
                return None;
            }
        }
    };

    match result {
        Ok(()) => {
            mark_applied(tab_id, tool_call_id);
            None
        }
        Err(e) => Some(format!("Failed to write {path}: {e}")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::fs;

    fn session_line(update: Value) -> String {
        serde_json::json!({
            "method": "session/update",
            "params": { "update": update }
        })
        .to_string()
    }

    fn real_tool_call_line(path: &str) -> String {
        session_line(serde_json::json!({
            "sessionUpdate": "tool_call",
            "toolCallId": "call-test",
            "title": "Write",
            "rawInput": {
                "path": path,
                "contents": "hello from real log"
            }
        }))
    }

    fn real_tool_call_update_line(path: &str) -> String {
        session_line(serde_json::json!({
            "sessionUpdate": "tool_call_update",
            "toolCallId": "call-test",
            "kind": "edit",
            "locations": [{ "path": path }],
            "rawInput": {
                "variant": "CursorWrite",
                "path": path,
                "contents": "hello from real log"
            }
        }))
    }

    fn temp_root(name: &str) -> std::path::PathBuf {
        env::temp_dir().join(name)
    }

    #[test]
    fn applies_cursor_write_from_session_update_line() {
        clear_tab("tab-1");
        let root = temp_root("dc_composer_fs_test");
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let file = root.join("test-write.txt");
        let path = file.to_string_lossy();
        let line = real_tool_call_update_line(&path);
        let err = try_apply_tool_notification(
            "tab-1",
            Some(root.to_string_lossy().as_ref()),
            &line,
        );
        assert!(err.is_none(), "expected Ok, got {err:?}");
        use crate::commands::fs::ensure_within_root;
        let resolved = ensure_within_root(&path, root.to_string_lossy().as_ref()).unwrap();
        assert_eq!(fs::read_to_string(&resolved).unwrap(), "hello from real log");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn direct_write_text_file_succeeds_for_absolute_path() {
        use crate::commands::fs::ensure_within_root;
        let root = temp_root("dc_composer_fs_direct");
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let target = root.join("test-write.txt");
        let path = target.to_string_lossy();
        let root_str = root.to_string_lossy();
        write_text_file(
            path.to_string(),
            root_str.to_string(),
            "direct".to_string(),
        )
        .expect("write_text_file should succeed");
        let resolved = ensure_within_root(&path, &root_str).unwrap();
        assert!(resolved.is_file(), "written file should exist at {}", resolved.display());
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn applies_real_tool_call_line_without_variant() {
        clear_tab("tab-real-call");
        let root = temp_root("dc_composer_fs_real_call");
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let target = root.join("test-write.txt");
        let path = target.to_string_lossy();
        let line = real_tool_call_line(&path);
        let err = try_apply_tool_notification(
            "tab-real-call",
            Some(root.to_string_lossy().as_ref()),
            &line,
        );
        assert!(err.is_none(), "expected Ok, got {err:?}");
        use crate::commands::fs::ensure_within_root;
        let resolved = ensure_within_root(&path, root.to_string_lossy().as_ref()).unwrap();
        assert_eq!(fs::read_to_string(&resolved).unwrap(), "hello from real log");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn applies_real_tool_call_update_line() {
        clear_tab("tab-real-update");
        let root = temp_root("dc_composer_fs_real_update");
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let target = root.join("test-write.txt");
        let path = target.to_string_lossy();
        let line = real_tool_call_update_line(&path);
        let err = try_apply_tool_notification(
            "tab-real-update",
            Some(root.to_string_lossy().as_ref()),
            &line,
        );
        assert!(err.is_none(), "expected Ok, got {err:?}");
        use crate::commands::fs::ensure_within_root;
        let resolved = ensure_within_root(&path, root.to_string_lossy().as_ref()).unwrap();
        assert_eq!(fs::read_to_string(&resolved).unwrap(), "hello from real log");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn writes_relative_path_under_project_root() {
        clear_tab("tab-rel");
        let root = temp_root("dc_composer_fs_relative");
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let line = r#"{"method":"session/update","params":{"update":{"sessionUpdate":"tool_call","toolCallId":"call-rel","title":"Write","rawInput":{"path":"out/test-write.txt","contents":"relative ok"}}}}"#;
        let err = try_apply_tool_notification(
            "tab-rel",
            Some(root.to_string_lossy().as_ref()),
            line,
        );
        assert!(err.is_none(), "expected Ok, got {err:?}");
        use crate::commands::fs::ensure_within_root;
        let resolved = ensure_within_root("out/test-write.txt", root.to_string_lossy().as_ref()).unwrap();
        assert_eq!(fs::read_to_string(&resolved).unwrap(), "relative ok");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn errors_when_project_cwd_missing() {
        clear_tab("tab-no-cwd");
        let line = real_tool_call_line(r"C:\temp\test-write.txt");
        let err = try_apply_tool_notification("tab-no-cwd", None, &line);
        assert!(
            err.as_ref()
                .unwrap_or(&String::new())
                .contains("No project folder"),
            "expected cwd error, got {err:?}"
        );
    }

    #[test]
    fn dedupes_second_notification_for_same_tool_call_id() {
        clear_tab("tab-dedupe");
        let root = temp_root("dc_composer_fs_dedupe");
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let target = root.join("once.txt");
        let path = target.to_string_lossy();
        let line = real_tool_call_line(&path);
        let cwd = root.to_string_lossy();
        assert!(try_apply_tool_notification("tab-dedupe", Some(cwd.as_ref()), &line).is_none());
        use crate::commands::fs::ensure_within_root;
        let resolved = ensure_within_root(&path, cwd.as_ref()).unwrap();
        assert_eq!(fs::read_to_string(&resolved).unwrap(), "hello from real log");
        let line2 = session_line(serde_json::json!({
            "sessionUpdate": "tool_call",
            "toolCallId": "call-test",
            "title": "Write",
            "rawInput": {
                "path": path,
                "contents": "should not overwrite"
            }
        }));
        assert!(try_apply_tool_notification("tab-dedupe", Some(cwd.as_ref()), &line2).is_none());
        assert_eq!(fs::read_to_string(&resolved).unwrap(), "hello from real log");
        let _ = fs::remove_dir_all(&root);
    }
}