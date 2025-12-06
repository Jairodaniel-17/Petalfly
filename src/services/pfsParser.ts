import YAML from "yaml";
import type {
  ParseIssue,
  PetalflyAuth,
  PetalflyBody,
  PetalflyDocument,
  PetalflyRequest,
  PetalflyTest,
  QueryParam,
} from "@/types/pfs";

const VERSION_LINE = "petalfly 1.0";
const TRIPLE_DOCS =
  /^(\s*)docs:\s*"""\s*\r?\n([\s\S]*?)\r?\n^\1"""(?=\r?\n|$)/gm;

export interface ParseResult {
  doc: PetalflyDocument | null;
  issues: ParseIssue[];
}

export function parsePfs(raw: string): ParseResult {
  const issues: ParseIssue[] = [];
  if (!raw.trim()) {
    return { doc: null, issues: [{ message: "Documento vacío" }] };
  }

  const normalizedRaw = raw.replace(/\r\n/g, "\n");
  const [header, ...contentLines] = normalizedRaw.split("\n");
  if (header?.trim() !== VERSION_LINE) {
    issues.push({
      message: `Encabezado inválido, se esperaba "${VERSION_LINE}"`,
      path: "petalfly",
    });
  }

  const yamlSource = convertTripleDocs(contentLines.join("\n"));
  let parsed: Record<string, unknown> = {};
  try {
    parsed = YAML.parse(yamlSource) ?? {};
  } catch (error) {
    issues.push({
      message: `Error al parsear YAML: ${(error as Error).message}`,
    });
    return { doc: null, issues };
  }

  const doc: PetalflyDocument = {
    version: "1.0",
    meta: parseMeta(parsed.meta, issues),
    request: parseRequest(parsed.request, issues),
    docs: typeof parsed.docs === "string" ? parsed.docs : undefined,
    tests: parseTests(parsed.tests, issues),
    examples: Array.isArray(parsed.examples)
      ? parsed.examples.map((ex: any) => ({
          name: String(ex?.name ?? "example"),
          curl: String(ex?.curl ?? ""),
        }))
      : undefined,
  };

  if (!doc.meta.id) {
    issues.push({ message: "meta.id es obligatorio", path: "meta.id" });
  }

  if (!doc.meta.name) {
    issues.push({ message: "meta.name es obligatorio", path: "meta.name" });
  }

  if (!doc.request.method || !doc.request.url) {
    issues.push({
      message: "request.method y request.url son obligatorios",
      path: "request",
    });
  }

  return { doc, issues };
}

export function stringifyPfs(doc: PetalflyDocument): string {
  const { docs, ...rest } = doc;
  const payload: Record<string, unknown> = {
    meta: rest.meta,
    request: sanitizeRequest(rest.request),
    tests: rest.tests,
    examples: rest.examples,
  };

  const yaml = YAML.stringify(payload, {
    indent: 2,
    sortMapEntries: false,
  }).trimEnd();

  let output = `${VERSION_LINE}\n${yaml}`;
  if (docs) {
    output += `\ndocs: """\n${docs}\n"""`;
  }
  return `${output}\n`;
}

export function detectVariables(value: string): string[] {
  const matches = value.match(/\{\{\s*([\w\.\-]+)\s*\}\}/g) ?? [];
  return matches
    .map((token) => token.replace(/[{}]/g, "").trim())
    .filter(Boolean);
}

export function collectDocumentVariables(doc: PetalflyDocument): string[] {
  const values: string[] = [
    doc.request.url,
    ...(doc.docs ? [doc.docs] : []),
  ];
  if (doc.request.headers) {
    values.push(...Object.values(doc.request.headers));
  }
  if (doc.request.query) {
    Object.values(doc.request.query).forEach((entry) => {
      if (typeof entry === "string") {
        values.push(entry);
        return;
      }
      const queryEntry = entry as QueryParam;
      if (queryEntry.value) {
        values.push(queryEntry.value);
      }
    });
  }
  if (doc.request.body?.value) {
    values.push(doc.request.body.value);
  }
  if (doc.request.auth) {
    const { auth } = doc.request;
    [
      "bearer_token_var",
      "basic_user_var",
      "basic_password_var",
      "api_key_var",
    ].forEach((field) => {
      const authValue = auth[field as keyof typeof auth];
      if (typeof authValue === "string" && authValue) {
        values.push(authValue);
      }
    });
  }
  if (doc.tests) {
    doc.tests.forEach((test) => {
      if (test.expect.body?.contains) {
        values.push(test.expect.body.contains);
      }
      if (test.expect.header?.contains) {
        values.push(test.expect.header.contains);
      }
    });
  }

  const variables = new Set<string>();
  values.forEach((val) => {
    detectVariables(String(val)).forEach((v) => variables.add(v));
  });
  return Array.from(variables);
}

function convertTripleDocs(source: string): string {
  return source.replace(TRIPLE_DOCS, (_match, indent, body) => {
    const indented = body
      .split("\n")
      .map((line: string) => `${indent}  ${line}`)
      .join("\n");
    return `${indent}docs: |\n${indented}`;
  });
}


function parseMeta(meta: unknown, issues: ParseIssue[]): PetalflyDocument["meta"] {
  if (!meta || typeof meta !== "object") {
    issues.push({ message: "meta no encontrado" });
    return { id: "", name: "", collection: "", tags: [] };
  }

  const raw = meta as Record<string, unknown>;
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    collection: String(raw.collection ?? ""),
    tags: Array.isArray(raw.tags)
      ? (raw.tags as unknown[]).map((tag) => String(tag))
      : [],
    description: raw.description ? String(raw.description) : undefined,
  };
}

function parseRequest(request: unknown, issues: ParseIssue[]): PetalflyRequest {
  if (!request || typeof request !== "object") {
    issues.push({ message: "request no encontrado" });
    return {
      method: "GET",
      url: "",
    };
  }
  const raw = request as Record<string, unknown>;
  return {
    method: String(raw.method ?? "GET") as PetalflyRequest["method"],
    url: String(raw.url ?? ""),
    timeout_ms: typeof raw.timeout_ms === "number" ? raw.timeout_ms : undefined,
    headers: normalizeRecord(raw.headers),
    query: normalizeQuery(raw.query),
    body: normalizeBody(raw.body),
    auth: normalizeAuth(raw.auth),
  };
}

function parseTests(tests: unknown, issues: ParseIssue[]): PetalflyTest[] | undefined {
  if (!tests) {
    return undefined;
  }

  if (!Array.isArray(tests)) {
    issues.push({ message: "tests debe ser una lista" });
    return undefined;
  }

  return tests.map((entry: any) => ({
    name: String(entry?.name ?? "test"),
    expect: entry?.expect ?? {},
  }));
}

function sanitizeRequest(request: PetalflyRequest): PetalflyRequest {
  return {
    ...request,
    headers: request.headers ?? {},
    query: request.query ?? {},
  };
}

function normalizeRecord(source: unknown): Record<string, string> | undefined {
  if (!source || typeof source !== "object") {
    return undefined;
  }
  return Object.entries(source as Record<string, unknown>).reduce<
    Record<string, string>
  >((acc, [key, value]) => {
    if (value === undefined || value === null) {
      return acc;
    }
    acc[key] = String(value);
    return acc;
  }, {});
}

function normalizeQuery(
  source: unknown,
): Record<string, QueryParam | string> | undefined {
  if (!source || typeof source !== "object") {
    return undefined;
  }
  return Object.entries(source as Record<string, unknown>).reduce<
    Record<string, QueryParam | string>
  >((acc, [key, value]) => {
    if (
      value &&
      typeof value === "object" &&
      "value" in (value as Record<string, unknown>)
    ) {
      const queryValue = value as Record<string, unknown>;
      acc[key] = {
        value: String(queryValue.value ?? ""),
        enabled:
          "enabled" in queryValue
            ? Boolean(queryValue.enabled)
            : undefined,
      };
      return acc;
    }
    acc[key] = String(value ?? "");
    return acc;
  }, {});
}

function normalizeBody(source: unknown): PetalflyBody {
  if (!source || typeof source !== "object") {
    return { type: "none" };
  }
  const candidate = source as Partial<PetalflyBody>;
  return {
    type:
      typeof candidate.type === "string"
        ? (candidate.type as PetalflyBody["type"])
        : "none",
    value:
      typeof candidate.value === "string" || typeof candidate.value === "number"
        ? String(candidate.value)
        : undefined,
  };
}

function normalizeAuth(source: unknown): PetalflyAuth {
  if (!source || typeof source !== "object") {
    return { type: "none" };
  }
  const candidate = source as Partial<PetalflyAuth>;
  return {
    type:
      typeof candidate.type === "string"
        ? (candidate.type as PetalflyAuth["type"])
        : "none",
    bearer_token_var:
      typeof candidate.bearer_token_var === "string"
        ? candidate.bearer_token_var
        : undefined,
    basic_user_var:
      typeof candidate.basic_user_var === "string"
        ? candidate.basic_user_var
        : undefined,
    basic_password_var:
      typeof candidate.basic_password_var === "string"
        ? candidate.basic_password_var
        : undefined,
    api_key_var:
      typeof candidate.api_key_var === "string"
        ? candidate.api_key_var
        : undefined,
    in:
      candidate.in === "header" || candidate.in === "query"
        ? candidate.in
        : undefined,
    name: typeof candidate.name === "string" ? candidate.name : undefined,
  };
}
