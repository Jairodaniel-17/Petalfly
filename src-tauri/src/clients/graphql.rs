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
    
    let mut url = payload.url.clone();
    let mut request_builder;
    
    if payload.method.as_deref() == Some("GET") {
        // For GET, append query and variables as URL parameters
        let mut query_params = vec![("query", payload.query)];
        if let Some(vars) = payload.variables {
            if let Ok(vars_str) = serde_json::to_string(&vars) {
                query_params.push(("variables", vars_str));
            }
        }
        let query_string = serde_urlencoded::to_string(&query_params)?;
        url = format!("{}?{}", url, query_string);
        request_builder = client.get(&url);
    } else {
        // Default to POST with JSON body
        let body = serde_json::json!({
            "query": payload.query,
            "variables": payload.variables,
        });
        request_builder = client.post(&url).json(&body);
    }

    for (key, value) in payload.headers.iter() {
        if let Ok(header_name) = HeaderName::try_from(key) {
            request_builder = request_builder.header(header_name, value);
        }
    }

    let start = Instant::now();
    let response = request_builder.send().await?;
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

#[cfg(test)]
mod tests {
    use crate::domain::GraphQLPayload;
    use std::collections::HashMap;

    #[test]
    fn test_graphql_payload_creation() {
        let payload = GraphQLPayload {
            method: Some("POST".to_string()),
            url: "http://example.com/graphql".to_string(),
            headers: HashMap::new(),
            query: "query { test }".to_string(),
            variables: Some(serde_json::json!({"var": "value"})),
            timeout_ms: Some(5000),
            allow_insecure: Some(false),
        };

        assert_eq!(payload.url, "http://example.com/graphql");
        assert_eq!(payload.query, "query { test }");
    }
}