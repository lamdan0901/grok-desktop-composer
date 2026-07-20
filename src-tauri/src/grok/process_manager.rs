use crate::commands::settings::AppSettings;
use crate::grok::cli::{apply_hidden_console, io_err, GrokCli};

use serde::Serialize;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AcpLinePayload {
    pub tab_id: String,
    pub line: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TabErrorPayload {
    pub tab_id: String,
    pub message: String,
}

struct TabProcess {
    child: Child,
    stdin: std::process::ChildStdin,
    cwd: Option<String>,
    _stdout_thread: std::thread::JoinHandle<()>,
    _stderr_thread: std::thread::JoinHandle<()>,
}

pub struct ProcessManager {
    app: AppHandle,
    tabs: Mutex<HashMap<String, TabProcess>>,
}

fn configure_agent_command(cmd: &mut Command) {
    cmd.env("MCP_INIT_STRATEGY", "blocking");
}

impl ProcessManager {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            tabs: Mutex::new(HashMap::new()),
        }
    }

    pub fn start_tab(
        &self,
        tab_id: String,
        cwd: Option<String>,
        settings: &AppSettings,
    ) -> Result<(), String> {
        self.stop_tab(&tab_id)?;

        let grok = GrokCli::resolve(settings)?;
        let mut cmd = Command::new(&grok.executable);
        configure_agent_command(&mut cmd);
        cmd.args(grok.agent_stdio_args(settings));

        if let Some(ref dir) = cwd {
            if !dir.is_empty() {
                cmd.current_dir(dir);
            }
        }

        cmd.stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        apply_hidden_console(&mut cmd);

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn grok agent stdio: {e}"))?;

        let stdin = child.stdin.take().ok_or("Failed to open grok stdin")?;
        let stdout = child.stdout.take().ok_or("Failed to open grok stdout")?;
        let stderr = child.stderr.take().ok_or("Failed to open grok stderr")?;

        let app_out = self.app.clone();
        let tab_out = tab_id.clone();
        let stdout_thread = std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                match line {
                    Ok(line) => {
                        let payload = AcpLinePayload {
                            tab_id: tab_out.clone(),
                            line,
                        };
                        let _ = app_out.emit("acp-line", payload);
                    }
                    Err(_) => break,
                }
            }
        });

        let app_err = self.app.clone();
        let tab_err = tab_id.clone();
        let stderr_thread = std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                match line {
                    Ok(line) => {
                        if line.trim().is_empty() {
                            continue;
                        }
                        let payload = TabErrorPayload {
                            tab_id: tab_err.clone(),
                            message: line,
                        };
                        let _ = app_err.emit("tab-error", payload);
                    }
                    Err(_) => break,
                }
            }
        });

        self.tabs.lock().map_err(|e| e.to_string())?.insert(
            tab_id,
            TabProcess {
                child,
                stdin,
                cwd,
                _stdout_thread: stdout_thread,
                _stderr_thread: stderr_thread,
            },
        );

        Ok(())
    }

    pub fn write_line(&self, tab_id: &str, line: String) -> Result<(), String> {
        let mut tabs = self.tabs.lock().map_err(|e| e.to_string())?;
        let tab = tabs
            .get_mut(tab_id)
            .ok_or_else(|| format!("Tab {tab_id} is not running"))?;

        writeln!(tab.stdin, "{line}").map_err(io_err)?;
        tab.stdin.flush().map_err(io_err)?;
        Ok(())
    }

    pub fn stop_tab(&self, tab_id: &str) -> Result<(), String> {
        let mut tabs = self.tabs.lock().map_err(|e| e.to_string())?;
        if let Some(mut tab) = tabs.remove(tab_id) {
            let _ = tab.child.kill();
            let _ = tab.child.wait();
        }
        Ok(())
    }

    pub fn restart_tab(&self, tab_id: String, settings: &AppSettings) -> Result<(), String> {
        let cwd = {
            let tabs = self.tabs.lock().map_err(|e| e.to_string())?;
            tabs.get(&tab_id).and_then(|t| t.cwd.clone())
        };
        self.start_tab(tab_id, cwd, settings)
    }

    pub fn stop_all(&self) {
        let ids: Vec<String> = self
            .tabs
            .lock()
            .map(|tabs| tabs.keys().cloned().collect())
            .unwrap_or_default();

        for id in ids {
            let _ = self.stop_tab(&id);
        }
    }

    pub fn running_tab_ids(&self) -> Result<Vec<String>, String> {
        let tabs = self.tabs.lock().map_err(|e| e.to_string())?;
        Ok(tabs.keys().cloned().collect())
    }
}

#[cfg(test)]
mod tests {
    use super::configure_agent_command;
    use std::ffi::OsStr;
    use std::process::Command;

    #[test]
    fn configures_blocking_mcp_initialization() {
        let mut command = Command::new("grok");
        configure_agent_command(&mut command);

        let value = command
            .get_envs()
            .find(|(key, _)| *key == OsStr::new("MCP_INIT_STRATEGY"))
            .and_then(|(_, value)| value)
            .and_then(|value| value.to_str());

        assert_eq!(value, Some("blocking"));
    }
}
