use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TabSnapshot {
    pub id: String,
    pub title: String,
    pub cwd: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub grok_session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_active_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default = "default_permission_mode")]
    pub permission_mode: String,
    #[serde(default = "default_model")]
    pub default_model: String,
    #[serde(default)]
    pub grok_cli_path: String,
    #[serde(default)]
    pub last_project_paths: Vec<String>,
    #[serde(default)]
    pub open_tabs: Vec<TabSnapshot>,
    #[serde(default)]
    pub pinned_project_paths: Vec<String>,
    #[serde(default)]
    pub expanded_project_cwds: Vec<String>,
    #[serde(default)]
    pub show_all_threads_project_cwds: Vec<String>,
    #[serde(default)]
    pub chats_section_show_all: bool,
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default)]
    pub always_approve: bool,
}

fn default_permission_mode() -> String {
    "default".to_string()
}

fn default_model() -> String {
    "".to_string()
}

fn default_theme() -> String {
    "dark".to_string()
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            permission_mode: default_permission_mode(),
            default_model: default_model(),
            grok_cli_path: String::new(),
            last_project_paths: Vec::new(),
            open_tabs: Vec::new(),
            pinned_project_paths: Vec::new(),
            expanded_project_cwds: Vec::new(),
            show_all_threads_project_cwds: Vec::new(),
            chats_section_show_all: false,
            theme: default_theme(),
            always_approve: false,
        }
    }
}

fn settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("settings.json"))
}

pub fn read_settings(app: &tauri::AppHandle) -> Result<AppSettings, String> {
    let path = settings_path(app)?;
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

fn write_settings(app: &tauri::AppHandle, settings: &AppSettings) -> Result<(), String> {
    let path = settings_path(app)?;
    let raw = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(path, raw).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_settings(app: tauri::AppHandle) -> Result<AppSettings, String> {
    read_settings(&app)
}

#[tauri::command]
pub fn set_settings(app: tauri::AppHandle, settings: AppSettings) -> Result<AppSettings, String> {
    write_settings(&app, &settings)?;
    Ok(settings)
}
