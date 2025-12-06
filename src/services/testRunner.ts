import { JSONPath } from "jsonpath-plus";
import type { ExecutedResponse, TestResult } from "@/types/domain";
import type { PetalflyTest } from "@/types/pfs";

export function runTests(
  tests: PetalflyTest[],
  response: ExecutedResponse,
): TestResult[] {
  const lowerHeaders = Object.fromEntries(
    Object.entries(response.headers).map(([key, value]) => [
      key.toLowerCase(),
      value,
    ]),
  );

  let jsonBody: null | boolean | number | string | object | any[] | undefined;
  let jsonError: Error | null = null;

  const ensureJson = () => {
    if (jsonError || jsonBody !== undefined) return;
    try {
      jsonBody = JSON.parse(response.body ?? "{}") as
        | null
        | boolean
        | number
        | string
        | object
        | any[];
    } catch (error) {
      jsonError = error as Error;
    }
  };

  return tests.map((test) => {
    const expectation = test.expect;
    if (expectation.status !== undefined) {
      if (response.status !== expectation.status) {
        return {
          name: test.name,
          passed: false,
          message: `Status esperado ${expectation.status}, recibido ${response.status}`,
        };
      }
    }

    if (expectation.header) {
      const { name, contains, equals } = expectation.header;
      const header = lowerHeaders[name.toLowerCase()];
      if (header === undefined) {
        return {
          name: test.name,
          passed: false,
          message: `Header ${name} no encontrado`,
        };
      }
      if (contains && !header.includes(contains)) {
        return {
          name: test.name,
          passed: false,
          message: `Header ${name} no contiene ${contains}`,
        };
      }
      if (equals && header !== equals) {
        return {
          name: test.name,
          passed: false,
          message: `Header ${name} diferente a ${equals}`,
        };
      }
    }

    if (expectation.body?.is_json) {
      ensureJson();
      if (jsonError) {
        return {
          name: test.name,
          passed: false,
          message: `Body no es JSON válido: ${jsonError.message}`,
        };
      }
    }

    if (expectation.body?.contains) {
      if (!response.body?.includes(expectation.body.contains)) {
        return {
          name: test.name,
          passed: false,
          message: `Body no contiene ${expectation.body.contains}`,
        };
      }
    }

    if (expectation.json) {
      ensureJson();
      if (jsonError) {
        return {
          name: test.name,
          passed: false,
          message: `Body no es JSON válido`,
        };
      }
      const matches = JSONPath<unknown[]>({
        path: expectation.json.path,
        json: jsonBody ?? null,
      });
      if (!matches.length) {
        return {
          name: test.name,
          passed: false,
          message: `JSONPath ${expectation.json.path} no encontró resultados`,
        };
      }
      const value = matches[0];
      if (expectation.json.type) {
        const type = Array.isArray(value) ? "array" : typeof value;
        if (type !== expectation.json.type) {
          return {
            name: test.name,
            passed: false,
            message: `Tipo ${type} diferente a ${expectation.json.type}`,
          };
        }
      }
      if (expectation.json.equals !== undefined) {
        if (value !== expectation.json.equals) {
          return {
            name: test.name,
            passed: false,
            message: `Valor ${value} distinto de ${expectation.json.equals}`,
          };
        }
      }
    }

    return { name: test.name, passed: true };
  });
}
