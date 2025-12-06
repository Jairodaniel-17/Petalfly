import { describe, expect, it } from "vitest";
import { buildCurlCommand, importCurl } from "../curl";

describe("curl helpers", () => {
  it("builds curl from payload", () => {
    const command = buildCurlCommand({
      method: "POST",
      url: "https://api.petalfly.io/users",
      headers: { Accept: "application/json" },
      body: { type: "json", value: '{"name":"Ada"}' },
    });
    expect(command).toContain("curl -X POST");
    expect(command).toContain("-H \"Accept: application/json\"");
  });

  it("imports curl into Petalfly document", () => {
    const doc = importCurl(
      'curl -X GET "https://example.com/users" -H "Accept: application/json"',
    );
    expect(doc.request.url).toBe("https://example.com/users");
    expect(doc.request.method).toBe("GET");
    expect(doc.request.headers?.Accept).toBe("application/json");
  });
});
