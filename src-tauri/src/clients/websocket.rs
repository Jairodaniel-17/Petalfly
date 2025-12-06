use std::time::{Duration, Instant};

use anyhow::Result;
use futures_util::{SinkExt, StreamExt};
use tokio::time::{timeout};
use tokio_tungstenite::{connect_async, tungstenite::protocol::Message};

use crate::domain::{ExecutedResponse, WebSocketMessage, WebSocketPayload};

pub async fn execute_websocket(payload: WebSocketPayload) -> Result<ExecutedResponse> {
    let timeout_duration = payload
        .timeout_ms
        .map(Duration::from_millis)
        .unwrap_or_else(|| Duration::from_millis(30_000));

    let start = Instant::now();
    let mut received_messages = Vec::new();
    let mut connection_attempts = 0;
    const MAX_CONNECTION_ATTEMPTS: u32 = 3;

    // Attempt to connect with retries
    let (mut write, mut read) = loop {
        match connect_async(&payload.url).await {
            Ok((ws_stream, _)) => {
                let (w, r) = ws_stream.split();
                break (w, r);
            }
            Err(e) => {
                connection_attempts += 1;
                if connection_attempts >= MAX_CONNECTION_ATTEMPTS {
                    return Ok(ExecutedResponse {
                        status: Some(500),
                        status_text: Some("Connection Failed".to_string()),
                        headers: std::collections::HashMap::new(),
                        body: "Failed to connect to WebSocket after retries".to_string(),
                        duration_ms: Some(start.elapsed().as_millis() as u128),
                        size_bytes: Some(0),
                        error: Some(format!("Connection error: {}", e)),
                    });
                }
                // Wait before retry
                tokio::time::sleep(Duration::from_millis(1000)).await;
            }
        }
    };

    // Send messages
    for msg in &payload.messages {
        let message = match msg.message_type.as_str() {
            "text" => Message::Text(msg.data.clone()),
            "binary" => Message::Binary(msg.data.as_bytes().to_vec()),
            _ => continue,
        };
        if let Err(_) = write.send(message).await {
            // Send failed, perhaps connection lost
            break;
        }
    }

    // Receive messages with timeout
    let receive_future = async {
        while let Some(message) = read.next().await {
            match message {
                Ok(msg) => match msg {
                    Message::Text(text) => received_messages.push(WebSocketMessage {
                        message_type: "text".to_string(),
                        data: text,
                    }),
                    Message::Binary(data) => received_messages.push(WebSocketMessage {
                        message_type: "binary".to_string(),
                        data: String::from_utf8_lossy(&data).to_string(),
                    }),
                    Message::Pong(_) => {
                        // Pong received, connection alive
                    }
                    Message::Close(_) => break,
                    _ => {}
                },
                Err(_) => break,
            }
        }
    };

    // Wait for messages or timeout
    if let Err(_) = timeout(timeout_duration, receive_future).await {
        // Timeout reached
    }

    Ok(ExecutedResponse {
        status: Some(101), // Switching Protocols
        status_text: Some("WebSocket Connected".to_string()),
        headers: std::collections::HashMap::new(),
        body: serde_json::to_string(&received_messages).unwrap_or_default(),
        duration_ms: Some(start.elapsed().as_millis() as u128),
        size_bytes: Some(serde_json::to_string(&received_messages).unwrap_or_default().len() as u64),
        error: None,
    })
}

#[cfg(test)]
mod tests {
    use crate::domain::{WebSocketMessage, WebSocketPayload};

    #[test]
    fn test_websocket_payload_creation() {
        let payload = WebSocketPayload {
            url: "ws://example.com".to_string(),
            headers: std::collections::HashMap::new(),
            messages: vec![WebSocketMessage {
                message_type: "text".to_string(),
                data: "hello".to_string(),
            }],
            timeout_ms: Some(10000),
        };

        assert_eq!(payload.url, "ws://example.com");
        assert_eq!(payload.messages.len(), 1);
        assert_eq!(payload.messages[0].data, "hello");
    }
}