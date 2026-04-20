use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::Emitter;
use tauri::Manager;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

struct PendingFile(Mutex<Option<String>>);

/// Build a CLI launcher script. Escapes the path for safe shell embedding.
fn make_cli_script() -> Result<String, String> {
    let exe =
        std::env::current_exe().map_err(|e| format!("Cannot determine executable path: {e}"))?;
    let exe_str = exe.to_string_lossy();

    // Shell-escape by replacing single quotes: ' -> '\''
    let escape_for_shell = |s: &str| -> String { s.replace('\'', "'\\''") };

    let app_path = if let Some(pos) = exe_str.find(".app/") {
        Some(exe_str[..pos + 4].to_string())
    } else {
        None
    };

    if let Some(app) = app_path {
        let escaped = escape_for_shell(&app);
        Ok(format!(
            "#!/bin/sh\nif [ $# -eq 0 ]; then\n  open '{escaped}'\nelse\n  open -a '{escaped}' \"$@\"\nfi\n"
        ))
    } else {
        let escaped = escape_for_shell(&exe_str);
        Ok(format!("#!/bin/sh\n'{escaped}' \"$@\" &\n"))
    }
}

/// Returns the list of CLI install target paths, with home_dir validated.
fn cli_targets() -> Result<Vec<PathBuf>, String> {
    let home = dirs::home_dir().ok_or_else(|| "Cannot determine home directory".to_string())?;
    Ok(vec![
        PathBuf::from("/usr/local/bin/mark"),
        home.join(".local/bin/mark"),
    ])
}

/// Zsh completion script for the `mark` command.
fn zsh_completion() -> &'static str {
    "#compdef mark\n_arguments '1:file:_files'\n"
}

/// Bash completion script for the `mark` command.
fn bash_completion() -> &'static str {
    "complete -f -o default mark\n"
}

/// Returns candidate paths for installing shell completions.
fn completion_targets() -> Result<(Vec<PathBuf>, Vec<PathBuf>), String> {
    let home = dirs::home_dir().ok_or_else(|| "Cannot determine home directory".to_string())?;
    let zsh = vec![
        PathBuf::from("/opt/homebrew/share/zsh/site-functions/_mark"),
        PathBuf::from("/usr/local/share/zsh/site-functions/_mark"),
        home.join(".zsh/completions/_mark"),
    ];
    let bash = vec![
        PathBuf::from("/opt/homebrew/etc/bash_completion.d/mark"),
        PathBuf::from("/usr/local/etc/bash_completion.d/mark"),
        home.join(".local/share/bash-completion/completions/mark"),
    ];
    Ok((zsh, bash))
}

/// Try to install a completion script to the first writable target path.
fn install_completion(targets: &[PathBuf], content: &str) -> Option<PathBuf> {
    for target in targets {
        if let Some(parent) = target.parent() {
            if !parent.exists() {
                let _ = fs::create_dir_all(parent);
            }
        }
        if fs::write(target, content).is_ok() {
            return Some(target.clone());
        }
    }
    None
}

/// Remove completion files from all known target paths.
fn remove_completions(targets: &[PathBuf]) {
    for target in targets {
        if target.exists() {
            let _ = fs::remove_file(target);
        }
    }
}

#[tauri::command]
fn install_cli() -> Result<String, String> {
    let script = make_cli_script()?;
    let targets = cli_targets()?;

    let mut installed_path: Option<String> = None;

    for target in &targets {
        if let Some(parent) = target.parent() {
            if !parent.exists() {
                let _ = fs::create_dir_all(parent);
            }
        }

        match fs::write(target, &script) {
            Ok(_) => {
                #[cfg(unix)]
                {
                    fs::set_permissions(target, fs::Permissions::from_mode(0o755)).map_err(
                        |e| {
                            format!(
                                "Installed to {} but failed to set permissions: {e}",
                                target.display()
                            )
                        },
                    )?;
                }
                installed_path = Some(target.to_string_lossy().to_string());
                break;
            }
            Err(_) => continue,
        }
    }

    let _ = installed_path.ok_or_else(|| {
        "Permission denied. Try running:\nsudo ln -sf \"$(which mark)\" /usr/local/bin/mark"
            .to_string()
    })?;

    // Install shell completions (best-effort, don't fail the whole install)
    if let Ok((zsh_targets, bash_targets)) = completion_targets() {
        let _ = install_completion(&zsh_targets, zsh_completion());
        let _ = install_completion(&bash_targets, bash_completion());
    }

    Ok("Installed `mark` to CLI".to_string())
}

#[tauri::command]
fn uninstall_cli() -> Result<String, String> {
    let targets = cli_targets()?;

    // Remove shell completions
    if let Ok((zsh_targets, bash_targets)) = completion_targets() {
        remove_completions(&zsh_targets);
        remove_completions(&bash_targets);
    }

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

/// Called by the frontend on mount to check if a file was passed via CLI.
/// Returns None if no file was passed or the mutex is poisoned.
#[tauri::command]
fn get_pending_file(state: tauri::State<PendingFile>) -> Option<String> {
    state.0.lock().unwrap_or_else(|e| e.into_inner()).take()
}

fn setup_menu(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // Custom menu items (emit events to frontend)
    let preferences = MenuItemBuilder::with_id("preferences", "Preferences...")
        .accelerator("CmdOrCtrl+,")
        .build(app)?;
    let open_file = MenuItemBuilder::with_id("open-file", "Open...")
        .accelerator("CmdOrCtrl+O")
        .build(app)?;
    let toggle_sidebar = MenuItemBuilder::with_id("toggle-sidebar", "Toggle Sidebar")
        .accelerator("CmdOrCtrl+\\")
        .build(app)?;
    let find = MenuItemBuilder::with_id("find", "Find...")
        .accelerator("CmdOrCtrl+F")
        .build(app)?;
    let zoom_in = MenuItemBuilder::with_id("zoom-in", "Zoom In")
        .accelerator("CmdOrCtrl+=")
        .build(app)?;
    let zoom_out = MenuItemBuilder::with_id("zoom-out", "Zoom Out")
        .accelerator("CmdOrCtrl+-")
        .build(app)?;
    let actual_size = MenuItemBuilder::with_id("actual-size", "Actual Size")
        .accelerator("CmdOrCtrl+0")
        .build(app)?;
    let export_pdf = MenuItemBuilder::with_id("export-pdf", "Export as PDF...")
        .accelerator("CmdOrCtrl+Shift+E")
        .build(app)?;

    // App menu (Mark)
    let app_menu = SubmenuBuilder::new(app, "Mark")
        .item(&PredefinedMenuItem::about(app, Some("About Mark"), None)?)
        .separator()
        .item(&preferences)
        .separator()
        .item(&PredefinedMenuItem::hide(app, Some("Hide Mark"))?)
        .item(&PredefinedMenuItem::hide_others(app, Some("Hide Others"))?)
        .item(&PredefinedMenuItem::show_all(app, Some("Show All"))?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, Some("Quit Mark"))?)
        .build()?;

    // File menu
    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&open_file)
        .separator()
        .item(&export_pdf)
        .separator()
        .item(&PredefinedMenuItem::close_window(
            app,
            Some("Close Window"),
        )?)
        .build()?;

    // Edit menu (Copy + Select All for the read-only viewer)
    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .item(&PredefinedMenuItem::copy(app, Some("Copy"))?)
        .separator()
        .item(&PredefinedMenuItem::select_all(app, Some("Select All"))?)
        .build()?;

    // View menu
    let view_menu = SubmenuBuilder::new(app, "View")
        .item(&toggle_sidebar)
        .separator()
        .item(&find)
        .separator()
        .item(&zoom_in)
        .item(&zoom_out)
        .item(&actual_size)
        .separator()
        .item(&PredefinedMenuItem::fullscreen(
            app,
            Some("Enter Full Screen"),
        )?)
        .build()?;

    // Window menu
    let window_menu = SubmenuBuilder::new(app, "Window")
        .item(&PredefinedMenuItem::minimize(app, None)?)
        .item(&PredefinedMenuItem::maximize(app, Some("Zoom"))?)
        .build()?;

    let menu = MenuBuilder::new(app)
        .item(&app_menu)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&view_menu)
        .item(&window_menu)
        .build()?;

    app.set_menu(menu)?;

    // Handle custom menu events by emitting to frontend
    app.on_menu_event(move |app_handle, event| {
        let id = event.id().as_ref();
        match id {
            "open-file" | "preferences" | "toggle-sidebar" | "find" | "zoom-in" | "zoom-out"
            | "actual-size" | "export-pdf" => {
                let _ = app_handle.emit("menu-event", id);
            }
            _ => {}
        }
    });

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Check CLI args for a file path before building the app.
    // Skip arguments that look like flags (start with '-').
    let pending: Option<String> = {
        let args: Vec<String> = std::env::args().collect();
        if args.len() > 1 {
            let file_path = &args[1];

            // Skip flags/options -- only treat as a file if it doesn't start with '-'
            if file_path.starts_with('-') {
                None
            } else {
                let path = std::path::Path::new(file_path);
                let abs_path = if path.is_absolute() {
                    path.to_path_buf()
                } else {
                    std::env::current_dir().unwrap_or_default().join(path)
                };

                // Only accept paths that actually exist and are files
                if abs_path.is_file() {
                    Some(abs_path.to_string_lossy().to_string())
                } else {
                    None
                }
            }
        } else {
            None
        }
    };

    let app = tauri::Builder::default()
        .manage(PendingFile(Mutex::new(pending)))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            install_cli,
            uninstall_cli,
            get_pending_file
        ])
        .setup(|app| {
            setup_menu(app)?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Opened { urls } = event {
            for url in &urls {
                if let Ok(path) = url.to_file_path() {
                    if path.is_file() {
                        let path_str = path.to_string_lossy().to_string();
                        // Emit for already-loaded frontend
                        let _ = app_handle.emit("open-file", &path_str);
                        // Also store in PendingFile for frontend that hasn't loaded yet
                        if let Ok(mut pending) = app_handle.state::<PendingFile>().0.lock() {
                            *pending = Some(path_str);
                        }
                    }
                }
            }
        }
    });
}
