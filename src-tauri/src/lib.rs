mod commands;
mod crypto;
mod domain;
mod history;
mod http_client;
mod pfs_parser;
mod test_runner;

use commands::fs as fs_commands;
use crypto::{decrypt_secret as decrypt, encrypt_secret as encrypt};
use domain::{
    EnvironmentFile, ExecutablePayload, ExecutedResponse, HistoryEntry, WorkspaceIndex,
    WorkspaceSettings,
};
use history::{append_history, read_history};
use http_client::execute_http;

#[tauri::command]
async fn read_workspace_index() -> Result<WorkspaceIndex, String> {
    fs_commands::read_workspace_index().map_err(|err| err.to_string())
}

#[tauri::command]
async fn save_pfs_file(path: String, content: String) -> Result<(), String> {
    fs_commands::save_pfs_file(&path, &content).map_err(|err| err.to_string())
}

#[tauri::command]
async fn save_settings(settings: WorkspaceSettings) -> Result<(), String> {
    fs_commands::save_settings(&settings).map_err(|err| err.to_string())
}

#[tauri::command]
async fn save_environment(environment: EnvironmentFile) -> Result<(), String> {
    fs_commands::save_environment_file(&environment).map_err(|err| err.to_string())
}

#[tauri::command]
async fn execute_request(payload: ExecutablePayload) -> Result<ExecutedResponse, String> {
    execute_http(payload).await.map_err(|err| err.to_string())
}

#[tauri::command]
fn encrypt_secret(password: String, value: String) -> Result<String, String> {
    encrypt(&password, &value).map_err(|err| err.to_string())
}

#[tauri::command]
fn decrypt_secret(password: String, payload: String) -> Result<String, String> {
    decrypt(&password, &payload).map_err(|err| err.to_string())
}

#[tauri::command]
fn encrypt_value(plaintext: String, master_password: String) -> Result<String, String> {
    encrypt(&master_password, &plaintext).map_err(|err| err.to_string())
}

#[tauri::command]
fn decrypt_value(ciphertext: String, master_password: String) -> Result<String, String> {
    decrypt(&master_password, &ciphertext).map_err(|err| err.to_string())
}

#[tauri::command]
fn append_history_entry(
    request_id: String,
    entry: HistoryEntry,
    limit: Option<usize>,
) -> Result<Vec<HistoryEntry>, String> {
    append_history(&request_id, entry, limit).map_err(|err| err.to_string())
}

#[tauri::command]
fn read_history_entries(request_id: String) -> Result<Vec<HistoryEntry>, String> {
    read_history(&request_id).map_err(|err| err.to_string())
}

#[tauri::command]
async fn create_folder(path: String) -> Result<(), String> {
    fs_commands::create_collection_folder(&path).map_err(|err| err.to_string())
}

#[tauri::command]
async fn create_request(path: String, template: String) -> Result<(), String> {
    fs_commands::create_request_file(&path, &template).map_err(|err| err.to_string())
}

#[tauri::command]
async fn duplicate_request(path: String, destination: String) -> Result<(), String> {
    fs_commands::duplicate_request(&path, &destination).map_err(|err| err.to_string())
}

#[tauri::command]
async fn delete_entry(path: String) -> Result<(), String> {
    fs_commands::delete_entry(&path).map_err(|err| err.to_string())
}

#[tauri::command]
async fn rename_entry(from: String, to: String) -> Result<(), String> {
    fs_commands::rename_entry(&from, &to).map_err(|err| err.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            read_workspace_index,
            save_pfs_file,
            save_settings,
            save_environment,
            execute_request,
            encrypt_secret,
            decrypt_secret,
            encrypt_value,
            decrypt_value,
            append_history_entry,
            read_history_entries,
            create_folder,
            create_request,
            duplicate_request,
            delete_entry,
            rename_entry
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
