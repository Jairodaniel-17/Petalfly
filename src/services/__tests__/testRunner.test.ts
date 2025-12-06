import { describe, expect, it } from "vitest";
import { runTests } from "../testRunner";

const response = {
  status: 200,
  statusText: "OK",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ id: 1, name: "Ada" }),
  durationMs: 10,
};

describe("testRunner", () => {
  it("evaluates status and json expectations", () => {
    const results = runTests(
      [
        { name: "status", expect: { status: 200 } },
        {
          name: "json id",
          expect: { json: { path: "$.id", type: "number", equals: 1 } },
        },
      ],
      response,
    );
    expect(results.every((result) => result.passed)).toBe(true);
  });

  it("fails when header is missing", () => {
    const results = runTests(
      [{ name: "header", expect: { header: { name: "x-missing" } } }],
      response,
    );
    expect(results[0]?.passed).toBe(false);
  });
});
