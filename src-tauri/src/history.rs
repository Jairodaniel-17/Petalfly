use std::fs;
use std::path::PathBuf;

use anyhow::Result;
use chrono::Utc;

use crate::commands::fs::ensure_workspace_path;
use crate::domain::HistoryEntry;

const HISTORY_DIR: &str = "history";

pub fn append_history(
    request_id: &str,
    mut entry: HistoryEntry,
    limit: Option<usize>,
) -> Result<Vec<HistoryEntry>> {
    if entry.timestamp.is_empty() {
        entry.timestamp = Utc::now().to_rfc3339();
    }
    let mut history = read_history_entries(request_id)?;
    history.insert(0, entry);
    if let Some(max) = limit {
        history.truncate(max);
    }
    write_history(request_id, &history)?;
    Ok(history)
}

pub fn read_history(request_id: &str) -> Result<Vec<HistoryEntry>> {
    read_history_entries(request_id)
}

fn read_history_entries(request_id: &str) -> Result<Vec<HistoryEntry>> {
    let path = history_file_path(request_id)?;
    if !path.exists() {
        return Ok(vec![]);
    }
    let content = fs::read_to_string(path)?;
    let entries: Vec<HistoryEntry> = serde_json::from_str(&content)?;
    Ok(entries)
}

fn write_history(request_id: &str, entries: &[HistoryEntry]) -> Result<()> {
    let path = history_file_path(request_id)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let payload = serde_json::to_string_pretty(entries)?;
    fs::write(path, payload)?;
    Ok(())
}

fn history_file_path(request_id: &str) -> Result<PathBuf> {
    let root = ensure_workspace_path()?;
    let sanitized = request_id.replace(|c: char| !c.is_ascii_alphanumeric(), "_");
    Ok(root.join(HISTORY_DIR).join(format!("{sanitized}.json")))
}
