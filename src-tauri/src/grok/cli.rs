use crate::commands::settings::AppSettings;
use std::io;
use std::path::PathBuf;
use std::process::{Command, Output, Stdio};

#[derive(Debug, Clone)]
pub struct GrokCli {
    pub executable: String,
}

impl GrokCli {
    pub fn resolve(settings: &AppSettings) -> Result<Self, String> {
        let path = settings.grok_cli_path.trim();
        if !path.is_empty() {
            let candidate = PathBuf::from(path);
            if !candidate.exists() {
                return Err(format!("Grok CLI not found at {}", path));
            }
            return Ok(Self {
                executable: candidate.to_string_lossy().into_owned(),
            });
        }

        Ok(Self {
            executable: "grok".to_string(),
        })
    }

    pub fn agent_stdio_args(&self, settings: &AppSettings) -> Vec<String> {
        let mut args = Vec::new();

        if !settings.permission_mode.is_empty() && settings.permission_mode != "default" {
            args.push("--permission-mode".to_string());
            args.push(settings.permission_mode.clone());
        }

        if settings.always_approve {
            args.push("--always-approve".to_string());
        }

        if !settings.default_model.trim().is_empty() {
            args.push("-m".to_string());
            args.push(settings.default_model.trim().to_string());
        }

        let sandbox_profile = settings.sandbox_profile.trim();
        if !sandbox_profile.is_empty() && sandbox_profile != "off" {
            args.push("--sandbox".to_string());
            args.push(sandbox_profile.to_string());
        }

        args.push("agent".to_string());
        args.push("stdio".to_string());
        args
    }

    pub fn run_capture(&self, args: &[&str]) -> Result<Output, String> {
        let mut cmd = Command::new(&self.executable);
        cmd.args(args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        apply_hidden_console(&mut cmd);
        cmd.output()
            .map_err(|e| format!("Failed to run grok: {e}"))
    }

    pub fn version(&self) -> Result<String, String> {
        let output = self.run_capture(&["-v"])?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("grok -v failed: {stderr}"));
        }
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    }

    pub fn spawn_login(&self, oauth: bool) -> Result<(), String> {
        let mut cmd = Command::new(&self.executable);
        cmd.arg("login");
        if oauth {
            cmd.arg("--oauth");
        }
        apply_login_console(&mut cmd);
        cmd.spawn()
            .map(|_| ())
            .map_err(|e| format!("Failed to start grok login: {e}"))
    }

    pub fn spawn_logout(&self) -> Result<(), String> {
        let mut cmd = Command::new(&self.executable);
        cmd.arg("logout");
        apply_login_console(&mut cmd);
        cmd.spawn()
            .map(|_| ())
            .map_err(|e| format!("Failed to start grok logout: {e}"))
    }

    pub fn check_auth(&self) -> Result<bool, String> {
        let output = self.run_capture(&["models"])?;
        Ok(output.status.success())
    }
}

fn apply_login_console(cmd: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NEW_CONSOLE: u32 = 0x0000_0010;
        cmd.creation_flags(CREATE_NEW_CONSOLE);
    }
    #[cfg(not(windows))]
    {
        let _ = cmd;
    }
}

pub fn apply_hidden_console(cmd: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(not(windows))]
    {
        let _ = cmd;
    }
}

pub fn io_err(err: io::Error) -> String {
    err.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::settings::AppSettings;

    #[test]
    fn off_profile_does_not_add_a_sandbox_flag() {
        let cli = GrokCli {
            executable: "grok".to_string(),
        };
        let settings = AppSettings::default();
        assert_eq!(
            cli.agent_stdio_args(&settings),
            vec!["agent".to_string(), "stdio".to_string()]
        );
    }

    #[test]
    fn selected_profile_is_before_agent_stdio() {
        let cli = GrokCli {
            executable: "grok".to_string(),
        };
        let mut settings = AppSettings::default();
        settings.sandbox_profile = "workspace".to_string();
        assert_eq!(
            cli.agent_stdio_args(&settings),
            vec![
                "--sandbox".to_string(),
                "workspace".to_string(),
                "agent".to_string(),
                "stdio".to_string(),
            ]
        );
    }
}
