use std::collections::HashMap;
use std::time::Duration;
use std::time::Instant;

use anyhow::Result;
use reqwest::header::HeaderName;

use crate::domain::{GraphQLPayload, ExecutedResponse};

fn headers_to_map(headers: &reqwest::header::HeaderMap) -> HashMap<String, String> {
    headers
        .iter()
        .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
        .collect()
}

pub async fn execute_graphql(payload: GraphQLPayload) -> Result<ExecutedResponse> {
    let timeout = payload
        .timeout_ms
        .map(Duration::from_millis)
        .unwrap_or_else(|| Duration::from_millis(30_000));
    let client = reqwest::Client::builder()
        .timeout(timeout)
        .danger_accept_invalid_certs(payload.allow_insecure.unwrap_or(false))
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()?;
    
    let body = serde_json::json!({
        "query": payload.query,
        "variables": payload.variables,
    });
    
    let mut request = client.post(&payload.url).json(&body);

    for (key, value) in payload.headers.iter() {
        if let Ok(header_name) = HeaderName::try_from(key) {
            request = request.header(header_name, value);
        }
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