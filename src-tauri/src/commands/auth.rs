use crate::commands::settings::read_settings;
use crate::grok::cli::GrokCli;
use serde::Serialize;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthCheckResult {
    pub authenticated: bool,
    pub message: Option<String>,
}

#[tauri::command]
pub fn check_auth(app: AppHandle) -> Result<AuthCheckResult, String> {
    let settings = read_settings(&app)?;
    let grok = GrokCli::resolve(&settings)?;
    let output = grok.run_capture(&["models"])?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        return Ok(AuthCheckResult {
            authenticated: true,
            message: if stdout.is_empty() {
                None
            } else {
                Some(stdout.lines().next().unwrap_or(&stdout).to_string())
            },
        });
    }

    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let message = if stderr.is_empty() {
        "Not signed in. Run grok login.".to_string()
    } else {
        stderr
    };

    Ok(AuthCheckResult {
        authenticated: false,
        message: Some(message),
    })
}

#[tauri::command]
pub fn run_grok_login(app: AppHandle, oauth: Option<bool>) -> Result<(), String> {
    let settings = read_settings(&app)?;
    let grok = GrokCli::resolve(&settings)?;
    grok.spawn_login(oauth.unwrap_or(true))
}

#[tauri::command]
pub fn run_grok_logout(app: AppHandle) -> Result<(), String> {
    let settings = read_settings(&app)?;
    let grok = GrokCli::resolve(&settings)?;
    grok.spawn_logout()
}
