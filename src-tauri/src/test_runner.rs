#![allow(dead_code)]

use serde::{Deserialize, Serialize};

use crate::domain::ExecutedResponse;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestCase {
    pub name: String,
    pub expect: Expectation,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct Expectation {
    pub status: Option<u16>,
    pub header: Option<HeaderExpectation>,
    pub body: Option<BodyExpectation>,
    pub json: Option<JsonExpectation>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HeaderExpectation {
    pub name: String,
    pub contains: Option<String>,
    pub equals: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BodyExpectation {
    pub is_json: Option<bool>,
    pub contains: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JsonExpectation {
    pub path: String,
    pub r#type: Option<String>,
    pub equals: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TestResult {
    pub name: String,
    pub passed: bool,
    pub message: Option<String>,
}

pub fn run_tests(response: &ExecutedResponse, tests: &[TestCase]) -> Vec<TestResult> {
    let mut json_cache: Option<serde_json::Value> = None;
    let mut json_error: Option<String> = None;

    tests
        .iter()
        .map(|test| {
            if let Some(expected) = test.expect.status {
                if response.status != Some(expected) {
                    return TestResult {
                        name: test.name.clone(),
                        passed: false,
                        message: Some(format!(
                            "status {} <> {}",
                            response.status.unwrap_or_default(),
                            expected
                        )),
                    };
                }
            }

            if let Some(header_expect) = &test.expect.header {
                let header_value = response
                    .headers
                    .iter()
                    .find(|(key, _)| key.to_lowercase() == header_expect.name.to_lowercase())
                    .map(|(_, value)| value.clone());
                if header_value.is_none() {
                    return TestResult {
                        name: test.name.clone(),
                        passed: false,
                        message: Some(format!("header {} no encontrado", header_expect.name)),
                    };
                }
                let header_value = header_value.unwrap();
                if let Some(contains) = &header_expect.contains {
                    if !header_value.contains(contains) {
                        return TestResult {
                            name: test.name.clone(),
                            passed: false,
                            message: Some(format!(
                                "header {} no contiene {}",
                                header_expect.name, contains
                            )),
                        };
                    }
                }
                if let Some(equals) = &header_expect.equals {
                    if &header_value != equals {
                        return TestResult {
                            name: test.name.clone(),
                            passed: false,
                            message: Some(format!(
                                "header {} difiere de {}",
                                header_expect.name, equals
                            )),
                        };
                    }
                }
            }

            if let Some(body_expect) = &test.expect.body {
                if body_expect.is_json.unwrap_or(false) {
                    ensure_json_cache(response, &mut json_cache, &mut json_error);
                    if let Some(err) = &json_error {
                        return TestResult {
                            name: test.name.clone(),
                            passed: false,
                            message: Some(format!("body no es json: {err}")),
                        };
                    }
                }
                if let Some(fragment) = &body_expect.contains {
                    if !response.body.contains(fragment) {
                        return TestResult {
                            name: test.name.clone(),
                            passed: false,
                            message: Some(format!("body no contiene {fragment}")),
                        };
                    }
                }
            }

            if let Some(json_expect) = &test.expect.json {
                ensure_json_cache(response, &mut json_cache, &mut json_error);
                if let Some(err) = &json_error {
                    return TestResult {
                        name: test.name.clone(),
                        passed: false,
                        message: Some(format!("body no es json: {err}")),
                    };
                }
                let data = if let Some(ref stored) = json_cache {
                    stored
                } else {
                    return TestResult {
                        name: test.name.clone(),
                        passed: false,
                        message: Some("body vacío".into()),
                    };
                };
                let matches = jsonpath_lib::select(data, &json_expect.path);
                if matches.is_err() {
                    return TestResult {
                        name: test.name.clone(),
                        passed: false,
                        message: Some(format!("jsonpath inválido {}", json_expect.path)),
                    };
                }
                let matches = matches.unwrap();
                if matches.is_empty() {
                    return TestResult {
                        name: test.name.clone(),
                        passed: false,
                        message: Some(format!("jsonpath {} sin resultados", json_expect.path)),
                    };
                }
                if let Some(expected_type) = &json_expect.r#type {
                    let actual = matches[0];
                    let typ = match actual {
                        serde_json::Value::Number(_) => "number",
                        serde_json::Value::String(_) => "string",
                        serde_json::Value::Bool(_) => "boolean",
                        serde_json::Value::Array(_) => "array",
                        serde_json::Value::Object(_) => "object",
                        serde_json::Value::Null => "null",
                    };
                    if typ != expected_type {
                        return TestResult {
                            name: test.name.clone(),
                            passed: false,
                            message: Some(format!("tipo {typ} != {expected_type}")),
                        };
                    }
                }
                if let Some(expected_value) = &json_expect.equals {
                    if matches[0] != expected_value {
                        return TestResult {
                            name: test.name.clone(),
                            passed: false,
                            message: Some("valor distinto".into()),
                        };
                    }
                }
            }

            TestResult {
                name: test.name.clone(),
                passed: true,
                message: None,
            }
        })
        .collect()
}

fn ensure_json_cache(
    response: &ExecutedResponse,
    cache: &mut Option<serde_json::Value>,
    error: &mut Option<String>,
) {
    if cache.is_none() && error.is_none() {
        match serde_json::from_str(response.body.as_str()) {
            Ok(value) => *cache = Some(value),
            Err(err) => *error = Some(err.to_string()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::ExecutedResponse;
    use std::collections::HashMap;

    #[test]
    fn test_status_test() {
        let response = ExecutedResponse {
            status: Some(200),
            status_text: Some("OK".to_string()),
            headers: HashMap::new(),
            body: "".to_string(),
            duration_ms: None,
            size_bytes: None,
            error: None,
        };
        let tests = vec![TestCase {
            name: "status ok".to_string(),
            expect: Expectation {
                status: Some(200),
                ..Default::default()
            },
        }];
        let results = run_tests(&response, &tests);
        assert_eq!(results.len(), 1);
        assert!(results[0].passed);
    }

    #[test]
    fn test_status_fail() {
        let response = ExecutedResponse {
            status: Some(404),
            status_text: Some("Not Found".to_string()),
            headers: HashMap::new(),
            body: "".to_string(),
            duration_ms: None,
            size_bytes: None,
            error: None,
        };
        let tests = vec![TestCase {
            name: "status ok".to_string(),
            expect: Expectation {
                status: Some(200),
                ..Default::default()
            },
        }];
        let results = run_tests(&response, &tests);
        assert_eq!(results.len(), 1);
        assert!(!results[0].passed);
    }

    #[test]
    fn test_header_contains() {
        let mut headers = HashMap::new();
        headers.insert("content-type".to_string(), "application/json".to_string());
        let response = ExecutedResponse {
            status: Some(200),
            status_text: Some("OK".to_string()),
            headers,
            body: "".to_string(),
            duration_ms: None,
            size_bytes: None,
            error: None,
        };
        let tests = vec![TestCase {
            name: "header contains".to_string(),
            expect: Expectation {
                header: Some(HeaderExpectation {
                    name: "content-type".to_string(),
                    contains: Some("json".to_string()),
                    equals: None,
                }),
                ..Default::default()
            },
        }];
        let results = run_tests(&response, &tests);
        assert_eq!(results.len(), 1);
        assert!(results[0].passed);
    }

    #[test]
    fn test_body_contains() {
        let response = ExecutedResponse {
            status: Some(200),
            status_text: Some("OK".to_string()),
            headers: HashMap::new(),
            body: "hello world".to_string(),
            duration_ms: None,
            size_bytes: None,
            error: None,
        };
        let tests = vec![TestCase {
            name: "body contains".to_string(),
            expect: Expectation {
                body: Some(BodyExpectation {
                    is_json: None,
                    contains: Some("world".to_string()),
                }),
                ..Default::default()
            },
        }];
        let results = run_tests(&response, &tests);
        assert_eq!(results.len(), 1);
        assert!(results[0].passed);
    }

    #[test]
    fn test_json_path() {
        let response = ExecutedResponse {
            status: Some(200),
            status_text: Some("OK".to_string()),
            headers: HashMap::new(),
            body: r#"{"user": {"name": "test"}}"#.to_string(),
            duration_ms: None,
            size_bytes: None,
            error: None,
        };
        let tests = vec![TestCase {
            name: "json path".to_string(),
            expect: Expectation {
                json: Some(JsonExpectation {
                    path: "$.user.name".to_string(),
                    r#type: Some("string".to_string()),
                    equals: Some(serde_json::Value::String("test".to_string())),
                }),
                ..Default::default()
            },
        }];
        let results = run_tests(&response, &tests);
        assert_eq!(results.len(), 1);
        assert!(results[0].passed);
    }
}
