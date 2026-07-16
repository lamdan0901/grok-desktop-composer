use std::{env, fs, path::{Path, PathBuf}};

#[derive(serde::Serialize)]
pub struct GrokSkillDiskEntry {
    pub id: String,
    pub path: String,
    pub has_skill_md: bool,
}

fn grok_home() -> Result<PathBuf, String> {
    let home = env::var_os("HOME")
        .or_else(|| env::var_os("USERPROFILE"))
        .ok_or_else(|| "Cannot resolve the user home directory".to_string())?;
    Ok(PathBuf::from(home).join(".grok"))
}

fn safe_skill_path(id: &Path) -> Result<PathBuf, String> {
    let mut parts = id.components();
    let Some(first) = parts.next() else {
        return Err("Skill id is empty".into());
    };
    if parts.next().is_some() || !matches!(first, std::path::Component::Normal(_)) {
        return Err("Invalid skill id".into());
    }
    let name = first.as_os_str().to_string_lossy();
    if name == "." || name == ".." || name.contains('/') || name.contains('\\') {
        return Err("Invalid skill id".into());
    }
    Ok(grok_home()?.join("skills").join(name.as_ref()))
}

#[tauri::command]
pub fn list_grok_skills() -> Result<Vec<GrokSkillDiskEntry>, String> {
    let root = grok_home()?.join("skills");
    let Ok(entries) = fs::read_dir(root) else {
        return Ok(Vec::new());
    };
    Ok(entries
        .flatten()
        .filter_map(|entry| {
            let path = entry.path();
            if !path.is_dir() {
                return None;
            }
            let id = entry.file_name().to_string_lossy().into_owned();
            Some(GrokSkillDiskEntry {
                id,
                path: path.to_string_lossy().into_owned(),
                has_skill_md: path.join("SKILL.md").is_file(),
            })
        })
        .collect())
}

#[tauri::command]
pub fn read_grok_skill(skill_id: String) -> Result<String, String> {
    let path = safe_skill_path(Path::new(&skill_id))?.join("SKILL.md");
    fs::read_to_string(path).map_err(|e| format!("Failed to read skill: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_parent_traversal_and_non_skill_files() {
        assert!(safe_skill_path(Path::new("lint")).is_ok());
        assert!(safe_skill_path(Path::new("..\\secret")).is_err());
        assert!(safe_skill_path(Path::new("lint\\notes.txt")).is_err());
    }
}
