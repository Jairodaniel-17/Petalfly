import { create } from "zustand";
import type {
  CurrentRequest,
  EditorTab,
  ExecutedResponse,
  HistoryEntry,
  PlaygroundState,
  SecretCacheEntry,
  VariableDefinition,
  VariableWarning,
  WorkspaceSettings,
} from "@/types/domain";
import type { PetalflyDocument } from "@/types/pfs";
import { parsePfs, stringifyPfs } from "@services/pfsParser";
import {
  appendHistory,
  createFolder,
  createRequest,
  deleteWorkspaceEntry,
  duplicateRequestFile,
  encryptSecret,
  decryptSecret,
  readHistory,
  readWorkspace,
  renameWorkspaceEntry,
  saveEnvironment,
  savePfsFile,
  saveSettings,
} from "@services/tauriBridge";
import { executePetalflyRequest } from "@services/httpClient";

const SECRET_PLACEHOLDER = "••••••";

export interface AppState extends PlaygroundState {
  workspacePath?: string;
  warnings: VariableWarning[];
  history: Record<string, HistoryEntry[]>;
  editorTab: EditorTab;
  secretCache: Record<string, SecretCacheEntry>;
  masterPassword?: string;
  showSecretManager: boolean;
  showSettings: boolean;
  showCurlImport: boolean;
  showNewRequest: boolean;
  showNewFolder: boolean;
  loadWorkspace: () => Promise<void>;
  setActiveRequest: (path: string) => Promise<void>;
  setEditorTab: (tab: EditorTab) => void;
  updateDocument: (doc: PetalflyDocument) => void;
  updateRaw: (raw: string) => void;
  saveActiveRequest: () => Promise<void>;
  sendActiveRequest: () => Promise<void>;
  selectEnvironment: (name: string) => Promise<void>;
  persistSettings: (settings: WorkspaceSettings) => Promise<void>;
  duplicateEnvironment: (source: string, target: string) => Promise<void>;
  createEnvironment: (name: string) => Promise<void>;
  setMasterPassword: (password: string) => void;
  openSecretManager: () => void;
  closeSecretManager: () => void;
  revealSecret: (environment: string, variable: VariableDefinition) => Promise<string>;
  setSecretValue: (environment: string, variableName: string, value: string) => void;
  saveEnvironmentSecrets: (environmentName: string) => Promise<void>;
  updateEnvironmentVariables: (
    environmentName: string,
    variables: VariableDefinition[],
  ) => void;
  openSettings: () => void;
  closeSettings: () => void;
  openCurlImport: () => void;
  closeCurlImport: () => void;
  newRequestDefaults?: { collection?: string };
  openNewRequest: (defaults?: { collection?: string }) => void;
  closeNewRequest: () => void;
  openNewFolder: () => void;
  closeNewFolder: () => void;
  loadHistoryForActiveRequest: () => Promise<void>;
  createCollectionFolder: (path: string) => Promise<void>;
  createNewRequest: (path: string, template: string) => Promise<void>;
  duplicateRequest: (source: string, target: string) => Promise<void>;
  deleteEntry: (path: string) => Promise<void>;
  renameEntry: (from: string, to: string) => Promise<void>;
  importCurlDocument: (doc: PetalflyDocument) => Promise<void>;
}

const secretKey = (environment: string, variable: string) =>
  `${environment}:${variable}`;

const requestIdentifier = (request: CurrentRequest) =>
  request.doc.meta.id || request.path.replace(/\\/g, "/");

export const useAppStore = create<AppState>((set, get) => ({
  requests: [],
  environments: [],
  collectionEnvironments: {},
  folders: [],
  globals: [],
  warnings: [],
  settings: { workspaceName: "Petalfly" },
  loading: false,
  editorTab: "params",
  history: {},
  secretCache: {},
  showSecretManager: false,
  showSettings: false,
  showCurlImport: false,
  showNewRequest: false,
  showNewFolder: false,
  async loadWorkspace() {
    set({ loading: true, error: undefined });
    try {
      const workspace = await readWorkspace();
      const parseIssues: string[] = [];
      const requests: CurrentRequest[] = workspace.requests
        .map((file) => {
          const result = parsePfs(file.content);
          if (!result.doc) {
            parseIssues.push(file.path);
            return undefined;
          }
          return {
            path: file.path,
            raw: file.content,
            doc: result.doc,
          };
        })
        .filter(Boolean) as CurrentRequest[];

      const rawSettings = workspace.settings ?? {};
      const mergedSettings: WorkspaceSettings = {
        ...rawSettings,
        disableMasterPasswordPrompt:
          rawSettings.disableMasterPasswordPrompt ?? true,
      };
      const hasEncryptedSecrets = workspace.environments.some((environment) =>
        environment.variables.some(
          (variable) => variable.secret && isEncryptedSecretValue(variable.value),
        ),
      );
      const encryptionEnabled = isEncryptionEnabled(mergedSettings) || hasEncryptedSecrets;

      const secretCache: Record<string, SecretCacheEntry> = {};
      const environments = workspace.environments.map((environment) => ({
        ...environment,
        variables: environment.variables.map((variable) => {
          if (!variable.secret || !encryptionEnabled) {
            return variable;
          }
          const key = secretKey(environment.name, variable.name);
          secretCache[key] = {
            environment: environment.name,
            variable: variable.name,
            encrypted: variable.value,
          };
          return { ...variable, value: SECRET_PLACEHOLDER };
        }),
      }));

      const defaultEnvironment = mergedSettings.activeEnvironment || undefined;
      const collectionEnvMap = mergedSettings.collectionEnvironmentMap ?? {};
      set({
        requests,
        activeRequestPath: requests[0]?.path,
        environments,
        folders: workspace.folders ?? [],
        collectionEnvironments: collectionEnvMap,
        globals: workspace.globals,
        settings: mergedSettings,
        workspacePath: workspace.workspacePath,
        activeEnvironment: defaultEnvironment,
        loading: false,
        warnings: [],
        editorTab: "params",
        secretCache,
        lastPayload: undefined,
      });
      if (requests[0]) {
        await get().loadHistoryForActiveRequest();
      }
      if (parseIssues.length) {
        set({
          error: `No se pudo parsear: ${parseIssues.join(", ")}`,
        });
      }
    } catch (error) {
      const message =
        (error as Error).message ??
        "No se pudo leer el workspace. Asegúrate de ejecutar `pnpm tauri dev`.";
      set({
        error: message,
        loading: false,
      });
    }
  },
  async setActiveRequest(path) {
    const { requests, collectionEnvironments, activeEnvironment } = get();
    const target = requests.find((request) => request.path === path);
    const keys = getCollectionKeyCandidates(target);
    let mappedEnv: string | undefined;
    for (const key of keys) {
      if (!key) continue;
      mappedEnv = collectionEnvironments[key];
      if (mappedEnv) break;
    }
    const nextState: Partial<AppState> = { activeRequestPath: path, editorTab: "params" };
    if (mappedEnv && mappedEnv !== activeEnvironment) {
      nextState.activeEnvironment = mappedEnv;
    }
    set(nextState);
    await get().loadHistoryForActiveRequest();
  },
  setEditorTab(tab) {
    set({ editorTab: tab });
  },
  updateDocument(doc) {
    const { requests, activeRequestPath } = get();
    if (!activeRequestPath) return;
    const raw = stringifyPfs(doc);
    const updated = requests.map((request) =>
      request.path === activeRequestPath ? { ...request, doc, raw } : request,
    );
    set({ requests: updated });
  },
  updateRaw(raw) {
    const { requests, activeRequestPath } = get();
    if (!activeRequestPath) return;
    const target = requests.find((request) => request.path === activeRequestPath);
    if (!target) return;
    const parsed = parsePfs(raw);
    const updated = requests.map((request) => {
      if (request.path !== activeRequestPath) return request;
      return {
        ...request,
        raw,
        doc: parsed.doc ?? request.doc,
      };
    });
    set({ requests: updated, error: parsed.issues[0]?.message });
  },
  async saveActiveRequest() {
    const { requests, activeRequestPath } = get();
    if (!activeRequestPath) return;
    const target = requests.find((request) => request.path === activeRequestPath);
    if (!target) return;
    const raw = stringifyPfs(target.doc);
    await savePfsFile(target.path, raw);
    const updated = requests.map((request) =>
      request.path === activeRequestPath ? { ...request, raw } : request,
    );
    set({ requests: updated });
  },
  async sendActiveRequest() {
    const {
      requests,
      activeRequestPath,
      environments,
      globals,
      settings,
      activeEnvironment,
    } = get();
    if (!activeRequestPath) return;
    const target = requests.find((request) => request.path === activeRequestPath);
    if (!target) return;
    set({ loading: true, error: undefined });
    try {
      const envDefinition = environments.find(
        (entry) => entry.name === activeEnvironment,
      );
      const resolvedEnvironment = envDefinition
        ? await getResolvedEnvironmentVariables(envDefinition, get, set)
        : [];
      const result = await executePetalflyRequest({
        doc: target.doc,
        environment: resolvedEnvironment,
        globals,
        settings,
      });
      const requestId = requestIdentifier(target);
      const bodyPreview = result.response.body
        ? result.response.body.slice(0, 2000)
        : "";
      const historyEntry: HistoryEntry = {
        status: result.response.status,
        statusText: result.response.statusText,
        durationMs: result.response.durationMs,
        sizeBytes: result.response.sizeBytes,
        timestamp: new Date().toISOString(),
        url: result.payload.url,
        method: result.payload.method,
        bodyPreview,
        resolvedRequest: {
          ...result.payload,
        },
      };
      const newHistory = await appendHistory(
        requestId,
        historyEntry,
        settings.historyLimit,
      );
      set((state) => ({
        response: result.response as ExecutedResponse,
        warnings: result.warnings,
        loading: false,
        lastPayload: result.payload,
        history: {
          ...state.history,
          [requestId]: newHistory,
        },
      }));
    } catch (error) {
      set({
        error: (error as Error).message,
        loading: false,
      });
    }
  },
  async selectEnvironment(name) {
    const state = get();
    const activeRequest = state.requests.find(
      (request) => request.path === state.activeRequestPath,
    );
    const keys = getCollectionKeyCandidates(activeRequest);
    const nextMap = { ...state.collectionEnvironments };
    if (keys.length) {
      keys.forEach((key) => {
        if (!key) return;
        if (name) {
          nextMap[key] = name;
        } else {
          delete nextMap[key];
        }
      });
    }
    const cleanedMap = Object.keys(nextMap).reduce<Record<string, string>>((acc, key) => {
      const value = nextMap[key];
      if (value) acc[key] = value;
      return acc;
    }, {});
    const nextSettings = {
      ...state.settings,
      activeEnvironment: name || undefined,
      collectionEnvironmentMap: Object.keys(cleanedMap).length ? cleanedMap : undefined,
    };
    set({
      activeEnvironment: name || undefined,
      collectionEnvironments: cleanedMap,
      settings: nextSettings,
    });
    await saveSettings(nextSettings);
  },
  async persistSettings(settings) {
    const map = get().collectionEnvironments;
    const payload = {
      ...settings,
      disableMasterPasswordPrompt: settings.disableMasterPasswordPrompt ?? true,
      collectionEnvironmentMap: Object.keys(map).length ? map : undefined,
    };
    await saveSettings(payload);
    set({ settings: payload });
  },
  setMasterPassword(password) {
    set({ masterPassword: password });
  },
  openSecretManager() {
    set({ showSecretManager: true });
  },
  closeSecretManager() {
    set({ showSecretManager: false });
  },
  async revealSecret(environmentName, variable) {
    const state = get();
    const encryptionEnabled = selectEncryptionEnabled(state);
    const shouldDecrypt = encryptionEnabled || isEncryptedSecretValue(variable.value);
    if (!shouldDecrypt) {
      return variable.value ?? "";
    }
    const key = secretKey(environmentName, variable.name);
    const cache = state.secretCache[key];
    if (cache?.value) {
      return cache.value;
    }
    const master = get().masterPassword;
    if (!master) {
      throw new Error("Ingresa la master password primero");
    }
    const encrypted = cache?.encrypted ?? variable.value;
    const value = await decryptSecret(master, encrypted);
    set((state) => ({
      secretCache: {
        ...state.secretCache,
        [key]: {
          environment: environmentName,
          variable: variable.name,
          encrypted,
          value,
        },
      },
    }));
    return value;
  },
  setSecretValue(environment, variableName, value) {
    const stateSnapshot = get();
    const encryptionEnabled = selectEncryptionEnabled(stateSnapshot);
    if (!encryptionEnabled) {
      set((state) => ({
        environments: state.environments.map((env) =>
          env.name === environment
            ? {
                ...env,
                variables: env.variables.map((variable) =>
                  variable.name === variableName ? { ...variable, value } : variable,
                ),
              }
            : env,
        ),
      }));
      return;
    }
    const key = secretKey(environment, variableName);
    const cache = stateSnapshot.secretCache[key];
    set((state) => ({
      secretCache: {
        ...state.secretCache,
        [key]: {
          environment,
          variable: variableName,
          encrypted: cache?.encrypted ?? "",
          value,
        },
      },
    }));
  },
  async saveEnvironmentSecrets(environmentName) {
    const stateSnapshot = get();
    const { environments, masterPassword, secretCache } = stateSnapshot;
    const encryptionEnabled = selectEncryptionEnabled(stateSnapshot);
    const target = environments.find((env) => env.name === environmentName);
    if (!target) return;
    if (!encryptionEnabled) {
      await saveEnvironment(target);
      return;
    }
    if (!masterPassword) {
      throw new Error("Master password requerida");
    }
    const updatedVariables: VariableDefinition[] = [];
    const nextCache = { ...secretCache };
    for (const variable of target.variables) {
      if (!variable.secret) {
        updatedVariables.push(variable);
        continue;
      }
      const key = secretKey(environmentName, variable.name);
      const cacheValue = nextCache[key];
      const plain =
        cacheValue?.value && cacheValue.value !== SECRET_PLACEHOLDER
          ? cacheValue.value
          : cacheValue?.encrypted
            ? await decryptSecret(masterPassword, cacheValue.encrypted)
            : "";
      const encrypted = await encryptSecret(masterPassword, plain);
      updatedVariables.push({ ...variable, value: SECRET_PLACEHOLDER });
      nextCache[key] = {
        environment: environmentName,
        variable: variable.name,
        encrypted,
        value: plain,
      };
    }
    await saveEnvironment({
      ...target,
      variables: updatedVariables.map((variable) => ({
        ...variable,
        value: variable.secret ? nextCache[secretKey(environmentName, variable.name)].encrypted : variable.value,
      })),
    });
    const refreshedEnvs = environments.map((env) =>
      env.name === environmentName
        ? { ...env, variables: updatedVariables }
        : env,
    );
    set({ environments: refreshedEnvs, secretCache: nextCache });
  },
  async duplicateEnvironment(sourceName, targetName) {
    const stateSnapshot = get();
    const { environments, secretCache } = stateSnapshot;
    const encryptionEnabled = selectEncryptionEnabled(stateSnapshot);
    const source = environments.find((env) => env.name === sourceName);
    if (!source) {
      throw new Error("Entorno origen no encontrado");
    }
    const nextName = sanitizeEnvironmentName(targetName);
    if (!nextName) {
      throw new Error("Nombre inválido");
    }
    if (environments.some((env) => env.name === nextName)) {
      throw new Error("Ya existe un entorno con ese nombre");
    }
    const slug = slugify(nextName);
    const path = `environments/${slug}.yaml`;
    const preparedVariables = source.variables.map((variable) => {
      if (!variable.secret || !encryptionEnabled) {
        return { ...variable };
      }
      const cacheKey = secretKey(source.name, variable.name);
      const encrypted = secretCache[cacheKey]?.encrypted ?? variable.value;
      return { ...variable, value: encrypted };
    });
    await saveEnvironment({
      name: nextName,
      path,
      variables: preparedVariables,
    });
    const maskedVariables = encryptionEnabled
      ? preparedVariables.map((variable) =>
          variable.secret ? { ...variable, value: SECRET_PLACEHOLDER } : variable,
        )
      : preparedVariables;
    const nextCache = { ...secretCache };
    if (encryptionEnabled) {
      preparedVariables.forEach((variable) => {
        if (!variable.secret) return;
        nextCache[secretKey(nextName, variable.name)] = {
          environment: nextName,
          variable: variable.name,
          encrypted: (variable.value ?? "") as string,
        };
      });
    }
    set((state) => ({
      environments: [...state.environments, { name: nextName, path, variables: maskedVariables }],
      secretCache: nextCache,
    }));
  },
  async createEnvironment(targetName) {
    const nextName = sanitizeEnvironmentName(targetName);
    if (!nextName) {
      throw new Error("Nombre inválido");
    }
    if (get().environments.some((env) => env.name === nextName)) {
      throw new Error("Ya existe un entorno con ese nombre");
    }
    const slug = slugify(nextName);
    const path = `environments/${slug}.yaml`;
    await saveEnvironment({
      name: nextName,
      path,
      variables: [],
    });
    set((state) => ({
      environments: [...state.environments, { name: nextName, path, variables: [] }],
    }));
  },
  updateEnvironmentVariables(environmentName, variables) {
    set((state) => ({
      environments: state.environments.map((env) =>
        env.name === environmentName ? { ...env, variables } : env,
      ),
    }));
  },
  openSettings() {
    set({ showSettings: true });
  },
  closeSettings() {
    set({ showSettings: false });
  },
  openCurlImport() {
    set({ showCurlImport: true });
  },
  closeCurlImport() {
    set({ showCurlImport: false });
  },
  async loadHistoryForActiveRequest() {
    const { activeRequestPath, requests } = get();
    if (!activeRequestPath) return;
    const target = requests.find((req) => req.path === activeRequestPath);
    if (!target) return;
    const key = requestIdentifier(target);
    const entries = await readHistory(key);
    set((state) => ({
      history: {
        ...state.history,
        [key]: entries,
      },
    }));
  },
  async createCollectionFolder(path) {
    await createFolder(path);
    await get().loadWorkspace();
  },
  openNewRequest(defaults) {
    set({ showNewRequest: true, newRequestDefaults: defaults });
  },
  closeNewRequest() {
    set({ showNewRequest: false, newRequestDefaults: undefined });
  },
  openNewFolder() {
    set({ showNewFolder: true });
  },
  closeNewFolder() {
    set({ showNewFolder: false });
  },
  async createNewRequest(path, template) {
    await createRequest(path, template);
    await get().loadWorkspace();
    await get().setActiveRequest(path);
  },
  async duplicateRequest(source, targetPath) {
    await duplicateRequestFile(source, targetPath);
    await get().loadWorkspace();
    await get().setActiveRequest(targetPath);
  },
  async deleteEntry(path) {
    await deleteWorkspaceEntry(path);
    await get().loadWorkspace();
  },
  async renameEntry(from, to) {
    await renameWorkspaceEntry(from, to);
    await get().loadWorkspace();
    if (to.endsWith(".pfs")) {
      await get().setActiveRequest(to);
    }
  },
  async importCurlDocument(doc) {
    const collectionName = doc.meta.collection || "Importados";
    const filename = doc.meta.id || `req-${Date.now()}`;
    const targetPath = `collections/${collectionName}/${filename}.pfs`;
    const raw = stringifyPfs(doc);
    await createRequest(targetPath, raw);
    await get().loadWorkspace();
    await get().setActiveRequest(targetPath);
  },
}));

async function getResolvedEnvironmentVariables(
  environment: { name: string; variables: VariableDefinition[] },
  getState: () => AppState,
  setState: (
    partial:
      | AppState
      | Partial<AppState>
      | ((state: AppState) => AppState | Partial<AppState>),
  ) => void,
) {
  const state = getState();
  const encryptionEnabled = selectEncryptionEnabled(state);
  if (!encryptionEnabled) {
    return environment.variables;
  }
  const resolved: VariableDefinition[] = [];
  for (const variable of environment.variables) {
    if (!variable.secret) {
      resolved.push(variable);
      continue;
    }
    const key = secretKey(environment.name, variable.name);
    const cache = state.secretCache[key];
    let value = cache?.value;
    if (!value) {
      const master = state.masterPassword;
      if (!master) {
        throw new Error("Master password requerida para descifrar secrets");
      }
      const encrypted = cache?.encrypted ?? variable.value;
      value = await decryptSecret(master, encrypted);
      setState((prev) => ({
        secretCache: {
          ...prev.secretCache,
          [key]: {
            environment: environment.name,
            variable: variable.name,
            encrypted,
            value,
          },
        },
      }));
    }
    resolved.push({ ...variable, value });
  }
  return resolved;
}

export const selectActiveRequest = (state: AppState) =>
  state.requests.find((request) => request.path === state.activeRequestPath);

export const selectEncryptionEnabled = (state: AppState) =>
  isEncryptionEnabled(state.settings) || hasEncryptedSecrets(state.environments);

function hasEncryptedSecrets(environments: Array<{ variables: VariableDefinition[] }>) {
  return environments.some((environment) =>
    environment.variables.some(
      (variable) => variable.secret && isEncryptedSecretValue(variable.value),
    ),
  );
}

function isEncryptedSecretValue(value?: string) {
  if (!value) return false;
  if (value === SECRET_PLACEHOLDER) {
    return true;
  }
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return false;
  }
  try {
    const payload = JSON.parse(trimmed);
    return (
      typeof payload === "object" &&
      payload !== null &&
      typeof payload.salt === "string" &&
      typeof payload.nonce === "string" &&
      typeof payload.data === "string"
    );
  } catch {
    return false;
  }
}

function isEncryptionEnabled(settings?: WorkspaceSettings) {
  return settings?.disableMasterPasswordPrompt === false;
}

function getCollectionKeyCandidates(request?: CurrentRequest) {
  if (!request) return [];
  const candidates: string[] = [];
  const meta = request.doc.meta.collection?.trim();
  const derived = deriveCollectionKeyFromPath(request.path);
  if (meta) candidates.push(meta);
  if (derived && derived !== meta) candidates.push(derived);
  return candidates;
}

function deriveCollectionKeyFromPath(path?: string) {
  if (!path) return undefined;
  const cleaned = path
    .replace(/^collections[\\/]/i, "")
    .replace(/\\/g, "/")
    .replace(/\/[^/]+$/, "");
  return cleaned || undefined;
}

function sanitizeEnvironmentName(value: string) {
  return value.trim();
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "env";
}
