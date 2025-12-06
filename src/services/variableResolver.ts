import type { VariableDefinition, VariableWarning } from "@/types/domain";
import type { PetalflyDocument, QueryParam } from "@/types/pfs";
import { collectDocumentVariables, detectVariables } from "./pfsParser";

const VAR_REGEX = /\{\{\s*([\w\.\-]+)\s*\}\}/g;
const AUTH_VALUE_FIELDS = ["bearer_token", "basic_user", "basic_password", "api_key"] as const;
type AuthValueField = (typeof AUTH_VALUE_FIELDS)[number];

export interface ResolveOptions {
  doc: PetalflyDocument;
  environment?: VariableDefinition[];
  globals?: VariableDefinition[];
  overrides?: VariableDefinition[];
}

export interface ResolveResult {
  doc: PetalflyDocument;
  warnings: VariableWarning[];
  variables: Record<string, string>;
}

export function resolveDocument({
  doc,
  environment = [],
  globals = [],
  overrides = [],
}: ResolveOptions): ResolveResult {
  const clone: PetalflyDocument = deepClone(doc);
  const sourceMap = buildVariableMap([
    ...globals,
    ...environment,
    ...overrides,
  ]);
  const warnings: VariableWarning[] = [];
  const notified = new Set<string>();

  const resolveString = (value: string) =>
    value.replace(VAR_REGEX, (_match, key: string) => {
      const normalized = key.trim();
      const candidate = sourceMap[normalized];
      if (candidate === undefined) {
        if (!notified.has(normalized)) {
          warnings.push({
            variable: normalized,
            message: `Variable ${normalized} no encontrada`,
          });
          notified.add(normalized);
        }
        return _match;
      }
      return candidate;
    });

  clone.request.url = resolveString(clone.request.url);

  if (clone.request.headers) {
    Object.entries(clone.request.headers).forEach(([key, value]) => {
      clone.request.headers![key] = resolveString(value);
    });
  }

  if (clone.request.query) {
    Object.entries(clone.request.query).forEach(([key, entry]) => {
      if (typeof entry === "string") {
        clone.request.query![key] = resolveString(entry);
        return;
      }
      const queryEntry = entry as QueryParam;
      clone.request.query![key] = {
        ...queryEntry,
        value: resolveString(queryEntry.value),
      };
    });
  }

  if (clone.request.body?.value) {
    clone.request.body.value = resolveString(clone.request.body.value);
  }

  if (clone.request.auth) {
    const { auth } = clone.request;
    AUTH_VALUE_FIELDS.forEach((field: AuthValueField) => {
      const raw = auth[field];
      if (typeof raw !== "string") return;
      detectVariables(raw).forEach((variable) => {
        if (sourceMap[variable] === undefined && !notified.has(variable)) {
          warnings.push({
            variable,
            message: `Variable ${variable} no encontrada`,
          });
          notified.add(variable);
        }
      });
      auth[field] = resolveString(raw);
    });
  }

  collectDocumentVariables(clone).forEach((variable) => {
    if (sourceMap[variable] === undefined && !notified.has(variable)) {
      warnings.push({
        variable,
        message: `${variable} no está definido`,
      });
      notified.add(variable);
    }
  });

  return { doc: clone, warnings, variables: sourceMap };
}

function buildVariableMap(sources: VariableDefinition[]): Record<string, string> {
  return sources.reduce<Record<string, string>>((acc, variable) => {
    if (!variable.name) {
      return acc;
    }
    acc[variable.name] = variable.value ?? "";
    return acc;
  }, {});
}

export function findVariablesInText(value: string): string[] {
  return detectVariables(value);
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
