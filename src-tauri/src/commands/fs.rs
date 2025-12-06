use std::env;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

use crate::domain::{
    EnvironmentFile, VariableDefinition, WorkspaceFolder, WorkspaceIndex, WorkspaceRequestFile,
    WorkspaceSettings,
};
use crate::pfs_parser;

pub fn read_workspace_index() -> Result<WorkspaceIndex> {
    let root = ensure_workspace_path()?;
    let collections = root.join("collections");
    let requests = read_pfs_files(&collections)?;
    let folders = read_collection_folders(&collections)?;
    let environments = read_environments(&root.join("environments"))?;
    let globals = read_globals(&root)?;
    let settings = read_settings(&root)?;
    Ok(WorkspaceIndex {
        workspace_path: root.to_string_lossy().to_string(),
        requests,
        folders,
        environments,
        globals,
        settings,
    })
}

pub fn save_pfs_file(path: &str, content: &str) -> Result<()> {
    let root = ensure_workspace_path()?;
    let full_path = root.join(path);
    if !full_path.starts_with(&root) {
        return Err(anyhow!("ruta fuera del workspace"));
    }
    let parsed = pfs_parser::parse_document(content)?;
    pfs_parser::validate_required(&parsed)?;
    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&full_path, content)?;
    Ok(())
}

pub fn save_settings(settings: &WorkspaceSettings) -> Result<()> {
    let root = ensure_workspace_path()?;
    let path = root.join("settings.json");
    let payload = serde_json::to_string_pretty(settings)?;
    fs::write(path, payload)?;
    Ok(())
}

pub fn save_environment_file(environment: &EnvironmentFile) -> Result<()> {
    let root = ensure_workspace_path()?;
    let target = absolutize(&root, &environment.path)?;
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    let raw = RawEnvironment {
        name: environment.name.clone(),
        variables: Some(environment.variables.clone()),
    };
    let content = serde_yaml::to_string(&raw)?;
    fs::write(target, content)?;
    Ok(())
}

pub fn create_collection_folder(path: &str) -> Result<()> {
    let root = ensure_workspace_path()?;
    let target = absolutize(&root, path)?;
    fs::create_dir_all(target)?;
    Ok(())
}

pub fn create_request_file(path: &str, content: &str) -> Result<()> {
    let root = ensure_workspace_path()?;
    let target = absolutize(&root, path)?;
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    if target.exists() {
        return Err(anyhow!("El archivo ya existe"));
    }
    let parsed = pfs_parser::parse_document(content)?;
    pfs_parser::validate_required(&parsed)?;
    fs::write(target, content)?;
    Ok(())
}

pub fn duplicate_request(from: &str, to: &str) -> Result<()> {
    let root = ensure_workspace_path()?;
    let source = absolutize(&root, from)?;
    let target = absolutize(&root, to)?;
    if !source.exists() {
        return Err(anyhow!("Origen no existe"));
    }
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::copy(source, target)?;
    Ok(())
}

pub fn delete_entry(path: &str) -> Result<()> {
    let root = ensure_workspace_path()?;
    let target = absolutize(&root, path)?;
    if target.is_dir() {
        fs::remove_dir_all(target)?;
    } else if target.exists() {
        fs::remove_file(target)?;
    }
    Ok(())
}

pub fn rename_entry(from: &str, to: &str) -> Result<()> {
    let root = ensure_workspace_path()?;
    let source = absolutize(&root, from)?;
    let target = absolutize(&root, to)?;
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::rename(source, target)?;
    Ok(())
}

pub fn ensure_workspace_path() -> Result<PathBuf> {
    if let Ok(custom) = env::var("PETALFLY_WORKSPACE") {
        let path = PathBuf::from(custom);
        fs::create_dir_all(path.join("collections"))?;
        fs::create_dir_all(path.join("environments"))?;
        return Ok(path);
    }
    let current = env::current_dir()?;
    // If the binary is running from `src-tauri` during `tauri dev`, prefer the
    // project's workspace directory (parent of src-tauri) to avoid triggering
    // cargo rebuilds when workspace files change inside src-tauri.
    let workspace = if current.ends_with("src-tauri") {
        current
            .parent()
            .map(|p| p.join("workspace"))
            .unwrap_or_else(|| current.join("workspace"))
    } else {
        current.join("workspace")
    };
    if !workspace.exists() {
        fs::create_dir_all(workspace.join("collections"))?;
        fs::create_dir_all(workspace.join("environments"))?;
    }
    Ok(workspace)
}

fn read_pfs_files(path: &Path) -> Result<Vec<WorkspaceRequestFile>> {
    if !path.exists() {
        return Ok(vec![]);
    }
    let workspace_root = ensure_workspace_path()?;
    let mut files = Vec::new();
    for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file()
            && entry.path().extension().and_then(|ext| ext.to_str()) == Some("pfs")
        {
            let content = fs::read_to_string(entry.path())?;
            let relative = entry
                .path()
                .strip_prefix(&workspace_root)
                .map(|p| p.to_path_buf())
                .unwrap_or_else(|_| entry.path().to_path_buf())
                .to_string_lossy()
                .to_string();
            files.push(WorkspaceRequestFile {
                path: relative,
                content,
            });
        }
    }
    Ok(files)
}

fn read_collection_folders(path: &Path) -> Result<Vec<WorkspaceFolder>> {
    let mut folders = Vec::new();
    if !path.exists() {
        return Ok(folders);
    }
    let workspace_root = ensure_workspace_path()?;
    for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
        if entry.path() == path {
            continue;
        }
        if entry.file_type().is_dir() {
            let relative = entry
                .path()
                .strip_prefix(&workspace_root)
                .map(|p| p.to_path_buf())
                .unwrap_or_else(|_| entry.path().to_path_buf())
                .to_string_lossy()
                .to_string();
            folders.push(WorkspaceFolder { path: relative });
        }
    }
    folders.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(folders)
}

fn read_environments(path: &Path) -> Result<Vec<EnvironmentFile>> {
    if !path.exists() {
        return Ok(vec![]);
    }
    let workspace_root = ensure_workspace_path()?;
    let mut envs = Vec::new();
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        if entry.file_type()?.is_file() {
            let content = fs::read_to_string(entry.path())?;
            let env: RawEnvironment = serde_yaml::from_str(&content)
                .with_context(|| format!("archivo {:?}", entry.path()))?;
            envs.push(EnvironmentFile {
                name: env.name,
                path: entry
                    .path()
                    .strip_prefix(&workspace_root)
                    .map(|p| p.to_path_buf())
                    .unwrap_or_else(|_| entry.path().to_path_buf())
                    .to_string_lossy()
                    .to_string(),
                variables: env.variables.unwrap_or_default(),
            });
        }
    }
    Ok(envs)
}

fn read_globals(root: &Path) -> Result<Vec<VariableDefinition>> {
    let globals_path = root.join("globals.yaml");
    if !globals_path.exists() {
        return Ok(vec![]);
    }
    let content = fs::read_to_string(globals_path)?;
    let globals: RawGlobals = serde_yaml::from_str(&content)?;
    Ok(globals.variables.unwrap_or_default())
}

fn read_settings(root: &Path) -> Result<WorkspaceSettings> {
    let path = root.join("settings.json");
    if !path.exists() {
        let defaults = WorkspaceSettings {
            workspace_name: "Petalfly Workspace".into(),
            active_environment: None,
            timeout_ms: Some(30_000),
            ignore_ssl: Some(false),
            theme: Some("dark".into()),
            history_limit: Some(15),
            debug_logs: Some(false),
            workspace_override: None,
            collection_environment_map: None,
        };
        let payload = serde_json::to_string_pretty(&defaults)?;
        let mut file = fs::File::create(path)?;
        file.write_all(payload.as_bytes())?;
        return Ok(defaults);
    }
    let content = fs::read_to_string(path)?;
    let settings: WorkspaceSettings = serde_json::from_str(&content)?;
    Ok(settings)
}

fn absolutize(root: &Path, relative: &str) -> Result<PathBuf> {
    let candidate = root.join(relative);
    if !candidate.starts_with(root) {
        return Err(anyhow!("Ruta fuera del workspace"));
    }
    Ok(candidate)
}

#[derive(Debug, Deserialize, Serialize)]
struct RawEnvironment {
    name: String,
    variables: Option<Vec<VariableDefinition>>,
}

#[derive(Debug, Deserialize, Serialize)]
struct RawGlobals {
    variables: Option<Vec<VariableDefinition>>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use once_cell::sync::Lazy;
    use std::sync::Mutex;

    static TEST_GUARD: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));

    fn valid_document() -> &'static str {
        "petalfly 1.0\nmeta:\n  id: test\n  name: Test\n  collection: Demo\n  tags: []\nrequest:\n  method: GET\n  url: http://localhost\n"
    }

    #[test]
    fn saves_valid_pfs_inside_workspace() {
        let _lock = TEST_GUARD.lock().unwrap();
        let dir = tempfile::tempdir().unwrap();
        let workspace_path = dir.path().join("workspace");
        std::env::set_var("PETALFLY_WORKSPACE", &workspace_path);
        save_pfs_file("collections/test.pfs", valid_document()).unwrap();
        assert!(workspace_path.join("collections/test.pfs").exists());
        std::env::remove_var("PETALFLY_WORKSPACE");
    }

    #[test]
    fn rejects_invalid_pfs_without_header() {
        let _lock = TEST_GUARD.lock().unwrap();
        let dir = tempfile::tempdir().unwrap();
        let workspace_path = dir.path().join("workspace");
        std::env::set_var("PETALFLY_WORKSPACE", &workspace_path);
        let result = save_pfs_file("collections/test.pfs", "invalid");
        assert!(result.is_err());
        std::env::remove_var("PETALFLY_WORKSPACE");
    }

    #[test]
    fn reading_workspace_returns_requests() {
        let _lock = TEST_GUARD.lock().unwrap();
        let dir = tempfile::tempdir().unwrap();
        let workspace_path = dir.path().join("workspace");
        std::env::set_var("PETALFLY_WORKSPACE", &workspace_path);
        save_pfs_file("collections/test.pfs", valid_document()).unwrap();
        let index = read_workspace_index().unwrap();
        assert_eq!(index.requests.len(), 1);
        std::env::remove_var("PETALFLY_WORKSPACE");
    }
}
