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
                "capabilities": { "tools": { "listChanged": true } },
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
      "required": ["inReplyTo", "kind", "purpose", "body", "responseExpectation", "authorityRequired", "conflictingInstruction"],
      "properties": {
        "inReplyTo": { "type": "string" },
        "kind": { "type": "string", "enum": ["response", "inform", "query", "proposal", "completion", "refusal", "failure"] },
        "purpose": { "type": "string", "maxLength": 160 },
        "body": { "type": "string", "maxLength": 16384 },
        "responseExpectation": { "type": "string", "enum": ["none", "response_required"] },
        "authorityRequired": { "type": "boolean" },
        "conflictingInstruction": { "type": "boolean" }
      }
    }
  },
  {
    "name": "threadhelm_memory_search",
    "description": "Search attributed shared memory in this authenticated session scope",
    "inputSchema": {
      "type": "object",
      "additionalProperties": false,
      "required": ["query"],
      "properties": {
        "query": { "type": "string", "minLength": 1, "maxLength": 500 },
        "kind": { "type": "string", "enum": ["fact", "decision", "constraint", "artifact", "lesson"] },
        "includeContested": { "type": "boolean" },
        "cursor": { "type": "string", "maxLength": 512 },
        "limit": { "type": "number", "minimum": 1, "maximum": 20 }
      }
    }
  },
  {
    "name": "threadhelm_memory_get",
    "description": "Get one visible shared-memory entry or revision in this authenticated session scope",
    "inputSchema": {
      "type": "object",
      "additionalProperties": false,
      "required": ["entryId"],
      "properties": {
        "entryId": { "type": "string", "format": "uuid" },
        "revisionId": { "type": "string", "format": "uuid" }
      }
    }
  },
  {
    "name": "threadhelm_memory_propose_revision",
    "description": "Deliberately propose bounded attributed content in this authenticated session scope",
    "inputSchema": {
      "type": "object",
      "additionalProperties": false,
      "required": ["kind", "body"],
      "properties": {
        "kind": { "type": "string", "enum": ["fact", "decision", "constraint", "artifact", "lesson"] },
        "title": { "type": ["string", "null"], "maxLength": 160 },
        "body": { "type": "string", "minLength": 1, "maxLength": 16384 },
        "sourceRefs": {
          "type": "array",
          "maxItems": 32,
          "items": {
            "type": "object",
            "additionalProperties": false,
            "required": ["kind", "id"],
            "properties": {
              "kind": { "type": "string", "enum": ["handoff", "work_item", "memory", "artifact"] },
              "id": { "type": "string", "minLength": 1, "maxLength": 512 }
            }
          }
        },
        "confidence": { "type": "string", "enum": ["unknown", "low", "medium", "high"] }
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

const ROLE_TOOLS: [&str; 8] = [
    "threadhelm_mission_inspect",
    "threadhelm_work_decompose",
    "threadhelm_work_assign",
    "threadhelm_work_reassign",
    "threadhelm_work_pause",
    "threadhelm_mission_complete",
    "threadhelm_mission_escalate",
    "threadhelm_work_result",
];

fn main_tool_request(id: Value, name: &str, arguments: Value) -> String {
    json!({"jsonrpc":"2.0","id":id,"method":"tools/call",
        "params":{"name":name,"arguments":arguments}})
    .to_string()
}

fn registry_content(response: &str) -> Result<Value, &'static str> {
    if response.len() > MAX_FRAME_BYTES {
        return Err("FRAME_TOO_LARGE");
    }
    let response: Value = serde_json::from_str(response).map_err(|_| "REGISTRY_INVALID")?;
    if response.get("error").is_some() || response["result"]["isError"] != false {
        return Err("REGISTRY_UNAVAILABLE");
    }
    let registry = response["result"]["structuredContent"].clone();
    if registry["version"] != 1 || registry["revision"].as_u64().is_none() {
        return Err("REGISTRY_INVALID");
    }
    Ok(registry)
}

pub fn registry_revision(response: &str) -> Result<u64, &'static str> {
    registry_content(response)?["revision"]
        .as_u64()
        .ok_or("REGISTRY_INVALID")
}

fn merge_registry(base: &str, response: &str) -> Result<String, &'static str> {
    let registry = registry_content(response)?;
    let tools = registry["tools"].as_array().ok_or("REGISTRY_INVALID")?;
    if tools.len() > ROLE_TOOLS.len() {
        return Err("REGISTRY_INVALID");
    }
    let mut seen = HashSet::new();
    for tool in tools {
        let fields = tool.as_object().ok_or("REGISTRY_INVALID")?;
        let name = tool["name"].as_str().ok_or("REGISTRY_INVALID")?;
        if !ROLE_TOOLS.contains(&name)
            || !seen.insert(name)
            || tool["description"].as_str().is_none()
            || !tool["inputSchema"].is_object()
            || fields
                .keys()
                .any(|key| !matches!(key.as_str(), "name" | "description" | "inputSchema"))
        {
            return Err("REGISTRY_INVALID");
        }
    }
    if seen.contains("threadhelm_work_result") && seen.len() != 1 {
        return Err("REGISTRY_INVALID");
    }
    let mission_id = registry["missionId"].as_str();
    if !tools.is_empty()
        && !mission_id.is_some_and(|id| {
            id.len() == 36 && id.chars().all(|c| c.is_ascii_hexdigit() || c == '-')
        })
    {
        return Err("REGISTRY_INVALID");
    }
    let mut base: Value = serde_json::from_str(base).map_err(|_| "REGISTRY_INVALID")?;
    let output = base["result"]["tools"]
        .as_array_mut()
        .ok_or("REGISTRY_INVALID")?;
    for tool in tools {
        let mut definition = tool.clone();
        if let Some(id) = mission_id {
            definition["description"] = json!(format!(
                "{} Bound mission ID: {}. Main validates all authority.",
                tool["description"].as_str().unwrap(),
                id
            ));
        }
        output.push(definition);
    }
    let result = base.to_string();
    if result.len() > MAX_FRAME_BYTES {
        return Err("FRAME_TOO_LARGE");
    }
    Ok(result)
}

/// Main owns the registry. Provider parameters and profile prose cannot grant a role.
/// Losing the registry leaves ordinary mailbox tools available without mission authority.
pub fn handle_session_message<F>(input: &str, mut forward: F) -> Result<String, String>
where
    F: FnMut(&str) -> Result<String, String>,
{
    match handle_mcp_message(input) {
        Err("DISPATCH_PIPE_REQUIRED") => forward(input),
        Err(error) => Err(error.to_string()),
        Ok(base) => {
            let message: Value = serde_json::from_str(input).map_err(|_| "INVALID_JSON")?;
            if message["method"] != "tools/list" {
                return Ok(base);
            }
            let request =
                main_tool_request(message["id"].clone(), "threadhelm_tool_registry", json!({}));
            Ok(forward(&request)
                .ok()
                .and_then(|response| merge_registry(&base, &response).ok())
                .unwrap_or(base))
        }
    }
}

fn write_stdout_message(message: &str) -> io::Result<()> {
    // Notification and response writes share this lock so frames cannot interleave.
    let stdout = io::stdout();
    let mut output = stdout.lock();
    output.write_all(message.as_bytes())?;
    output.write_all(b"\n")?;
    output.flush()
}

fn watch_registry(config: BridgeConfig) {
    watch_registry_with(
        |request| forward_to_pipe(&config, request),
        write_stdout_message,
        std::thread::sleep,
    );
}

fn watch_registry_with<F, N, W>(mut forward: F, mut notify: N, mut wait: W)
where
    F: FnMut(&str) -> Result<String, String>,
    N: FnMut(&str) -> io::Result<()>,
    W: FnMut(std::time::Duration),
{
    let mut revision = 0;
    let mut failures = 0u32;
    loop {
        let started = std::time::Instant::now();
        let request = main_tool_request(
            json!("threadhelm-registry-watch"),
            "threadhelm_watch_registry",
            json!({"afterRevision":revision}),
        );
        let response = match forward(&request) {
            Ok(response) => {
                failures = 0;
                response
            }
            Err(_) => {
                // A failed transport attempt grants nothing and must not erase
                // an otherwise valid subscription. Retry with the same exact
                // session credential; only main may renew or revoke it.
                failures = failures.saturating_add(1);
                wait(std::time::Duration::from_millis(
                    250 * (1u64 << failures.min(4)),
                ));
                continue;
            }
        };
        // An authenticated error, malformed registry, revoked credential or
        // regressing revision is a permanent hold, never a retryable authority.
        let Ok(next) = registry_revision(&response) else {
            return;
        };
        if next < revision {
            return;
        }
        if next > revision {
            revision = next;
            if notify(r#"{"jsonrpc":"2.0","method":"notifications/tools/list_changed"}"#).is_err() {
                return;
            }
        }
        // Main long-polls for up to 30 seconds. Bound unexpected immediate responses too.
        let minimum = std::time::Duration::from_millis(250);
        if started.elapsed() < minimum {
            wait(minimum - started.elapsed());
        }
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
    let mut reader = BufReader::new(stdin.lock());
    let mut line = String::new();
    let mut protocol_state = ProtocolState::default();
    let mut registry_watch_started = false;

    while let Ok(n) = reader.read_line(&mut line) {
        if n == 0 {
            break; // EOF
        }

        if n > MAX_FRAME_BYTES {
            let log = format_safe_stderr_log("FRAME_TOO_LARGE", n);
            let _ = io::stderr().write_all(log.as_bytes());
            let _ = io::stderr().write_all(b"\n");
            let err_resp = r#"{"jsonrpc":"2.0","id":null,"error":{"code":-32600,"message":"Frame too large"}}"#;
            let _ = write_stdout_message(err_resp);
            line.clear();
            continue;
        }

        let handled = validate_protocol_sequence(&line, &mut protocol_state)
            .map_err(str::to_string)
            .and_then(|()| {
                handle_session_message(&line, |request| forward_to_pipe(&config, request))
            });
        match handled {
            Ok(resp) => {
                if !resp.is_empty() {
                    let _ = write_stdout_message(&resp);
                } else if !registry_watch_started {
                    registry_watch_started = true;
                    let watch_config = config.clone();
                    std::thread::spawn(move || watch_registry(watch_config));
                }
            }
            Err(err_reason) => {
                let log = format_safe_stderr_log(&err_reason, line.len());
                let _ = io::stderr().write_all(log.as_bytes());
                let _ = io::stderr().write_all(b"\n");
                let id = serde_json::from_str::<Value>(&line)
                    .ok()
                    .and_then(|message| message.get("id").cloned())
                    .unwrap_or(Value::Null);
                let err_resp = json!({"jsonrpc":"2.0","id":id,"error":{"code":-32600,"message":"Request rejected or bridge unavailable"}}).to_string();
                let _ = write_stdout_message(&err_resp);
            }
        }

        line.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registry_watch_retries_transient_pipe_failure_without_losing_the_subscription() {
        let responses = [
            Err("PIPE_DISCONNECTED_SAFE_DEGRADE".to_string()),
            Ok(registry_response(json!([]))),
            Ok(json!({"jsonrpc":"2.0","id":"watch","error":{"code":-32000,"message":"UNAUTHORIZED_SENDER"}}).to_string()),
        ];
        let mut calls = 0;
        let mut notices = Vec::new();
        let mut waits = Vec::new();
        watch_registry_with(
            |_| {
                let response = responses
                    .get(calls)
                    .expect("revocation must stop the watcher")
                    .clone();
                calls += 1;
                response
            },
            |message| {
                notices.push(message.to_string());
                Ok(())
            },
            |duration| waits.push(duration),
        );
        assert_eq!(calls, 3);
        assert_eq!(notices.len(), 1);
        assert!(notices[0].contains("notifications/tools/list_changed"));
        assert!(waits
            .iter()
            .all(|duration| *duration <= std::time::Duration::from_secs(5)));
        assert!(!waits.is_empty());
    }

    fn registry_response(tools: Value) -> String {
        json!({"jsonrpc":"2.0","id":"registry","result":{
            "isError":false,"structuredContent":{"version":1,"revision":2,
            "missionId":"00000000-0000-4000-8000-000000000001","tools":tools}
        }})
        .to_string()
    }

    #[test]
    fn session_registry_comes_from_main_and_never_from_provider_params() {
        let response = handle_session_message(
            r#"{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{"role":"supervisor"}}"#,
            |request| {
                let request: Value = serde_json::from_str(request).unwrap();
                assert_eq!(request["params"]["name"], "threadhelm_tool_registry");
                assert_eq!(request["params"]["arguments"], json!({}));
                Ok(registry_response(json!([{"name":"threadhelm_work_result",
                    "description":"Return deliberate work evidence", "inputSchema":{"type":"object"}}])))
            },
        ).unwrap();
        let response: Value = serde_json::from_str(&response).unwrap();
        let names: Vec<_> = response["result"]["tools"]
            .as_array()
            .unwrap()
            .iter()
            .map(|tool| tool["name"].as_str().unwrap())
            .collect();
        assert!(names.contains(&"threadhelm_work_result"));
        assert!(!names.contains(&"threadhelm_work_assign"));
        assert!(names.contains(&"threadhelm_list_pending"));
    }

    #[test]
    fn unavailable_or_invalid_registry_keeps_mailbox_and_grants_no_role() {
        let request = r#"{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}"#;
        for registry in [
            Err("PIPE_DISCONNECTED_SAFE_DEGRADE".to_string()),
            Ok(registry_response(
                json!([{"name":"shell_execute","description":"Bad", "inputSchema":{}}]),
            )),
            Ok(registry_response(
                json!([{"name":"threadhelm_work_assign","description":"Bad", "inputSchema":{},"command":"sh"}]),
            )),
        ] {
            let response = handle_session_message(request, |_| registry.clone()).unwrap();
            assert!(response.contains("threadhelm_list_pending"));
            assert!(!response.contains("threadhelm_work_assign"));
            assert!(!response.contains("shell_execute"));
        }
    }

    #[test]
    fn role_changes_are_advertised_and_watch_errors_do_not_become_revisions() {
        let response: Value = serde_json::from_str(
            &handle_mcp_message(r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}"#)
                .unwrap(),
        )
        .unwrap();
        assert_eq!(
            response["result"]["capabilities"]["tools"]["listChanged"],
            true
        );
        assert_eq!(registry_revision(&registry_response(json!([]))), Ok(2));
        assert!(registry_revision(
            r#"{"result":{"isError":true,"structuredContent":{"version":1,"revision":4}}}"#
        )
        .is_err());
    }

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
        assert!(response.contains("threadhelm_memory_search"));
        assert!(response.contains("threadhelm_memory_get"));
        assert!(response.contains("threadhelm_memory_propose_revision"));
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
