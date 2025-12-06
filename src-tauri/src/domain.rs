use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSettings {
    #[serde(default = "default_workspace_name")]
    pub workspace_name: String,
    #[serde(default)]
    pub active_environment: Option<String>,
    #[serde(default = "default_timeout")]
    pub timeout_ms: Option<u64>,
    #[serde(default)]
    pub ignore_ssl: Option<bool>,
    #[serde(default)]
    pub theme: Option<String>,
    #[serde(default)]
    pub history_limit: Option<usize>,
    #[serde(default)]
    pub debug_logs: Option<bool>,
    #[serde(default)]
    pub workspace_override: Option<String>,
    #[serde(default)]
    pub collection_environment_map: Option<std::collections::HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VariableDefinition {
    pub name: String,
    pub value: String,
    #[serde(default)]
    pub secret: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentFile {
    pub name: String,
    pub path: String,
    pub variables: Vec<VariableDefinition>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceRequestFile {
    pub path: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceFolder {
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceIndex {
    pub workspace_path: String,
    pub requests: Vec<WorkspaceRequestFile>,
    pub folders: Vec<WorkspaceFolder>,
    pub environments: Vec<EnvironmentFile>,
    pub globals: Vec<VariableDefinition>,
    pub settings: WorkspaceSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutablePayload {
    pub method: String,
    pub url: String,
    pub headers: std::collections::HashMap<String, String>,
    pub body: Option<ExecutableBody>,
    pub timeout_ms: Option<u64>,
    #[serde(default)]
    pub allow_insecure: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutableBody {
    pub r#type: String,
    pub value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphQLPayload {
    pub method: Option<String>,
    pub url: String,
    pub headers: std::collections::HashMap<String, String>,
    pub query: String,
    pub variables: Option<serde_json::Value>,
    pub timeout_ms: Option<u64>,
    #[serde(default)]
    pub allow_insecure: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct GRPCPayload {
    pub url: String,
    pub service: String,
    pub method: String,
    pub request: serde_json::Value,
    pub headers: std::collections::HashMap<String, String>,
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebSocketPayload {
    pub url: String,
    pub headers: std::collections::HashMap<String, String>,
    pub messages: Vec<WebSocketMessage>,
    pub timeout_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebSocketMessage {
    pub message_type: String,
    pub data: String,
}



#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ExecutedResponse {
    pub status: Option<u16>,
    pub status_text: Option<String>,
    pub headers: std::collections::HashMap<String, String>,
    pub body: String,
    pub duration_ms: Option<u128>,
    pub size_bytes: Option<u64>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryEntry {
    pub status: Option<u16>,
    pub status_text: Option<String>,
    pub duration_ms: Option<u128>,
    pub size_bytes: Option<u64>,
    pub timestamp: String,
    pub url: String,
    pub method: String,
    pub body_preview: Option<String>,
    pub resolved_request: serde_json::Value,
}

const fn default_timeout() -> Option<u64> {
    Some(30_000)
}

fn default_workspace_name() -> String {
    "Petalfly Workspace".to_string()
}
