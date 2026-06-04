use crate::commands::settings::{read_settings, AppSettings};
use crate::grok::cli::GrokCli;
use serde::Serialize;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CliReadyResult {
    pub ready: bool,
    pub version: Option<String>,
    pub grok_path: String,
    pub authenticated: bool,
    pub error: Option<String>,
}

fn probe(settings: &AppSettings) -> CliReadyResult {
    let grok = match GrokCli::resolve(settings) {
        Ok(g) => g,
        Err(e) => {
            return CliReadyResult {
                ready: false,
                version: None,
                grok_path: settings.grok_cli_path.clone(),
                authenticated: false,
                error: Some(e),
            };
        }
    };

    let version = match grok.version() {
        Ok(v) => Some(v),
        Err(e) => {
            return CliReadyResult {
                ready: false,
                version: None,
                grok_path: grok.executable.clone(),
                authenticated: false,
                error: Some(e),
            };
        }
    };

    let authenticated = grok.check_auth().unwrap_or(false);

    CliReadyResult {
        ready: true,
        version,
        grok_path: grok.executable.clone(),
        authenticated,
        error: None,
    }
}

#[tauri::command]
pub fn grok_version(app: AppHandle) -> Result<String, String> {
    let settings = read_settings(&app)?;
    let grok = GrokCli::resolve(&settings)?;
    grok.version()
}

#[tauri::command]
pub fn check_cli_ready(app: AppHandle) -> Result<CliReadyResult, String> {
    let settings = read_settings(&app)?;
    Ok(probe(&settings))
}
