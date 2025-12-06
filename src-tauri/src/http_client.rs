use std::collections::HashMap;
use std::time::Duration;
use std::time::Instant;

use anyhow::Result;
use reqwest::header::HeaderName;
use reqwest::{Client, Method};

use crate::domain::{ExecutableBody, ExecutablePayload, ExecutedResponse};

pub async fn execute_http(payload: ExecutablePayload) -> Result<ExecutedResponse> {
    let timeout = payload
        .timeout_ms
        .map(Duration::from_millis)
        .unwrap_or_else(|| Duration::from_millis(30_000));
    let client = Client::builder()
        .timeout(timeout)
        .danger_accept_invalid_certs(payload.allow_insecure.unwrap_or(false))
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()?;
    let method = Method::from_bytes(payload.method.as_bytes()).unwrap_or(Method::GET);
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
    let response = request.send().await;
    match response {
        Ok(resp) => {
            let status = resp.status();
            let status_text = status.canonical_reason().map(str::to_string);
            let headers = headers_to_map(resp.headers());
            let bytes = resp.bytes().await?;
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
        Err(error) => Ok(ExecutedResponse {
            status: None,
            status_text: None,
            headers: HashMap::new(),
            body: String::new(),
            duration_ms: Some(start.elapsed().as_millis()),
            size_bytes: None,
            error: Some(error.to_string()),
        }),
    }
}

fn attach_body(request: reqwest::RequestBuilder, body: ExecutableBody) -> reqwest::RequestBuilder {
    match body.r#type.as_str() {
        "json" => request
            .header("Content-Type", "application/json")
            .body(body.value.unwrap_or_else(|| "{}".to_string())),
        "text" => request
            .header("Content-Type", "text/plain")
            .body(body.value.unwrap_or_default()),
        "urlencoded" => request
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(body.value.unwrap_or_default()),
        "form-data" => request
            .header("Content-Type", "multipart/form-data")
            .body(body.value.unwrap_or_default()),
        _ => request,
    }
}

fn headers_to_map(headers: &reqwest::header::HeaderMap) -> HashMap<String, String> {
    headers
        .iter()
        .map(|(key, value)| {
            (
                key.to_string(),
                value.to_str().unwrap_or_default().to_string(),
            )
        })
        .collect()
}
