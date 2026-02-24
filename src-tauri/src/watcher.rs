//! Vault File Watcher - Async Event-Driven Architecture
//!
//! Uses tokio::select! for true event-driven processing (no polling).
//! CancellationToken for clean lifecycle management.
//! Debouncing via sleep_until (not recv_timeout).

use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{Duration, SystemTime};
use tauri::{AppHandle, Emitter};
use tokio::sync::{mpsc, Mutex};
use tokio::time::{Instant, sleep_until};
use tokio_util::sync::CancellationToken;

// ─────────────────────────────────────────────────────────────────────────────
// Public Types
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Clone, serde::Serialize)]
pub struct FileModifiedPayload {
    pub path: String,
    pub mtime: u64,
}

#[derive(Clone, serde::Serialize)]
pub struct FileDeletedPayload {
    pub path: String,
    pub note_id: String,
}

#[derive(Clone, serde::Serialize)]
pub struct FileRenamedPayload {
    pub old_path: String,
    pub new_path: String,
    pub old_note_id: String,
    pub new_note_id: String,
}

/// Managed vault watcher with lifecycle control
pub struct VaultWatcher {
    inner: Arc<Mutex<WatcherState>>,
}

struct WatcherState {
    watcher: Option<RecommendedWatcher>,
    cancel_token: Option<CancellationToken>,
    current_path: Option<String>,
}

// ─────────────────────────────────────────────────────────────────────────────
// VaultWatcher Implementation
// ─────────────────────────────────────────────────────────────────────────────

impl VaultWatcher {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(WatcherState {
                watcher: None,
                cancel_token: None,
                current_path: None,
            })),
        }
    }

    /// Start watching a vault path. Stops any existing watcher first.
    pub async fn watch(&self, app: AppHandle, vault_path: String) -> Result<(), String> {
        let mut state = self.inner.lock().await;

        // Stop existing watcher if any
        if let Some(token) = state.cancel_token.take() {
            token.cancel();
            println!("[INFO] [Watcher] Stopped previous watcher");
        }
        state.watcher = None;

        // Create sync-to-async bridge
        let (watcher, rx) = create_async_watcher()
            .map_err(|e| format!("Failed to create watcher: {}", e))?;

        // Start watching
        let mut watcher = watcher;
        watcher
            .watch(Path::new(&vault_path), RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch path: {}", e))?;

        // Create cancellation token
        let cancel_token = CancellationToken::new();
        let token_clone = cancel_token.clone();

        // Store state
        state.watcher = Some(watcher);
        state.cancel_token = Some(cancel_token);
        state.current_path = Some(vault_path.clone());

        // Spawn async event loop
        tauri::async_runtime::spawn(async move {
            run_event_loop(rx, app, token_clone).await;
        });

        println!("[INFO] [Watcher] Started watching: {}", vault_path);
        Ok(())
    }

    /// Stop the current watcher
    pub async fn stop(&self) {
        let mut state = self.inner.lock().await;

        if let Some(token) = state.cancel_token.take() {
            token.cancel();
        }
        state.watcher = None;
        state.current_path = None;

        println!("[INFO] [Watcher] Stopped");
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sync-to-Async Bridge
// ─────────────────────────────────────────────────────────────────────────────

/// Create a notify watcher that sends events to an async channel.
/// Uses UnboundedSender because send() is NOT async - safe in sync callbacks.
fn create_async_watcher() -> notify::Result<(
    RecommendedWatcher,
    mpsc::UnboundedReceiver<notify::Result<Event>>,
)> {
    let (tx, rx) = mpsc::unbounded_channel();

    let watcher = RecommendedWatcher::new(
        move |res: notify::Result<Event>| {
            // tx.send() is sync (not async) - safe in callback
            let _ = tx.send(res);
        },
        Config::default(),
    )?;

    Ok((watcher, rx))
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Batching
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Default)]
struct EventBatch {
    /// Navigation-relevant events (create/remove/rename)
    nav_changed: bool,
    /// File modifications: path -> mtime
    modifications: HashMap<PathBuf, u64>,
    /// Deleted content files
    deletions: Vec<PathBuf>,
    /// Renamed files: (old_path, new_path)
    renames: Vec<(PathBuf, PathBuf)>,
    /// Pending rename From event (Windows splits rename into From/To)
    pending_rename_from: Option<PathBuf>,
}

impl EventBatch {
    fn add(&mut self, event: &Event) {
        match &event.kind {
            // Navigation tree changes
            EventKind::Create(_) => {
                self.nav_changed = true;
            }
            EventKind::Remove(_) => {
                self.nav_changed = true;
                // Track deletion of content files
                for path in &event.paths {
                    if is_content_file(path) {
                        self.deletions.push(path.clone());
                    }
                }
            }
            // Renames affect navigation
            EventKind::Modify(notify::event::ModifyKind::Name(mode)) => {
                self.nav_changed = true;

                use notify::event::RenameMode;
                match mode {
                    RenameMode::Both => {
                        // macOS/Linux: both paths in one event
                        if event.paths.len() >= 2 {
                            let old_path = event.paths[0].clone();
                            let new_path = event.paths[1].clone();
                            if is_content_file(&old_path) || is_content_file(&new_path) {
                                self.renames.push((old_path, new_path));
                            }
                        }
                    }
                    RenameMode::From => {
                        // Windows: rename starts (save for pairing with To)
                        if let Some(path) = event.paths.first() {
                            self.pending_rename_from = Some(path.clone());
                        }
                    }
                    RenameMode::To => {
                        // Windows: rename completes (pair with From)
                        if let Some(path) = event.paths.first() {
                            if let Some(from_path) = self.pending_rename_from.take() {
                                if is_content_file(&from_path) || is_content_file(path) {
                                    self.renames.push((from_path, path.clone()));
                                }
                            }
                        }
                    }
                    _ => {}
                }
            }
            // Content modifications
            EventKind::Modify(_) => {
                for path in &event.paths {
                    // Only track if file exists (avoid race with deletes)
                    if path.is_file() {
                        if let Ok(mtime) = get_mtime(path) {
                            self.modifications.insert(path.clone(), mtime);
                        }
                    }
                }
            }
            _ => {}
        }
    }

    fn is_empty(&self) -> bool {
        !self.nav_changed
            && self.modifications.is_empty()
            && self.deletions.is_empty()
            && self.renames.is_empty()
    }

    fn clear(&mut self) {
        self.nav_changed = false;
        self.modifications.clear();
        self.deletions.clear();
        self.renames.clear();
        self.pending_rename_from = None;
    }
}

fn get_mtime(path: &Path) -> Result<u64, std::io::Error> {
    let metadata = std::fs::metadata(path)?;
    let modified = metadata.modified()?;
    Ok(modified
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64)
}

// ─────────────────────────────────────────────────────────────────────────────
// Async Event Loop (No Polling!)
// ─────────────────────────────────────────────────────────────────────────────

const DEBOUNCE_MS: u64 = 800; // Longer for Windows atomic saves

async fn run_event_loop(
    mut rx: mpsc::UnboundedReceiver<notify::Result<Event>>,
    app: AppHandle,
    cancel_token: CancellationToken,
) {
    let mut batch = EventBatch::default();
    let mut debounce_deadline: Option<Instant> = None;
    let debounce_duration = Duration::from_millis(DEBOUNCE_MS);

    println!("[INFO] [Watcher] Event loop started");

    loop {
        tokio::select! {
            // Priority 1: Check for cancellation
            _ = cancel_token.cancelled() => {
                println!("[INFO] [Watcher] Cancelled, flushing pending events");
                // Emit any pending events before shutdown
                if !batch.is_empty() {
                    emit_batch(&batch, &app);
                }
                break;
            }

            // Priority 2: Debounce deadline reached - emit batch
            _ = wait_for_deadline(debounce_deadline) => {
                emit_batch(&batch, &app);
                batch.clear();
                debounce_deadline = None;
            }

            // Priority 3: New event from filesystem
            Some(result) = rx.recv() => {
                match result {
                    Ok(event) => {
                        // Skip transient events (temp files, etc.)
                        if !should_ignore(&event) {
                            batch.add(&event);
                            // Reset deadline on each event (trailing edge debounce)
                            debounce_deadline = Some(Instant::now() + debounce_duration);
                        }
                    }
                    Err(e) => {
                        // Ignore transient OS errors (common during atomic saves)
                        if !is_transient_error(&e) {
                            eprintln!("[ERROR] [Watcher] {}", e);
                        }
                    }
                }
            }
        }
    }

    println!("[INFO] [Watcher] Event loop terminated");
}

/// Wait for optional deadline. If None, wait forever (never fires).
async fn wait_for_deadline(deadline: Option<Instant>) {
    match deadline {
        Some(d) => sleep_until(d).await,
        None => std::future::pending::<()>().await,
    }
}

/// Emit batched events to frontend
fn emit_batch(batch: &EventBatch, app: &AppHandle) {
    // Emit renames FIRST (before vault:changed, before deletions)
    for (old_path, new_path) in &batch.renames {
        let payload = FileRenamedPayload {
            old_path: old_path.to_string_lossy().to_string(),
            new_path: new_path.to_string_lossy().to_string(),
            old_note_id: path_to_id(&old_path.to_string_lossy()),
            new_note_id: path_to_id(&new_path.to_string_lossy()),
        };
        println!(
            "[INFO] [Watcher] Emitting file:renamed: {} -> {}",
            payload.old_path, payload.new_path
        );
        app.emit("file:renamed", payload).ok();
    }

    // Emit deletions SECOND (before vault:changed)
    for path in &batch.deletions {
        let payload = FileDeletedPayload {
            path: path.to_string_lossy().to_string(),
            note_id: path_to_id(&path.to_string_lossy()),
        };
        println!("[INFO] [Watcher] Emitting file:deleted: {}", payload.path);
        app.emit("file:deleted", payload).ok();
    }

    if batch.nav_changed {
        println!("[INFO] [Watcher] Emitting vault:changed");
        app.emit("vault:changed", ()).ok();
    }

    for (path, mtime) in &batch.modifications {
        let payload = FileModifiedPayload {
            path: path.to_string_lossy().to_string(),
            mtime: *mtime,
        };
        println!("[INFO] [Watcher] Emitting file:modified: {}", payload.path);
        app.emit("file:modified", payload).ok();
    }
}

/// Check if error is transient (common during atomic saves)
fn is_transient_error(e: &notify::Error) -> bool {
    if let notify::ErrorKind::Io(ref io_err) = e.kind {
        // OS error 2 = FILE_NOT_FOUND, 3 = PATH_NOT_FOUND
        matches!(io_err.raw_os_error(), Some(2) | Some(3))
    } else {
        false
    }
}

/// Filter out events we don't care about
fn should_ignore(event: &Event) -> bool {
    event.paths.iter().any(|p| {
        let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
        // Ignore temp files, hidden files, etc.
        name.starts_with('.')
            || name.starts_with('~')
            || name.ends_with(".tmp")
            || name.ends_with(".swp")
    })
}

/// Check if path is a content file (.md or .js module)
fn is_content_file(path: &Path) -> bool {
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        matches!(ext, "md" | "js")
    } else {
        false
    }
}

/// Convert filesystem path to note ID
/// Example: "Home/Notes/example.md" -> "example.md" (WITH extension to match OS behavior)
fn path_to_id(path_str: &str) -> String {
    // Extract full filename WITH extension (matches tree.json ID format)
    Path::new(path_str)
        .file_name()  // Full filename WITH extension
        .and_then(|n| n.to_str())
        .unwrap_or(path_str)
        .to_string()
}

// ─────────────────────────────────────────────────────────────────────────────
// Global Watcher Instance (for IPC)
// ─────────────────────────────────────────────────────────────────────────────

use std::sync::OnceLock;

static WATCHER: OnceLock<VaultWatcher> = OnceLock::new();

fn get_watcher() -> &'static VaultWatcher {
    WATCHER.get_or_init(VaultWatcher::new)
}

/// IPC command: Start watching vault
pub fn start_vault_watcher(app: AppHandle, vault_path: String) {
    let watcher = get_watcher();
    tauri::async_runtime::spawn(async move {
        if let Err(e) = watcher.watch(app, vault_path).await {
            eprintln!("[ERROR] [Watcher] Failed to start: {}", e);
        }
    });
}

/// IPC command: Stop watching vault (optional, for future use)
#[allow(dead_code)]
pub fn stop_vault_watcher() {
    let watcher = get_watcher();
    tauri::async_runtime::spawn(async move {
        watcher.stop().await;
    });
}
