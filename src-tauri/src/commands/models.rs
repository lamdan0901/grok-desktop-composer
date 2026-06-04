use crate::commands::settings::{read_settings, AppSettings};
use crate::grok::cli::GrokCli;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GrokModelsResult {
    pub default_model: String,
    pub models: Vec<String>,
}

#[tauri::command]
pub fn list_grok_models(app: tauri::AppHandle) -> Result<GrokModelsResult, String> {
    let settings = read_settings(&app)?;
    list_models_with_settings(&settings)
}

pub fn list_models_with_settings(settings: &AppSettings) -> Result<GrokModelsResult, String> {
    let grok = GrokCli::resolve(settings)?;
    let output = grok.run_capture(&["models"])?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("grok models failed: {stderr}"));
    }
    let text = String::from_utf8_lossy(&output.stdout);
    Ok(parse_models_output(&text))
}

fn parse_models_output(text: &str) -> GrokModelsResult {
    let mut default_model = String::new();
    let mut models = Vec::new();
    let mut in_list = false;

    for line in text.lines() {
        let trimmed = line.trim();
        if let Some(rest) = trimmed.strip_prefix("Default model:") {
            default_model = rest.trim().to_string();
            continue;
        }
        if trimmed.eq_ignore_ascii_case("Available models:") {
            in_list = true;
            continue;
        }
        if !in_list {
            continue;
        }
        let body = trimmed
            .strip_prefix('*')
            .or_else(|| trimmed.strip_prefix('-'))
            .map(str::trim);
        let Some(body) = body else {
            continue;
        };
        let id = body
            .split_whitespace()
            .next()
            .unwrap_or(body)
            .trim()
            .to_string();
        if !id.is_empty() && !models.contains(&id) {
            models.push(id);
        }
    }

    if default_model.is_empty() {
        default_model = models
            .first()
            .cloned()
            .unwrap_or_else(|| "grok-composer-2.5-fast".to_string());
    }

    if models.is_empty() && !default_model.is_empty() {
        models.push(default_model.clone());
    }

    GrokModelsResult {
        default_model,
        models,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_sample_output() {
        let sample = r"You are logged in with grok.com.

Default model: grok-composer-2.5-fast

Available models:
  * grok-composer-2.5-fast (default)
  - grok-build
";
        let parsed = parse_models_output(sample);
        assert_eq!(parsed.default_model, "grok-composer-2.5-fast");
        assert_eq!(
            parsed.models,
            vec![
                "grok-composer-2.5-fast".to_string(),
                "grok-build".to_string()
            ]
        );
    }
}