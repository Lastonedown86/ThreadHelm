//! ThreadHelm session-scoped coordination bridge.
//!
//! Exposes an MCP JSON-RPC 2.0 stdio interface to provider CLIs (Codex, Claude)
//! and forwards structured mailbox actions to Electron main over a session-scoped
//! Windows named pipe.

use std::collections::HashSet;
use std::env;
use std::fs::{self, OpenOptions};
use std::io::{self, BufRead, BufReader, Write};
use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

pub const MAX_FRAME_BYTES: usize = 32 * 1024; // 32 KiB limit

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BridgeConfig {
    pub version: u8,
    pub pipe_name: String,
    pub session_id: String,
    pub credential: String,
}

pub fn parse_bridge_args<I: Iterator<Item = String>>(
    mut args: I,
) -> Result<BridgeConfig, &'static str> {
    let mut pipe_name = None;
    let mut session_id = None;
    let mut credential = None;
    let mut session_config: Option<PathBuf> = None;

    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--pipe" => pipe_name = args.next(),
            "--session-id" => session_id = args.next(),
            "--credential" => credential = args.next(),
            "--session-config" => session_config = args.next().map(PathBuf::from),
            _ => {}
        }
    }

    if let Some(path) = session_config {
        let metadata = fs::metadata(&path).map_err(|_| "SESSION_CONFIG_UNAVAILABLE")?;
        if metadata.len() > 8 * 1024 {
            return Err("SESSION_CONFIG_TOO_LARGE");
        }
        let bytes = fs::read(path).map_err(|_| "SESSION_CONFIG_UNAVAILABLE")?;
        let config: BridgeConfig =
            serde_json::from_slice(&bytes).map_err(|_| "SESSION_CONFIG_INVALID")?;
        if config.version != 1
            || config.pipe_name.is_empty()
            || config.session_id.is_empty()
            || config.credential.len() < 32
        {
            return Err("SESSION_CONFIG_INVALID");
        }
        return Ok(config);
    }

    Ok(BridgeConfig {
        version: 1,
        pipe_name: pipe_name.ok_or("MISSING_PIPE_NAME")?,
        session_id: session_id.ok_or("MISSING_SESSION_ID")?,
        credential: credential.ok_or("MISSING_CREDENTIAL")?,
    })
}

pub fn format_safe_stderr_log(event: &str, bytes: usize) -> String {
    format!(r#"{{"event":"{event}","bytes":{bytes}}}"#)
}

pub fn handle_pipe_disconnect() -> &'static str {
    "PIPE_DISCONNECTED_SAFE_DEGRADE"
}

#[derive(Default)]
struct ProtocolState {
    initialized: bool,
    seen_ids: HashSet<String>,
    last_numeric_id: Option<u64>,
}

fn validate_protocol_sequence(input: &str, state: &mut ProtocolState) -> Result<(), &'static str> {
    let message: Value = serde_json::from_str(input).map_err(|_| "INVALID_JSON")?;
    let object = message.as_object().ok_or("INVALID_REQUEST")?;
    if object
        .keys()
        .any(|key| !matches!(key.as_str(), "jsonrpc" | "id" | "method" | "params"))
        || object.get("jsonrpc") != Some(&Value::String("2.0".to_string()))
    {
        return Err("INVALID_REQUEST");
    }
    let method = object
        .get("method")
        .and_then(Value::as_str)
        .ok_or("INVALID_REQUEST")?;
    let id = object.get("id");

    if method == "notifications/initialized" {
        return if state.initialized && id.is_none() {
            Ok(())
        } else {
            Err("INITIALIZATION_ORDER_INVALID")
        };
    }

    let id = id.ok_or("REQUEST_ID_REQUIRED")?;
    let stable_id = serde_json::to_string(id).map_err(|_| "INVALID_REQUEST")?;
    if !state.seen_ids.insert(stable_id) {
        return Err("DUPLICATE_REQUEST_ID");
    }
    if let Some(numeric_id) = id.as_u64() {
        if state
            .last_numeric_id
            .is_some_and(|previous| numeric_id <= previous)
        {
            return Err("REQUEST_ID_OUT_OF_ORDER");
        }
        state.last_numeric_id = Some(numeric_id);
    }

    if method == "initialize" {
        if state.initialized {
            return Err("DUPLICATE_INITIALIZATION");
        }
        state.initialized = true;
        return Ok(());
    }
    if !state.initialized {
        return Err("INITIALIZATION_REQUIRED");
    }
    Ok(())
}

/// Minimal JSON extract helper for JSON-RPC messages without heavy external dependencies.
pub fn extract_json_field<'a>(json: &'a str, field: &str) -> Option<&'a str> {
    let pattern = format!(r#""{}""#, field);
    let field_pos = json.find(&pattern)?;
    let after_field = &json[field_pos + pattern.len()..];
    let colon_pos = after_field.find(':')?;
    let val_str = after_field[colon_pos + 1..].trim_start();

    if let Some(inner) = val_str.strip_prefix('"') {
        let end_quote = inner.find('"')?;
        Some(&inner[..end_quote])
    } else {
        // Number, boolean, null, object, or array
        let end = val_str
            .find(|c: char| c == ',' || c == '}' || c == ']' || c.is_whitespace())
            .unwrap_or(val_str.len());
        Some(&val_str[..end])
    }
}

pub fn handle_mcp_message(input: &str) -> Result<String, &'static str> {
    if input.len() > MAX_FRAME_BYTES {
        return Err("FRAME_TOO_LARGE");
    }

    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err("EMPTY_INPUT");
    }

    let message: Value = serde_json::from_str(trimmed).map_err(|_| "INVALID_JSON")?;
    let object = message.as_object().ok_or("INVALID_REQUEST")?;
    if object
        .keys()
        .any(|key| !matches!(key.as_str(), "jsonrpc" | "id" | "method" | "params"))
        || object.get("jsonrpc") != Some(&Value::String("2.0".to_string()))
    {
        return Err("INVALID_REQUEST");
    }
    let id = object.get("id").cloned().unwrap_or(Value::Null);
    let method = object
        .get("method")
        .and_then(Value::as_str)
        .ok_or("INVALID_REQUEST")?;

    match method {
        "initialize" => Ok(json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": { "tools": {} },
                "serverInfo": {
                    "name": "threadhelm-coordination-bridge",
                    "version": "0.1.0"
                }
            }
        })
        .to_string()),
        "notifications/initialized" => {
            // Notification: no response
            Ok(String::new())
        }
        "ping" => Ok(json!({ "jsonrpc": "2.0", "id": id, "result": {} }).to_string()),
        "tools/list" => {
            let tools_json = r#"[
  {
    "name": "threadhelm_list_pending",
    "description": "List pending coordination handoffs addressed to this session",
    "inputSchema": {
      "type": "object",
      "properties": {
        "limit": { "type": "number", "minimum": 1, "maximum": 20 }
      }
    }
  },
  {
    "name": "threadhelm_acknowledge",
    "description": "Acknowledge receipt of a delivered coordination handoff",
    "inputSchema": {
      "type": "object",
      "required": ["handoffId"],
      "properties": {
        "handoffId": { "type": "string" }
      }
    }
  },
  {
    "name": "threadhelm_reply",
    "description": "Send a causally linked reply to a delivered coordination handoff",
    "inputSchema": {
      "type": "object",
      "required": ["inReplyTo", "kind", "purpose", "body", "authorityRequired"],
      "properties": {
        "inReplyTo": { "type": "string" },
        "kind": { "type": "string", "enum": ["response", "inform", "query", "proposal", "completion", "refusal", "failure"] },
        "purpose": { "type": "string", "maxLength": 160 },
        "body": { "type": "string", "maxLength": 16384 },
        "responseExpectation": { "type": "string", "enum": ["none", "response_required"] },
        "authorityRequired": { "type": "boolean" }
      }
    }
  },
  {
    "name": "threadhelm_report_outcome",
    "description": "Report final work outcome for a coordination handoff",
    "inputSchema": {
      "type": "object",
      "required": ["handoffId", "outcome"],
      "properties": {
        "handoffId": { "type": "string" },
        "outcome": { "type": "string", "enum": ["completed", "refused", "failed"] },
        "reasonCode": { "type": ["string", "null"] }
      }
    }
  }
]"#;
            let tools: Value = serde_json::from_str(tools_json).map_err(|_| "INTERNAL")?;
            Ok(json!({ "jsonrpc": "2.0", "id": id, "result": { "tools": tools } }).to_string())
        }
        "tools/call" => {
            // Forwarding to pipe is handled in the main loop with BridgeConfig
            Err("DISPATCH_PIPE_REQUIRED")
        }
        _ => Ok(json!({
            "jsonrpc": "2.0",
            "id": id,
            "error": { "code": -32601, "message": "Method not found" }
        })
        .to_string()),
    }
}

pub fn forward_to_pipe(config: &BridgeConfig, json_message: &str) -> Result<String, String> {
    if json_message.len() > MAX_FRAME_BYTES {
        return Err("FRAME_TOO_LARGE".to_string());
    }

    #[cfg(windows)]
    {
        let mut pipe = OpenOptions::new()
            .read(true)
            .write(true)
            .open(&config.pipe_name)
            .map_err(|_| handle_pipe_disconnect().to_string())?;

        let payload: Value = serde_json::from_str(json_message).map_err(|_| "INVALID_JSON")?;
        let envelope = json!({
            "sessionId": config.session_id,
            "credential": config.credential,
            "payload": payload
        })
        .to_string();

        pipe.write_all(envelope.as_bytes())
            .map_err(|_| handle_pipe_disconnect().to_string())?;
        pipe.write_all(b"\n")
            .map_err(|_| handle_pipe_disconnect().to_string())?;
        pipe.flush()
            .map_err(|_| handle_pipe_disconnect().to_string())?;

        let mut reader = BufReader::new(pipe);
        let mut response_line = String::new();
        reader
            .read_line(&mut response_line)
            .map_err(|_| handle_pipe_disconnect().to_string())?;

        if response_line.len() > MAX_FRAME_BYTES {
            return Err("FRAME_TOO_LARGE".to_string());
        }

        Ok(response_line.trim().to_string())
    }

    #[cfg(not(windows))]
    {
        // Non-windows test fallback / mock
        let _ = config;
        let id = extract_json_field(json_message, "id").unwrap_or("1");
        Ok(format!(
            r#"{{"jsonrpc":"2.0","id":{},"result":{{"content":[{{"type":"text","text":"OK"}}],"isError":false}}}}"#,
            id
        ))
    }
}

fn main() {
    let args: Vec<String> = env::args().collect();
    let config = match parse_bridge_args(args.into_iter().skip(1)) {
        Ok(cfg) => cfg,
        Err(err) => {
            let _ = io::stderr().write_all(format_safe_stderr_log(err, 0).as_bytes());
            let _ = io::stderr().write_all(b"\n");
            std::process::exit(1);
        }
    };

    let stdin = io::stdin();
    let mut stdout = io::stdout();
    let mut reader = BufReader::new(stdin.lock());
    let mut line = String::new();
    let mut protocol_state = ProtocolState::default();

    while let Ok(n) = reader.read_line(&mut line) {
        if n == 0 {
            break; // EOF
        }

        if n > MAX_FRAME_BYTES {
            let log = format_safe_stderr_log("FRAME_TOO_LARGE", n);
            let _ = io::stderr().write_all(log.as_bytes());
            let _ = io::stderr().write_all(b"\n");
            let err_resp = r#"{"jsonrpc":"2.0","id":null,"error":{"code":-32600,"message":"Frame too large"}}"#;
            let _ = stdout.write_all(err_resp.as_bytes());
            let _ = stdout.write_all(b"\n");
            let _ = stdout.flush();
            line.clear();
            continue;
        }

        let handled = validate_protocol_sequence(&line, &mut protocol_state)
            .and_then(|()| handle_mcp_message(&line));
        match handled {
            Ok(resp) => {
                if !resp.is_empty() {
                    let _ = stdout.write_all(resp.as_bytes());
                    let _ = stdout.write_all(b"\n");
                    let _ = stdout.flush();
                }
            }
            Err("DISPATCH_PIPE_REQUIRED") => match forward_to_pipe(&config, &line) {
                Ok(pipe_resp) => {
                    let _ = stdout.write_all(pipe_resp.as_bytes());
                    let _ = stdout.write_all(b"\n");
                    let _ = stdout.flush();
                    let log = format_safe_stderr_log("DISPATCH_OK", pipe_resp.len());
                    let _ = io::stderr().write_all(log.as_bytes());
                    let _ = io::stderr().write_all(b"\n");
                }
                Err(err_code) => {
                    let log = format_safe_stderr_log(&err_code, 0);
                    let _ = io::stderr().write_all(log.as_bytes());
                    let _ = io::stderr().write_all(b"\n");
                    let id = extract_json_field(&line, "id").unwrap_or("null");
                    let err_resp = format!(
                        r#"{{"jsonrpc":"2.0","id":{},"result":{{"content":[{{"type":"text","text":"Tool dispatch failed: {}"}}],"isError":true}}}}"#,
                        id, err_code
                    );
                    let _ = stdout.write_all(err_resp.as_bytes());
                    let _ = stdout.write_all(b"\n");
                    let _ = stdout.flush();
                }
            },
            Err(err_reason) => {
                let log = format_safe_stderr_log(err_reason, line.len());
                let _ = io::stderr().write_all(log.as_bytes());
                let _ = io::stderr().write_all(b"\n");
                let id = extract_json_field(&line, "id").unwrap_or("null");
                let err_resp = format!(
                    r#"{{"jsonrpc":"2.0","id":{},"error":{{"code":-32600,"message":"Invalid request"}}}}"#,
                    id
                );
                let _ = stdout.write_all(err_resp.as_bytes());
                let _ = stdout.write_all(b"\n");
                let _ = stdout.flush();
            }
        }

        line.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mcp_initialization() {
        let init_json = r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-client","version":"1.0"}}}"#;
        let response = handle_mcp_message(init_json).expect("handle init");
        assert!(response.contains(r#""serverInfo":{"name":"threadhelm-coordination-bridge""#));
        assert!(response.contains(r#""protocolVersion":"2024-11-05""#));
    }

    #[test]
    fn test_frame_size_limit() {
        let oversized = "a".repeat(MAX_FRAME_BYTES + 1);
        let result = handle_mcp_message(&oversized);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "FRAME_TOO_LARGE");
    }

    #[test]
    fn test_session_credential_and_pipe_args() {
        let valid_args = vec![
            "bridge.exe".to_string(),
            "--pipe".to_string(),
            r"\\.\pipe\threadhelm-coord-123".to_string(),
            "--session-id".to_string(),
            "00000000-0000-4000-8000-000000000001".to_string(),
            "--credential".to_string(),
            "secret-token-123".to_string(),
        ];
        let config = parse_bridge_args(valid_args.into_iter().skip(1)).expect("valid args");
        assert_eq!(config.pipe_name, r"\\.\pipe\threadhelm-coord-123");
        assert_eq!(config.session_id, "00000000-0000-4000-8000-000000000001");
        assert_eq!(config.credential, "secret-token-123");

        let missing_args = vec![
            "bridge.exe".to_string(),
            "--pipe".to_string(),
            "test".to_string(),
        ];
        assert!(parse_bridge_args(missing_args.into_iter().skip(1)).is_err());
    }

    #[test]
    fn test_method_registry_and_tools_list() {
        let list_tools_req = r#"{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}"#;
        let response = handle_mcp_message(list_tools_req).expect("handle tools/list");
        assert!(response.contains("threadhelm_list_pending"));
        assert!(response.contains("threadhelm_acknowledge"));
        assert!(response.contains("threadhelm_reply"));
        assert!(response.contains("threadhelm_report_outcome"));
    }

    #[test]
    fn test_invalid_json_and_unknown_fields_fail_closed() {
        assert_eq!(handle_mcp_message("not-json"), Err("INVALID_JSON"));
        assert_eq!(
            handle_mcp_message(
                r#"{"jsonrpc":"2.0","id":1,"method":"ping","params":{},"secret":"x"}"#,
            ),
            Err("INVALID_REQUEST")
        );
    }

    #[test]
    fn test_duplicate_initialization_and_out_of_order_ids_fail_closed() {
        let mut state = ProtocolState::default();
        assert!(validate_protocol_sequence(
            r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}"#,
            &mut state,
        )
        .is_ok());
        assert_eq!(
            validate_protocol_sequence(
                r#"{"jsonrpc":"2.0","id":2,"method":"initialize","params":{}}"#,
                &mut state,
            ),
            Err("DUPLICATE_INITIALIZATION")
        );
        assert_eq!(
            validate_protocol_sequence(
                r#"{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}"#,
                &mut state,
            ),
            Err("DUPLICATE_REQUEST_ID")
        );
    }

    #[test]
    fn test_stderr_redaction() {
        let safe_log = format_safe_stderr_log("DISPATCH_OK", 128);
        assert_eq!(safe_log, r#"{"event":"DISPATCH_OK","bytes":128}"#);
        assert!(!safe_log.contains("secret"));
    }

    #[test]
    fn test_disconnect_handling() {
        let result = handle_pipe_disconnect();
        assert_eq!(result, "PIPE_DISCONNECTED_SAFE_DEGRADE");
    }
}
