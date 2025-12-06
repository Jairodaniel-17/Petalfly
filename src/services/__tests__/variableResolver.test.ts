import { describe, expect, it } from "vitest";
import { resolveDocument } from "../variableResolver";
import { parsePfs } from "../pfsParser";

const docSource = `petalfly 1.0
meta:
  id: res
  name: Resolver
  collection: Demo
  tags: []
request:
  method: GET
  url: "{{baseUrl}}/users/{{userId}}"
`;

describe("variableResolver", () => {
  it("replaces template variables and reports missing ones", () => {
    const { doc } = parsePfs(docSource);
    const result = resolveDocument({
      doc: doc!,
      environment: [
        { name: "baseUrl", value: "http://localhost:3000" },
      ],
      globals: [{ name: "userId", value: "42" }],
    });
    expect(result.doc.request.url).toBe("http://localhost:3000/users/42");
    expect(result.warnings).toHaveLength(0);
  });

  it("warns when variables are missing", () => {
    const { doc } = parsePfs(docSource);
    const result = resolveDocument({ doc: doc! });
    expect(result.warnings[0]?.variable).toBe("baseUrl");
  });
});
