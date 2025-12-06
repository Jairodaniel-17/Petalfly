import type {
  ExecutedResponse,
  HistoryEntry,
  WorkspaceIndex,
  WorkspaceSettings,
  EnvironmentFile,
} from "@/types/domain";
import { invoke } from "@tauri-apps/api/core";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export interface ExecutablePayload {
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

export interface GraphQLPayload {
  method?: string;
  url: string;
  headers: Record<string, string>;
  query: string;
  variables?: any;
  timeout_ms?: number;
  allow_insecure?: boolean;
}

export interface WebSocketPayload {
  url: string;
  headers: Record<string, string>;
  messages: WebSocketMessage[];
  timeout_ms?: number;
}

export interface WebSocketMessage {
  message_type: string;
  data: string;
}

const call = <T>(command: string, payload?: Record<string, unknown>) => {
  if (
    typeof window === "undefined" ||
    typeof window.__TAURI_INTERNALS__ === "undefined"
  ) {
    // En entorno web (pnpm dev) ejecutamos sin invocar a Tauri, para permitir el render.
    // Muchas funciones dependen del backend y lanzarán error luego, pero la app no se quedará en blanco.
    console.warn(`[Petalfly] Comando ${command} ignorado porque Tauri no está disponible.`);
    throw new Error("El backend de Tauri no está disponible en modo sólo web.");
  }
  return invoke<T>(command, payload);
};

export const readWorkspace = () =>
  call<WorkspaceIndex>("read_workspace_index");

export const savePfsFile = (path: string, content: string) =>
  call<void>("save_pfs_file", { path, content });

export const saveEnvironment = (environment: EnvironmentFile) =>
  call<void>("save_environment", { environment });

export const executeRequest = (payload: ExecutablePayload) =>
  call<ExecutedResponse>("execute_request", { payload });

export const executeGraphQLRequest = (payload: GraphQLPayload) =>
  call<ExecutedResponse>("execute_graphql_request", { payload });

export const executeWebSocketRequest = (payload: WebSocketPayload) =>
  call<ExecutedResponse>("execute_websocket_request", { payload });

export const saveSettings = (settings: WorkspaceSettings) =>
  call<void>("save_settings", { settings });

export const encryptSecret = (password: string, value: string) =>
  call<string>("encrypt_value", { masterPassword: password, plaintext: value });

export const decryptSecret = (password: string, payload: string) =>
  call<string>("decrypt_value", { masterPassword: password, ciphertext: payload });

export const readHistory = (requestId: string) =>
  call<HistoryEntry[]>("read_history_entries", { requestId });

export const appendHistory = (
  requestId: string,
  entry: HistoryEntry,
  limit?: number,
) =>
  call<HistoryEntry[]>("append_history_entry", {
    requestId,
    entry,
    limit,
  });

export const createFolder = (path: string) =>
  call<void>("create_folder", { path });

export const createRequest = (path: string, template: string) =>
  call<void>("create_request", { path, template });

export const duplicateRequestFile = (path: string, destination: string) =>
  call<void>("duplicate_request", { path, destination });

export const deleteWorkspaceEntry = (path: string) =>
  call<void>("delete_entry", { path });

export const renameWorkspaceEntry = (from: string, to: string) =>
  call<void>("rename_entry", { from, to });
