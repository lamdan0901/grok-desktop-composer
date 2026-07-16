use base64::{engine::general_purpose::STANDARD, Engine as _};
use serde::Serialize;
use std::fs;
use std::path::{Component, Path, PathBuf};

fn strip_extended_path_prefix(path: &str) -> &str {
    path.strip_prefix(r"\\?\").unwrap_or(path)
}

fn path_buf_from_stripped(path: &Path) -> PathBuf {
    PathBuf::from(strip_extended_path_prefix(path.to_string_lossy().as_ref()))
}

fn normalize_path_key(path: &str) -> String {
    strip_extended_path_prefix(path)
        .replace('/', "\\")
        .trim_end_matches('\\')
        .to_lowercase()
}

/// Join `path` to `root` when relative; pass through absolute paths (after normalization).
fn resolve_against_root(path: &str, root_canon: &Path) -> PathBuf {
    let stripped = strip_extended_path_prefix(path);
    let file_path = PathBuf::from(stripped);
    if file_path.is_absolute() {
        file_path
    } else {
        root_canon.join(file_path)
    }
}

fn is_within_root(resolved: &Path, root_canon: &Path) -> bool {
    if resolved.starts_with(root_canon) {
        return true;
    }
    let root_key = normalize_path_key(root_canon.to_string_lossy().as_ref());
    let path_key = normalize_path_key(resolved.to_string_lossy().as_ref());
    path_key.starts_with(&root_key)
}

/// When the UI opened a nested subfolder that repeats the parent name (e.g.
/// `desktop-composer/desktop-composer`), Grok still targets the parent workspace.
fn workspace_root_for_writes(root_canon: &Path) -> PathBuf {
    if let Some(parent) = root_canon.parent() {
        if root_canon.file_name().is_some()
            && root_canon.file_name() == parent.file_name()
        {
            return path_buf_from_stripped(parent);
        }
    }
    root_canon.to_path_buf()
}

/// Allow agent absolute paths under the workspace directory that contains the project root.
fn allow_agent_workspace_path(file_path: &Path, root_canon: &Path) -> Option<PathBuf> {
    let file_parent = file_path.parent()?;
    let root_key = normalize_path_key(root_canon.to_string_lossy().as_ref());
    let parent_key = normalize_path_key(file_parent.to_string_lossy().as_ref());
    let file_key = normalize_path_key(file_path.to_string_lossy().as_ref());
    if root_key.starts_with(&parent_key)
        && root_key.len() > parent_key.len()
        && file_key.starts_with(&parent_key)
    {
        return Some(path_buf_from_stripped(file_path));
    }
    None
}

fn is_allowed_write_path(resolved: &Path, root_canon: &Path, write_root: &Path) -> bool {
    is_within_root(resolved, root_canon)
        || is_within_root(resolved, write_root)
        || allow_agent_workspace_path(resolved, root_canon).is_some()
}

/// Resolve `path` and ensure it stays under `root` (project cwd).
pub(crate) fn ensure_within_root(path: &str, root: &str) -> Result<PathBuf, String> {
    if root.trim().is_empty() {
        return Err("No project directory for this session".into());
    }

    let root_path = PathBuf::from(strip_extended_path_prefix(root));
    if !root_path.is_absolute() {
        return Err("Project root must be an absolute path".into());
    }

    let root_canon = path_buf_from_stripped(
        &root_path
            .canonicalize()
            .map_err(|e| format!("Invalid project root \"{root}\": {e}"))?,
    );

    let write_root = workspace_root_for_writes(&root_canon);
    let file_path = resolve_against_root(path, &write_root);

    // Reject `..` segments in relative paths before touching disk.
    for component in file_path.components() {
        if matches!(component, Component::ParentDir) {
            return Err("Path is outside the project directory".into());
        }
    }

    if file_path.is_absolute() && is_allowed_write_path(&file_path, &root_canon, &write_root) {
        return Ok(path_buf_from_stripped(&file_path));
    }

    let mut probe = file_path.as_path();
    let mut tail: Vec<std::ffi::OsString> = Vec::new();

    loop {
        if let Some(name) = probe.file_name() {
            tail.insert(0, name.to_os_string());
        }
        if probe.exists() {
            let resolved = if tail.is_empty() {
                path_buf_from_stripped(
                    &probe
                        .canonicalize()
                        .map_err(|e| format!("Invalid path \"{path}\": {e}"))?,
                )
            } else if !file_path.is_absolute() && write_root != root_canon {
                // Rebuild under write_root — canonicalize(probe) can pick a same-named
                // nested directory on Windows (e.g. proj/proj/file → inner proj).
                let mut rebuilt = write_root.clone();
                for part in &tail {
                    rebuilt.push(part);
                }
                rebuilt
            } else {
                let base = path_buf_from_stripped(
                    &probe
                        .canonicalize()
                        .map_err(|e| format!("Invalid path \"{path}\": {e}"))?,
                );
                let mut rebuilt = base;
                for part in &tail {
                    rebuilt.push(part);
                }
                rebuilt
            };
            if !is_allowed_write_path(&resolved, &root_canon, &write_root) {
                return Err("Path is outside the project directory".into());
            }
            return Ok(path_buf_from_stripped(&resolved));
        }
        match probe.parent() {
            Some(parent) if parent != probe => probe = parent,
            _ => break,
        }
    }

    if !is_allowed_write_path(&file_path, &root_canon, &write_root) {
        return Err("Path is outside the project directory".into());
    }

    Ok(path_buf_from_stripped(&file_path))
}

fn slice_lines(content: &str, line: Option<u32>, limit: Option<u32>) -> String {
    let start = line.unwrap_or(1).max(1) as usize;
    let start_idx = start.saturating_sub(1);
    let max_lines = limit.map(|n| n as usize);
    content
        .lines()
        .skip(start_idx)
        .take(max_lines.unwrap_or(usize::MAX))
        .collect::<Vec<_>>()
        .join("\n")
}

fn resolve_read_path(path: &str, root: &str) -> Result<PathBuf, String> {
    let file_path = PathBuf::from(strip_extended_path_prefix(path));
    if file_path.is_absolute() {
        return Ok(file_path);
    }
    if root.trim().is_empty() {
        return Err("No project directory for this session".into());
    }
    let root_path = PathBuf::from(strip_extended_path_prefix(root));
    if !root_path.is_absolute() {
        return Err("Project root must be an absolute path".into());
    }
    Ok(root_path.join(file_path))
}

fn image_mime_type(path: &Path) -> Result<&'static str, String> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    match extension.as_str() {
        "png" => Ok("image/png"),
        "jpg" | "jpeg" => Ok("image/jpeg"),
        "gif" => Ok("image/gif"),
        "webp" => Ok("image/webp"),
        "bmp" => Ok("image/bmp"),
        "svg" => Ok("image/svg+xml"),
        _ => Err(format!("Unsupported image type for \"{}\"", path.display())),
    }
}

fn is_same_or_descendant(path: &Path, root: &Path) -> bool {
    let path_key = normalize_path_key(path.to_string_lossy().as_ref());
    let root_key = normalize_path_key(root.to_string_lossy().as_ref());
    path_key == root_key
        || path_key
            .strip_prefix(&root_key)
            .is_some_and(|suffix| suffix.starts_with('\\'))
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectImage {
    pub mime_type: String,
    pub data: String,
}

#[tauri::command]
pub fn read_project_image(path: String, root: String) -> Result<ProjectImage, String> {
    if root.trim().is_empty() {
        return Err("No project directory for this session".into());
    }
    let root_path = PathBuf::from(strip_extended_path_prefix(&root));
    if !root_path.is_absolute() {
        return Err("Project root must be an absolute path".into());
    }
    let root_path = root_path
        .canonicalize()
        .map_err(|error| format!("Invalid project root \"{root}\": {error}"))?;
    let requested = PathBuf::from(strip_extended_path_prefix(&path));
    let requested = if requested.is_absolute() {
        requested
    } else {
        root_path.join(requested)
    };
    let resolved = requested
        .canonicalize()
        .map_err(|error| format!("Failed to read image \"{path}\": {error}"))?;
    if !is_same_or_descendant(&resolved, &root_path) {
        return Err("Path is outside the project directory".into());
    }
    let mime_type = image_mime_type(&resolved)?.to_string();
    let bytes = fs::read(&resolved)
        .map_err(|error| format!("Failed to read image \"{path}\": {error}"))?;
    Ok(ProjectImage {
        mime_type,
        data: STANDARD.encode(bytes),
    })
}

#[derive(Debug, Serialize)]
pub struct ProjectFileEntry {
    pub path: String,
    pub is_dir: bool,
}

#[tauri::command]
pub fn list_project_files(root: String) -> Result<Vec<ProjectFileEntry>, String> {
    if root.trim().is_empty() {
        return Err("No project directory for this session".into());
    }
    let root = PathBuf::from(strip_extended_path_prefix(&root));
    if !root.is_absolute() {
        return Err("Project root must be an absolute path".into());
    }
    let root = root
        .canonicalize()
        .map_err(|e| format!("Invalid project root \"{root:?}\": {e}"))?;
    // ponytail: cap at 5,000 entries; add an indexed matcher if large repos need more.
    let mut entries = Vec::new();
    let mut pending = vec![root.clone()];
    while let Some(directory) = pending.pop() {
        let Ok(read_dir) = fs::read_dir(&directory) else { continue };
        for entry in read_dir.flatten() {
            if entries.len() >= 5_000 {
                return Ok(entries);
            }
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().into_owned();
            if name == ".git" || name == "node_modules" || name == "target" {
                continue;
            }
            let Ok(file_type) = entry.file_type() else { continue };
            let relative = path
                .strip_prefix(&root)
                .unwrap_or(&path)
                .to_string_lossy()
                .replace('\\', "/");
            entries.push(ProjectFileEntry {
                path: relative,
                is_dir: file_type.is_dir(),
            });
            if file_type.is_dir() {
                pending.push(path);
            }
        }
    }
    entries.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(entries)
}

#[tauri::command]
pub fn read_text_file(
    path: String,
    root: String,
    line: Option<u32>,
    limit: Option<u32>,
) -> Result<String, String> {
    let resolved = resolve_read_path(&path, &root)?;
    let content = fs::read_to_string(&resolved)
        .map_err(|e| format!("Failed to read \"{path}\": {e}"))?;
    Ok(slice_lines(&content, line, limit))
}

fn is_retryable_write_error(err: &std::io::Error) -> bool {
    if err.kind() == std::io::ErrorKind::PermissionDenied {
        return true;
    }
    let msg = err.to_string().to_lowercase();
    msg.contains("os error 32")
        || msg.contains("being used by another process")
        || msg.contains("access is denied")
}

fn write_file_with_retry(resolved: &Path, content: &str, display_path: &str) -> Result<(), String> {
    const MAX_ATTEMPTS: u32 = 8;
    let mut last_err = String::new();
    for attempt in 0..MAX_ATTEMPTS {
        match fs::write(resolved, content) {
            Ok(()) => return Ok(()),
            Err(e) => {
                last_err = e.to_string();
                if !is_retryable_write_error(&e) || attempt + 1 >= MAX_ATTEMPTS {
                    return Err(format!("Failed to write \"{display_path}\": {last_err}"));
                }
                let delay_ms = 15u64.saturating_mul(1 << attempt.min(5));
                std::thread::sleep(std::time::Duration::from_millis(delay_ms));
            }
        }
    }
    Err(format!("Failed to write \"{display_path}\": {last_err}"))
}

#[tauri::command]
pub fn write_text_file(path: String, root: String, content: String) -> Result<(), String> {
    let resolved = ensure_within_root(&path, &root)?;
    if let Some(parent) = resolved.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directories: {e}"))?;
        }
    }
    write_file_with_retry(&resolved, &content, &path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn writes_new_file_under_root() {
        let root = env::temp_dir().join("dc_fs_write_test");
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let target = root.join("hello.txt");
        let path_str = target.to_string_lossy();
        let root_str = root.to_string_lossy();
        write_text_file(
            path_str.to_string(),
            root_str.to_string(),
            "hello".to_string(),
        )
        .unwrap();
        let resolved = ensure_within_root(&path_str, &root_str).unwrap();
        assert!(resolved.is_file());
        assert_eq!(fs::read_to_string(&resolved).unwrap(), "hello");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn writes_relative_path_under_root() {
        let root = env::temp_dir().join("dc_fs_relative_test");
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let root_str = root.to_string_lossy();
        write_text_file(
            "nested/out.txt".to_string(),
            root_str.to_string(),
            "relative".to_string(),
        )
        .unwrap();
        let resolved = ensure_within_root("nested/out.txt", &root_str).unwrap();
        assert_eq!(fs::read_to_string(&resolved).unwrap(), "relative");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn writes_to_parent_workspace_when_project_folder_is_nested_duplicate() {
        let parent = env::temp_dir().join("dc_fs_nested_parent");
        let root = parent.join("dc_fs_nested_parent");
        let _ = fs::remove_dir_all(&parent);
        fs::create_dir_all(&root).unwrap();
        let root_str = root.to_string_lossy();
        let agent_target = path_buf_from_stripped(
            &workspace_root_for_writes(&path_buf_from_stripped(
                &root.canonicalize().unwrap(),
            ))
            .join("test-write.txt"),
        );
        write_text_file(
            agent_target.to_string_lossy().to_string(),
            root_str.to_string(),
            "parent workspace".to_string(),
        )
        .unwrap();
        let resolved = ensure_within_root(&agent_target.to_string_lossy(), &root_str).unwrap();
        assert_eq!(fs::read_to_string(&resolved).unwrap(), "parent workspace");
        assert!(!root.join("test-write.txt").exists());
        let _ = fs::remove_dir_all(&parent);
    }

    #[test]
    fn writes_relative_to_parent_when_project_folder_is_nested_duplicate() {
        let parent = env::temp_dir().join("dc_fs_rel_parent");
        let root = parent.join("dc_fs_rel_parent");
        let _ = fs::remove_dir_all(&parent);
        fs::create_dir_all(&root).unwrap();
        let root_str = root.to_string_lossy();
        write_text_file(
            "test-write.txt".to_string(),
            root_str.to_string(),
            "relative parent".to_string(),
        )
        .unwrap();
        let resolved = ensure_within_root("test-write.txt", &root_str).unwrap();
        assert_eq!(
            fs::read_to_string(&resolved).unwrap(),
            "relative parent"
        );
        assert!(!root.join("test-write.txt").exists());
        let _ = fs::remove_dir_all(&parent);
    }

    #[test]
    fn rejects_parent_traversal_in_new_path() {
        let root = env::temp_dir().join("dc_fs_root_test");
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(&root).unwrap();
        let outside = env::temp_dir().join("dc_fs_outside_test");
        let bad = outside.join("secret.txt");
        let err = ensure_within_root(
            bad.to_string_lossy().as_ref(),
            root.to_string_lossy().as_ref(),
        )
        .unwrap_err();
        assert!(err.contains("outside"));
        let err_rel = ensure_within_root("../secret.txt", root.to_string_lossy().as_ref()).unwrap_err();
        assert!(err_rel.contains("outside"));
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn reads_existing_file_outside_root() {
        let root = env::temp_dir().join("dc_fs_read_root_test");
        let outside = env::temp_dir().join("dc_fs_read_outside_test.txt");
        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_file(&outside);
        fs::create_dir_all(&root).unwrap();
        fs::write(&outside, "outside content").unwrap();

        let result = read_text_file(
            outside.to_string_lossy().into_owned(),
            root.to_string_lossy().into_owned(),
            None,
            None,
        );

        assert_eq!(result.unwrap(), "outside content");
        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_file(&outside);
    }

    #[test]
    fn keeps_writes_restricted_to_root() {
        let root = env::temp_dir().join("dc_fs_write_restriction_root_test");
        let outside = env::temp_dir().join("dc_fs_write_restriction_outside_test.txt");
        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_file(&outside);
        fs::create_dir_all(&root).unwrap();

        let result = write_text_file(
            outside.to_string_lossy().into_owned(),
            root.to_string_lossy().into_owned(),
            "must not write".to_string(),
        );

        assert!(result.unwrap_err().contains("outside"));
        assert!(!outside.exists());
        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_file(&outside);
    }

    #[test]
    fn maps_supported_image_extensions_to_mime_types() {
        assert_eq!(image_mime_type(Path::new("a.png")).unwrap(), "image/png");
        assert_eq!(image_mime_type(Path::new("a.JPG")).unwrap(), "image/jpeg");
        assert_eq!(image_mime_type(Path::new("a.jpeg")).unwrap(), "image/jpeg");
        assert_eq!(image_mime_type(Path::new("a.gif")).unwrap(), "image/gif");
        assert_eq!(image_mime_type(Path::new("a.webp")).unwrap(), "image/webp");
        assert_eq!(image_mime_type(Path::new("a.bmp")).unwrap(), "image/bmp");
        assert_eq!(image_mime_type(Path::new("a.svg")).unwrap(), "image/svg+xml");
        assert!(image_mime_type(Path::new("a.txt")).unwrap_err().contains("Unsupported image type"));
    }

    #[test]
    fn reads_project_image_as_base64() {
        let root = env::temp_dir().join("dc_project_image_test");
        let _ = fs::remove_dir_all(&root);
        fs::create_dir_all(root.join("assets")).unwrap();
        fs::write(root.join("assets/example.png"), [0_u8, 1, 2]).unwrap();

        let image = read_project_image(
            "assets/example.png".to_string(),
            root.to_string_lossy().into_owned(),
        )
        .unwrap();

        assert_eq!(image.mime_type, "image/png");
        assert_eq!(image.data, "AAEC");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn rejects_missing_and_outside_project_images() {
        let root = env::temp_dir().join("dc_project_image_root_test");
        let outside = env::temp_dir().join("dc_project_image_outside.png");
        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_file(&outside);
        fs::create_dir_all(&root).unwrap();
        fs::write(&outside, [1_u8, 2, 3]).unwrap();

        let root_string = root.to_string_lossy().into_owned();
        let missing = read_project_image("missing.png".to_string(), root_string.clone()).unwrap_err();
        let escaped = read_project_image(
            outside.to_string_lossy().into_owned(),
            root_string,
        )
        .unwrap_err();

        assert!(missing.contains("Failed to read image \"missing.png\""));
        assert!(escaped.contains("outside the project directory"));
        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_file(&outside);
    }
}
