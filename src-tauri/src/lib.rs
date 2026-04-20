use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;
use notify_debouncer_mini::{new_debouncer, notify::RecursiveMode, DebounceEventResult, Debouncer};
use notify_debouncer_mini::notify::RecommendedWatcher;
use tauri::menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::Emitter;
use tauri::Manager;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

struct PendingFile(Mutex<Option<String>>);
struct PendingWatch(Mutex<Option<bool>>);
struct PendingDirectory(Mutex<Option<Vec<String>>>);
struct ActiveWatcher(Mutex<Option<Debouncer<RecommendedWatcher>>>);

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
            r#"#!/bin/sh
# Detect piped stdin: write to a temp file and pass it to the app
if [ ! -t 0 ] && [ "$1" = "-" -o $# -eq 0 ]; then
  _tmp=$(mktemp /tmp/mark_stdin_XXXXXX.md)
  cat > "$_tmp"
  open -a '{escaped}' "$_tmp" --args --stdin-tmp "$_tmp"
elif [ $# -eq 0 ]; then
  open '{escaped}'
else
  open -a '{escaped}' "$@"
fi
"#
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
    "#compdef mark\n_arguments \\\n  '(-w --watch)'{-w,--watch}'[auto-reload on file change]' \\\n  '1:file:_files'\n"
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

/// Returns true if the -w/--watch flag was passed via CLI (one-shot, like get_pending_file).
#[tauri::command]
fn get_pending_watch(state: tauri::State<PendingWatch>) -> bool {
    state.0.lock().unwrap_or_else(|e| e.into_inner()).take().unwrap_or(false)
}

/// Returns list of .md/.markdown files if a directory was passed via CLI.
#[tauri::command]
fn get_pending_directory(state: tauri::State<PendingDirectory>) -> Option<Vec<String>> {
    state.0.lock().unwrap_or_else(|e| e.into_inner()).take()
}

/// Start watching a file for changes. Replaces any existing watcher.
/// Emits "file-changed" with the file path when a change is detected.
#[tauri::command]
fn start_watch(
    path: String,
    app: tauri::AppHandle,
    watcher_state: tauri::State<ActiveWatcher>,
) -> Result<(), String> {
    let watch_path = PathBuf::from(&path);
    if !watch_path.is_file() {
        return Err(format!("Not a file: {path}"));
    }

    let app_handle = app.clone();
    let emit_path = path.clone();

    let mut debouncer = new_debouncer(
        Duration::from_millis(300),
        move |res: DebounceEventResult| {
            if res.is_ok() {
                let _ = app_handle.emit("file-changed", &emit_path);
            }
        },
    )
    .map_err(|e| format!("Failed to create watcher: {e}"))?;

    // Add the watch path BEFORE storing so we don't leave a bad state if watch() fails
    debouncer
        .watcher()
        .watch(&watch_path, RecursiveMode::NonRecursive)
        .map_err(|e| format!("Failed to watch file: {e}"))?;

    let mut guard = watcher_state.0.lock().unwrap_or_else(|e| e.into_inner());
    *guard = Some(debouncer);

    Ok(())
}

/// Stop file watching.
#[tauri::command]
fn stop_watch(watcher_state: tauri::State<ActiveWatcher>) {
    let mut guard = watcher_state.0.lock().unwrap_or_else(|e| e.into_inner());
    *guard = None;
}

/// Read all .md/.markdown files from a directory, sorted alphabetically.
/// Returns None if dir_path is None or the directory can't be read.
fn resolve_directory(dir_path: Option<String>) -> Option<Vec<String>> {
    let dir = dir_path?;
    let read = fs::read_dir(&dir).ok()?;
    let mut files: Vec<String> = read
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let path = e.path();
            if path.is_file() {
                let ext = path.extension()?.to_string_lossy().to_lowercase();
                if ext == "md" || ext == "markdown" {
                    return Some(path.to_string_lossy().to_string());
                }
            }
            None
        })
        .collect();
    files.sort();
    if files.is_empty() { None } else { Some(files) }
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
    let toggle_watch = MenuItemBuilder::with_id("toggle-watch", "Toggle Auto-Reload")
        .accelerator("CmdOrCtrl+Shift+R")
        .build(app)?;
    let quick_open = MenuItemBuilder::with_id("quick-open", "Open Recent...")
        .accelerator("CmdOrCtrl+P")
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
        .item(&quick_open)
        .item(&toggle_watch)
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
            | "actual-size" | "export-pdf" | "toggle-watch" | "quick-open" => {
                let _ = app_handle.emit("menu-event", id);
            }
            _ => {}
        }
    });

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Parse CLI args: optional -w/--watch flag, --stdin-tmp <path>, and a file/directory path.
    let (pending, pending_watch_flag, pending_dir) = {
        let args: Vec<String> = std::env::args().skip(1).collect();

        let watch_flag = args.iter().any(|a| a == "-w" || a == "--watch");

        // --stdin-tmp <file>: temp file written by the shell script from piped stdin
        let stdin_tmp = args.windows(2).find_map(|w| {
            if w[0] == "--stdin-tmp" { Some(w[1].clone()) } else { None }
        });

        let file_arg = if stdin_tmp.is_some() {
            stdin_tmp
        } else {
            args.iter().find(|a| !a.starts_with('-')).cloned()
        };

        let (resolved_file, resolved_dir) = file_arg.map_or((None, None), |file_path| {
            let path = std::path::Path::new(&file_path);
            let abs_path = if path.is_absolute() {
                path.to_path_buf()
            } else {
                std::env::current_dir().unwrap_or_default().join(path)
            };
            if abs_path.is_file() {
                (Some(abs_path.to_string_lossy().to_string()), None)
            } else if abs_path.is_dir() {
                (None, Some(abs_path.to_string_lossy().to_string()))
            } else {
                (None, None)
            }
        });

        (resolved_file, watch_flag, resolved_dir)
    };

    let app = tauri::Builder::default()
        .manage(PendingFile(Mutex::new(pending)))
        .manage(PendingWatch(Mutex::new(Some(pending_watch_flag))))
        .manage(PendingDirectory(Mutex::new(resolve_directory(pending_dir))))
        .manage(ActiveWatcher(Mutex::new(None)))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            install_cli,
            uninstall_cli,
            get_pending_file,
            get_pending_watch,
            get_pending_directory,
            start_watch,
            stop_watch,
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
