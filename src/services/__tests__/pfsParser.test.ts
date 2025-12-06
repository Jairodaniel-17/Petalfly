import { describe, expect, it } from "vitest";
import {
  collectDocumentVariables,
  parsePfs,
  stringifyPfs,
} from "../pfsParser";

const sample = `petalfly 1.0
meta:
  id: demo
  name: Demo
  collection: Tests
  tags:
    - qa
request:
  method: GET
  url: "{{baseUrl}}/ping"
docs: """
Demo docs
"""
`;

describe("pfsParser", () => {
  it("parses meta and request", () => {
    const result = parsePfs(sample);
    expect(result.doc?.meta.id).toBe("demo");
    expect(result.doc?.request.method).toBe("GET");
    expect(result.issues).toHaveLength(0);
  });

  it("stringifies the document and keeps version header", () => {
    const result = parsePfs(sample);
    const output = stringifyPfs(result.doc!);
    expect(output.startsWith("petalfly 1.0")).toBe(true);
    expect(output).toContain('docs: """');
  });

  it("collects variables within the template", () => {
    const parsed = parsePfs(sample);
    const vars = collectDocumentVariables(parsed.doc!);
    expect(vars).toContain("baseUrl");
  });
});
