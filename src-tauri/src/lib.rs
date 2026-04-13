use std::fs;
use std::os::unix::fs::PermissionsExt;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::Manager;

struct PendingFile(Mutex<Option<String>>);

fn make_cli_script() -> String {
    let exe = std::env::current_exe().unwrap_or_default();
    let exe_str = exe.to_string_lossy();

    let app_path = if let Some(pos) = exe_str.find(".app/") {
        Some(&exe_str[..pos + 4])
    } else {
        None
    };

    if let Some(app) = app_path {
        format!(
            "#!/bin/sh\nif [ $# -eq 0 ]; then\n  open \"{app}\"\nelse\n  open \"{app}\" --args \"$@\"\nfi\n"
        )
    } else {
        format!(
            "#!/bin/sh\n\"{exe_str}\" \"$@\" &\n"
        )
    }
}

#[tauri::command]
fn install_cli() -> Result<String, String> {
    let script = make_cli_script();

    let targets: Vec<PathBuf> = vec![
        PathBuf::from("/usr/local/bin/mark"),
        dirs::home_dir()
            .unwrap_or_default()
            .join(".local/bin/mark"),
    ];

    for target in &targets {
        if let Some(parent) = target.parent() {
            if !parent.exists() {
                let _ = fs::create_dir_all(parent);
            }
        }

        match fs::write(target, &script) {
            Ok(_) => {
                let _ = fs::set_permissions(target, fs::Permissions::from_mode(0o755));
                return Ok(target.to_string_lossy().to_string());
            }
            Err(_) => continue,
        }
    }

    Err("Permission denied. Try running:\nsudo ln -sf \"$(which mark)\" /usr/local/bin/mark".to_string())
}

#[tauri::command]
fn uninstall_cli() -> Result<String, String> {
    let targets: Vec<PathBuf> = vec![
        PathBuf::from("/usr/local/bin/mark"),
        dirs::home_dir()
            .unwrap_or_default()
            .join(".local/bin/mark"),
    ];

    for target in &targets {
        if target.exists() {
            match fs::remove_file(target) {
                Ok(_) => return Ok(target.to_string_lossy().to_string()),
                Err(_) => continue,
            }
        }
    }

    Ok("Not installed".to_string())
}

/// Called by the frontend on mount to check if a file was passed via CLI
#[tauri::command]
fn get_pending_file(state: tauri::State<PendingFile>) -> Option<String> {
    state.0.lock().unwrap().take()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Check CLI args for a file path before building the app
    let pending: Option<String> = {
        let args: Vec<String> = std::env::args().collect();
        if args.len() > 1 {
            let file_path = &args[1];
            let path = std::path::Path::new(file_path);
            let abs_path = if path.is_absolute() {
                path.to_path_buf()
            } else {
                std::env::current_dir().unwrap_or_default().join(path)
            };

            Some(abs_path.to_string_lossy().to_string())
        } else {
            None
        }
    };

    tauri::Builder::default()
        .manage(PendingFile(Mutex::new(pending)))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![install_cli, uninstall_cli, get_pending_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
