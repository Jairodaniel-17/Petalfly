import { describe, expect, it } from "vitest";
import { resolveDocument } from "./variableResolver";
import type { PetalflyDocument } from "@/types/pfs";
import type { VariableDefinition } from "@/types/domain";

const BASE_ENV: VariableDefinition[] = [
  { name: "tenant", value: "acme" },
  { name: "session_token", value: "token-123" },
  { name: "api_key", value: "api-key-xyz" },
  { name: "user_name", value: "demo" },
];

const baseRequest = {
  method: "GET" as const,
  url: "https://api.petalfly.dev/{{tenant}}",
  headers: {
    "X-Tenant": "{{tenant}}",
  },
  query: {
    include: { value: "{{tenant}}", enabled: true },
  },
  body: { type: "json" as const, value: '{"user":"{{user_name}}"}' },
};

const baseMeta = {
  id: "test-doc",
  name: "Doc",
  collection: "tests",
  tags: [],
};

function buildDoc(auth: PetalflyDocument["request"]["auth"]): PetalflyDocument {
  return {
    version: "1.0",
    meta: { ...baseMeta },
    request: {
      ...baseRequest,
      headers: { ...baseRequest.headers },
      query: { ...baseRequest.query },
      body: { ...baseRequest.body },
      auth,
    },
  };
}

describe("resolveDocument", () => {
  it("resolves bearer auth placeholders before executing", () => {
    const doc = buildDoc({ type: "bearer", bearer_token: "{{session_token}}" });
    const { doc: resolved } = resolveDocument({ doc, environment: BASE_ENV });

    expect(resolved.request.url).toBe("https://api.petalfly.dev/acme");
    expect(resolved.request.headers?.["X-Tenant"]).toBe("acme");
    expect(
      typeof resolved.request.query?.include !== "string" &&
        resolved.request.query?.include.value,
    ).toBe("acme");
    expect(resolved.request.body?.value).toBe('{"user":"demo"}');
    expect(resolved.request.auth?.bearer_token).toBe("token-123");

    // Original document remains untouched for editing in the UI
    expect(doc.request.auth?.bearer_token).toBe("{{session_token}}");
  });

  it("resolves API key auth variables and keeps warnings accurate", () => {
    const doc = buildDoc({
      type: "apiKey",
      api_key: "{{api_key}}",
      name: "X-Api-Key",
      in: "header",
    });
    const result = resolveDocument({ doc, environment: BASE_ENV });

    expect(result.doc.request.auth?.api_key).toBe("api-key-xyz");
    expect(result.warnings).toEqual([]);
  });
});
