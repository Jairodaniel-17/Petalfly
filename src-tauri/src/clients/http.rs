use std::collections::HashMap;
use std::time::Duration;
use std::time::Instant;

use anyhow::Result;
use reqwest::header::HeaderName;

use crate::domain::{ExecutableBody, ExecutablePayload, ExecutedResponse};

fn headers_to_map(headers: &reqwest::header::HeaderMap) -> HashMap<String, String> {
    headers
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
        .collect()
}

pub async fn execute_http(payload: ExecutablePayload) -> Result<ExecutedResponse> {
    let timeout = payload
        .timeout_ms
        .map(Duration::from_millis)
        .unwrap_or_else(|| Duration::from_millis(30_000));
    let client = reqwest::Client::builder()
        .timeout(timeout)
        .danger_accept_invalid_certs(payload.allow_insecure.unwrap_or(false))
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()?;
    let method = reqwest::Method::from_bytes(payload.method.as_bytes()).unwrap_or(reqwest::Method::GET);
    let mut request = client.request(method, &payload.url);

    for (key, value) in payload.headers.iter() {
        if let Ok(header_name) = HeaderName::try_from(key) {
            request = request.header(header_name, value);
        }
    }

    if let Some(body) = payload.body.clone() {
        request = attach_body(request, body);
    }

    let start = Instant::now();
    let response = request.send().await?;
    let status = response.status();
    let status_text = status.canonical_reason().map(str::to_string);
    let headers = headers_to_map(response.headers());
    let bytes = response.bytes().await?;
    let duration = start.elapsed().as_millis();
    let body = String::from_utf8_lossy(&bytes).into_owned();
    Ok(ExecutedResponse {
        status: Some(status.as_u16()),
        status_text,
        headers,
        body,
        duration_ms: Some(duration),
        size_bytes: Some(bytes.len() as u64),
        error: None,
    })
}

fn attach_body(request: reqwest::RequestBuilder, body: ExecutableBody) -> reqwest::RequestBuilder {
    match body.r#type.as_str() {
        "json" => request.json(&body.value.unwrap_or_default()),
        "text" => request.body(body.value.unwrap_or_default()),
        "form-data" | "urlencoded" => request.body(body.value.unwrap_or_default()),
        _ => request,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::ExecutableBody;

    #[test]
    fn test_attach_body_json() {
        let body = ExecutableBody {
            r#type: "json".to_string(),
            value: Some(r#"{"key": "value"}"#.to_string()),
        };
        // Since reqwest::RequestBuilder doesn't expose internals easily, we just ensure no panic
        let client = reqwest::Client::new();
        let _request = attach_body(client.post("http://example.com"), body);
    }

    #[test]
    fn test_attach_body_text() {
        let body = ExecutableBody {
            r#type: "text".to_string(),
            value: Some("plain text".to_string()),
        };
        let client = reqwest::Client::new();
        let _request = attach_body(client.post("http://example.com"), body);
    }

    #[test]
    fn test_attach_body_form_data() {
        let body = ExecutableBody {
            r#type: "form-data".to_string(),
            value: Some("key=value".to_string()),
        };
        let client = reqwest::Client::new();
        let _request = attach_body(client.post("http://example.com"), body);
    }

    #[test]
    fn test_headers_to_map() {
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert("content-type", "application/json".parse().unwrap());
        headers.insert("authorization", "Bearer token".parse().unwrap());

        let map = headers_to_map(&headers);
        assert_eq!(map.get("content-type"), Some(&"application/json".to_string()));
        assert_eq!(map.get("authorization"), Some(&"Bearer token".to_string()));
    }
}