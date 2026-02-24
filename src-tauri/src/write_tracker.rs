//! Write Tracker - Tracks recent file writes to filter self-triggered events
//!
//! Used by the watcher to distinguish between:
//! - File modifications from our own write operations (ignore)
//! - File modifications from external editors (emit event)

use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

/// Threshold for considering a write "recent" (2 seconds)
const WRITE_THRESHOLD_MS: u64 = 2000;

/// Global write tracker instance
static WRITE_TRACKER: OnceLock<Mutex<WriteTracker>> = OnceLock::new();

struct WriteTracker {
    writes: HashMap<String, Instant>,
}

impl WriteTracker {
    fn new() -> Self {
        Self {
            writes: HashMap::new(),
        }
    }
}

fn get_tracker() -> &'static Mutex<WriteTracker> {
    WRITE_TRACKER.get_or_init(|| Mutex::new(WriteTracker::new()))
}

/// Normalize path for consistent comparison (forward slashes, lowercase)
fn normalize_path(path: &str) -> String {
    path.replace('\\', "/").to_lowercase()
}

/// Record that we just wrote to a file
pub fn record_write(path: &str) {
    let normalized = normalize_path(path);
    let mut tracker = get_tracker().lock().unwrap();
    tracker.writes.insert(normalized, Instant::now());

    // Cleanup old entries (older than 10 seconds)
    let cutoff = Instant::now() - Duration::from_secs(10);
    tracker.writes.retain(|_, instant| *instant > cutoff);
}

/// Check if a file was recently written by our app
pub fn was_recently_written(path: &str) -> bool {
    let normalized = normalize_path(path);
    let tracker = get_tracker().lock().unwrap();

    if let Some(written_at) = tracker.writes.get(&normalized) {
        written_at.elapsed().as_millis() < WRITE_THRESHOLD_MS as u128
    } else {
        false
    }
}
