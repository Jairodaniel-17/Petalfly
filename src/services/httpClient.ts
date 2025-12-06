import type {
  ExecutedResponse,
  VariableDefinition,
  VariableWarning,
  WorkspaceSettings,
} from "@/types/domain";
import type { PetalflyDocument } from "@/types/pfs";
import { resolveDocument } from "./variableResolver";
import { runTests } from "./testRunner";
import { executeRequest, executeGraphQLRequest, executeWebSocketRequest } from "./tauriBridge";
import type { ExecutablePayload, GraphQLPayload, WebSocketPayload } from "./tauriBridge";

export interface ExecutionContext {
  doc: PetalflyDocument;
  environment?: VariableDefinition[];
  globals?: VariableDefinition[];
  settings: WorkspaceSettings;
}

export interface ExecutionResult {
  response: ExecutedResponse;
  warnings: VariableWarning[];
  payload: any;
}

export async function executePetalflyRequest({
  doc,
  environment,
  globals,
  settings,
}: ExecutionContext): Promise<ExecutionResult> {
  const resolved = resolveDocument({ doc, environment, globals });
  let response: ExecutedResponse;
  let payload: ExecutablePayload | GraphQLPayload;
  if (doc.protocol === "graphql") {
    payload = buildGraphQLPayload(resolved.doc, settings, resolved.variables);
    response = await executeGraphQLRequest(payload as GraphQLPayload);
  } else if (doc.protocol === "websocket") {
    payload = buildWebSocketPayload(resolved.doc, settings, resolved.variables);
    response = await executeWebSocketRequest(payload as WebSocketPayload);
  } else {
    payload = buildHTTPPayload(resolved.doc, settings, resolved.variables);
    response = await executeRequest(payload as ExecutablePayload);
  }
  // Tests only for HTTP-like responses
  if (doc.protocol !== "websocket" && doc.tests?.length) {
    const results = runTests(doc.tests, response as ExecutedResponse);
    (response as ExecutedResponse).tests = results;
  }
  return { response, warnings: resolved.warnings, payload };
}

function buildHTTPPayload(
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

  const body = doc.request.body ?? { type: "none" };
  let bodyValue = body.value ?? "";
  if (body.type === "urlencoded" || body.type === "form-data") {
    try {
      const obj = JSON.parse(bodyValue);
      bodyValue = new URLSearchParams(obj).toString();
    } catch {
      // keep as is
    }
  }

  if (body.type !== "none") {
    if (body.type === "json") {
      headers["content-type"] = "application/json";
    } else if (body.type === "text") {
      headers["content-type"] = "text/plain";
    } else if (body.type === "urlencoded" || body.type === "form-data") {
      headers["content-type"] = "application/x-www-form-urlencoded";
    }
  }

  return {
    method: doc.request.method,
    url,
    headers,
    body: { ...body, value: bodyValue },
    timeout_ms: settings.timeoutMs,
    allow_insecure: settings.ignoreSsl,
  };
}

function buildWebSocketPayload(
  doc: PetalflyDocument,
  settings: WorkspaceSettings,
  variables: Record<string, string>,
): WebSocketPayload {
  const headers: Record<string, string> = { ...(doc.request.headers ?? {}) };
  const url = doc.request.url;

  if (doc.request.auth) {
    const authHeader = resolveAuth(doc.request.auth, variables);
    if (authHeader?.type === "header") {
      headers[authHeader.name] = authHeader.value;
    }
  }

  // For WebSocket, messages from body or empty
  let messages = [];
  if (doc.request.body?.value) {
    try {
      messages = JSON.parse(doc.request.body.value);
    } catch {
      messages = [{ message_type: "text", data: doc.request.body.value }];
    }
  }

  return {
    url,
    headers,
    messages,
    timeout_ms: settings.timeoutMs,
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
      const token = resolveAuthValue(auth.bearer_token, variables);
      if (!token) return undefined;
      return { type: "header", name: "Authorization", value: `Bearer ${token}` };
    }
    case "basic": {
      const user = resolveAuthValue(auth.basic_user, variables);
      const password = resolveAuthValue(auth.basic_password, variables);
      if (!user || !password) return undefined;
      const encoded = btoa(`${user}:${password}`);
      return { type: "header", name: "Authorization", value: `Basic ${encoded}` };
    }
    case "apiKey": {
      const key = resolveAuthValue(auth.api_key, variables);
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
