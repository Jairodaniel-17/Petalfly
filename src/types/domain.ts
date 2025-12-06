import type { PetalflyDocument } from "./pfs";

export interface WorkspaceSettings {
  workspaceName: string;
  activeEnvironment?: string;
  timeoutMs?: number;
  ignoreSsl?: boolean;
  theme?: string;
  disableMasterPasswordPrompt?: boolean;
  historyLimit?: number;
  debugLogs?: boolean;
  workspaceOverride?: string;
  collectionEnvironmentMap?: Record<string, string>;
}

export interface WorkspaceIndex {
  workspacePath: string;
  requests: WorkspaceRequestFile[];
  folders: WorkspaceFolder[];
  environments: EnvironmentFile[];
  globals: VariableDefinition[];
  settings: WorkspaceSettings;
}

export interface WorkspaceFolder {
  path: string;
}

export interface WorkspaceRequestFile {
  path: string;
  content: string;
}

export interface EnvironmentFile {
  name: string;
  path: string;
  variables: VariableDefinition[];
}

export interface VariableDefinition {
  name: string;
  value: string;
  secret?: boolean;
}

export interface SecretCacheEntry {
  environment: string;
  variable: string;
  encrypted: string;
  value?: string;
}

export interface CurrentRequest {
  path: string;
  raw: string;
  doc: PetalflyDocument;
}

export interface ExecutedResponse {
  status: number | null;
  statusText: string | null;
  headers: Record<string, string>;
  body: string;
  durationMs: number | null;
  sizeBytes?: number | null;
  error?: string;
  tests?: TestResult[];
}

export interface ResolvedRequestPayload {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: {
    type: string;
    value?: string;
  };
  timeout_ms?: number;
  allow_insecure?: boolean;
}

export interface VariableWarning {
  variable: string;
  message: string;
}

export interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
}

export interface HistoryEntry {
  status?: number | null;
  statusText?: string | null;
  durationMs?: number | null;
  sizeBytes?: number | null;
  timestamp: string;
  url: string;
  method?: string;
  bodyPreview?: string | null;
  resolvedRequest?: Record<string, unknown>;
}

export type EditorTab =
  | "params"
  | "headers"
  | "body"
  | "auth"
  | "tests"
  | "docs"
  | "raw";

export interface HistoryState {
  entries: HistoryEntry[];
}

export interface PlaygroundState {
  requests: CurrentRequest[];
  activeRequestPath?: string;
  activeEnvironment?: string;
  environments: EnvironmentFile[];
  collectionEnvironments: Record<string, string>;
  folders: WorkspaceFolder[];
  globals: VariableDefinition[];
  response?: ExecutedResponse;
  warnings?: VariableWarning[];
  settings: WorkspaceSettings;
  loading: boolean;
  error?: string;
  editorTab: EditorTab;
  history: Record<string, HistoryEntry[]>;
  masterPassword?: string;
  secretCache: Record<string, SecretCacheEntry>;
  showSecretManager: boolean;
  showSettings: boolean;
  showCurlImport: boolean;
  lastPayload?: any;
  newRequestDefaults?: {
    collection?: string;
  };
}
