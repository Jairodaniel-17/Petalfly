import type { HttpMethod, PetalflyDocument } from "@/types/pfs";
import type { ResolvedRequestPayload } from "@/types/domain";

export function buildCurlCommand(payload?: ResolvedRequestPayload): string {
  if (!payload) {
    return "curl --help # No hay request ejecutado aún";
  }
  const parts: string[] = [
    `curl -X ${payload.method} "${payload.url}"`,
  ];
  Object.entries(payload.headers ?? {}).forEach(([key, value]) => {
    parts.push(`  -H "${key}: ${value}"`);
  });
  if (payload.body?.value) {
    const sanitized = payload.body.value.replace(/"/g, '\\"');
    const flag = payload.method === "GET" ? "--data" : "--data-raw";
    parts.push(`  ${flag} "${sanitized}"`);
  }
  if (payload.allow_insecure) {
    parts.push("  -k");
  }
  return parts.join(" \\\n");
}

export function importCurl(raw: string): PetalflyDocument {
  const tokens = tokenizeCurl(raw);
  let method: HttpMethod = "GET";
  let url = "";
  const headers: Record<string, string> = {};
  let bodyValue = "";

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.toLowerCase() === "curl") continue;
    if (token === "-X" || token === "--request") {
      method = normalizeMethod(tokens[++i]);
      continue;
    }
    const candidateUrl = stripQuotes(token);
    if (candidateUrl.startsWith("http")) {
      url = candidateUrl;
      continue;
    }
    if (token === "-H" || token === "--header") {
      const headerValue = stripQuotes(tokens[++i] ?? "");
      const [key, ...rest] = headerValue.split(":");
      headers[key.trim()] = rest.join(":").trim();
      continue;
    }
    if (token.startsWith("-d") || token.startsWith("--data")) {
      const data = stripQuotes(tokens[++i] ?? "");
      bodyValue = data;
      continue;
    }
  }

  return {
    version: "1.0",
    meta: {
      id: `curl-${Date.now()}`,
      name: "Importado desde cURL",
      collection: "Importados",
      tags: [],
    },
    request: {
      method,
      url,
      headers,
      query: {},
      body: bodyValue
        ? {
            type: guessBodyType(bodyValue),
            value: bodyValue,
          }
        : { type: "none" },
      auth: { type: "none" },
    },
    docs: "Importado automáticamente desde un comando curl.",
  };
}

function tokenizeCurl(command: string): string[] {
  const normalized = command.replace(/\\\r?\n/g, " ");
  return normalized.match(/"[^"]+"|'[^']+'|\S+/g) ?? [];
}

function stripQuotes(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function guessBodyType(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return "json";
  }
  if (trimmed.includes("=") && trimmed.includes("&")) {
    return "urlencoded";
  }
  return "text";
}

const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];

function normalizeMethod(value?: string): HttpMethod {
  if (!value) {
    return "GET";
  }
  const upper = value.toUpperCase();
  return HTTP_METHODS.includes(upper as HttpMethod) ? (upper as HttpMethod) : "GET";
}
