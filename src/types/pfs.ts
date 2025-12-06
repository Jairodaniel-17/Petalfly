export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

export interface PetalflyDocument {
  version: string;
  meta: PetalflyMeta;
  protocol?: "http" | "grpc" | "graphql" | "websocket";
  request: PetalflyRequest;
  docs?: string;
  tests?: PetalflyTest[];
  examples?: PetalflyExample[];
}

export interface PetalflyMeta {
  id: string;
  name: string;
  collection: string;
  tags: string[];
  description?: string;
}

export interface PetalflyRequest {
  method: HttpMethod;
  url: string;
  timeout_ms?: number;
  headers?: Record<string, string>;
  query?: Record<string, QueryParam | string>;
  body?: PetalflyBody;
  auth?: PetalflyAuth;
  service?: string;
  grpc_method?: string;
}

export interface QueryParam {
  value: string;
  enabled?: boolean;
}

export interface PetalflyBody {
  type: "none" | "json" | "text" | "form-data" | "urlencoded";
  value?: string;
}

export interface PetalflyAuth {
  type: "none" | "bearer" | "basic" | "apiKey";
  bearer_token?: string;
  basic_user?: string;
  basic_password?: string;
  api_key?: string;
  in?: "header" | "query";
  name?: string;
}

export interface PetalflyTest {
  name: string;
  expect: TestExpectation;
}

export interface TestExpectation {
  status?: number;
  header?: {
    name: string;
    contains?: string;
    equals?: string;
  };
  body?: {
    is_json?: boolean;
    contains?: string;
  };
  json?: {
    path: string;
    type?: "number" | "string" | "boolean" | "object" | "array";
    equals?: string | number | boolean;
  };
}

export interface PetalflyExample {
  name: string;
  curl: string;
}

export interface ParseIssue {
  message: string;
  path?: string;
}
