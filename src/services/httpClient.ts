import type {
  ExecutedResponse,
  VariableDefinition,
  VariableWarning,
  WorkspaceSettings,
} from "@/types/domain";
import type { PetalflyDocument } from "@/types/pfs";
import { resolveDocument } from "./variableResolver";
import { runTests } from "./testRunner";
import { executeRequest } from "./tauriBridge";
import type { ExecutablePayload } from "./tauriBridge";

export interface ExecutionContext {
  doc: PetalflyDocument;
  environment?: VariableDefinition[];
  globals?: VariableDefinition[];
  settings: WorkspaceSettings;
}

export interface ExecutionResult {
  response: ExecutedResponse;
  warnings: VariableWarning[];
  payload: ExecutablePayload;
}

export async function executePetalflyRequest({
  doc,
  environment,
  globals,
  settings,
}: ExecutionContext): Promise<ExecutionResult> {
  const resolved = resolveDocument({ doc, environment, globals });
  const payload = buildPayload(resolved.doc, settings, resolved.variables);
  const response = await executeRequest(payload);
  if (doc.tests?.length) {
    const results = runTests(doc.tests, response);
    response.tests = results;
  }
  return { response, warnings: resolved.warnings, payload };
}

function buildPayload(
  doc: PetalflyDocument,
  settings: WorkspaceSettings,
  variables: Record<string, string>,
): ExecutablePayload {
  const headers: Record<string, string> = { ...(doc.request.headers ?? {}) };
  let url = appendQuery(doc.request.url, doc.request.query);

  if (doc.request.auth) {
    const authHeader = resolveAuth(doc.request.auth, variables);
    if (authHeader?.type === "header") {
      headers[authHeader.name] = authHeader.value;
    } else if (authHeader?.type === "query") {
      url = appendQuery(url, { [authHeader.name]: authHeader.value });
    }
  }

  return {
    method: doc.request.method,
    url,
    headers,
    body: doc.request.body ?? { type: "none" },
    timeout_ms: doc.request.timeout_ms ?? settings.timeoutMs,
    allow_insecure: settings.ignoreSsl ?? false,
  };
}

function appendQuery(
  url: string,
  query?: Record<string, any>,
): string {
  if (!query || !Object.keys(query).length) {
    return url;
  }
  const params = Object.entries(query)
    .map(([key, value]) => {
      if (!key) return undefined;
      if (typeof value === "string") {
        return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
      }
      const entry = value as { value: string; enabled?: boolean };
      if (entry.enabled === false) return undefined;
      return `${encodeURIComponent(key)}=${encodeURIComponent(entry.value)}`;
    })
    .filter(Boolean)
    .join("&");
  if (!params) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${params}`;
}

const EXACT_TOKEN = /^\s*\{\{\s*([\w.\-]+)\s*\}\}\s*$/;

function resolveAuth(
  auth: PetalflyDocument["request"]["auth"],
  variables: Record<string, string>,
):
  | { type: "header"; name: string; value: string }
  | { type: "query"; name: string; value: string }
  | undefined {
  if (!auth || auth.type === "none") return undefined;
  switch (auth.type) {
    case "bearer": {
      const token = resolveAuthValue(auth.bearer_token_var, variables);
      if (!token) return undefined;
      return { type: "header", name: "Authorization", value: `Bearer ${token}` };
    }
    case "basic": {
      const user = resolveAuthValue(auth.basic_user_var, variables);
      const password = resolveAuthValue(auth.basic_password_var, variables);
      if (!user || !password) return undefined;
      const encoded = btoa(`${user}:${password}`);
      return { type: "header", name: "Authorization", value: `Basic ${encoded}` };
    }
    case "apiKey": {
      const key = resolveAuthValue(auth.api_key_var, variables);
      if (!auth.name || !key) return undefined;
      if (auth.in === "query") {
        return { type: "query", name: auth.name, value: key };
      }
      return { type: "header", name: auth.name, value: key };
    }
    default:
      return undefined;
  }
}

function resolveAuthValue(field: string | undefined, variables: Record<string, string>) {
  if (!field) return undefined;
  const trimmed = field.trim();
  const match = trimmed.match(EXACT_TOKEN);
  if (match) {
    const key = match[1];
    return variables[key];
  }
  return trimmed || undefined;
}
