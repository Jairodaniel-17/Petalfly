import YAML from "yaml";

export type StructuredSample = {
  code: string;
  language?: "json" | "yaml" | "pfs";
};

export function formatStructuredBody(body: string | undefined | null): StructuredSample {
  if (!body) {
    return { code: "" };
  }
  const trimmed = body.trim();
  if (!trimmed) return { code: "" };

  try {
    const parsed = JSON.parse(body);
    return { code: JSON.stringify(parsed, null, 2), language: "json" };
  } catch {
    // ignore
  }

  try {
    const parsedYaml = YAML.parse(body);
    if (parsedYaml && typeof parsedYaml === "object") {
      return { code: YAML.stringify(parsedYaml).trimEnd(), language: "yaml" };
    }
  } catch {
    // ignore
  }

  if (trimmed.startsWith("petalfly 1.0")) {
    return { code: body, language: "pfs" };
  }

  return { code: body };
}
