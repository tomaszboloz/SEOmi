use super::{MAX_PROTOCOL_LINES, MAX_PROTOCOL_LINE_BYTES};
use serde_json::Value;
use std::{
    io::{BufRead, Read},
    sync::mpsc::Receiver,
    time::Instant,
};

pub(super) fn receive_response(
    stdout: &Receiver<Result<Vec<u8>, String>>,
    expected_id: u64,
    deadline: Instant,
    total_bytes: &mut usize,
    total_lines: &mut usize,
) -> Result<Value, String> {
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            return Err("MCP server did not answer within the discovery timeout.".into());
        }
        let line = stdout
            .recv_timeout(remaining)
            .map_err(|_| "MCP server did not answer within the discovery timeout.".to_string())??;
        *total_lines = total_lines.saturating_add(1);
        *total_bytes = total_bytes.saturating_add(line.len());
        if *total_lines > MAX_PROTOCOL_LINES {
            return Err("MCP server exceeded the discovery protocol message limit.".into());
        }
        if line.len() > MAX_PROTOCOL_LINE_BYTES || *total_bytes > MAX_PROTOCOL_LINE_BYTES {
            return Err("MCP server response exceeded the 1 MiB discovery limit.".into());
        }
        let message: Value = serde_json::from_slice(&line)
            .map_err(|_| "MCP server wrote non-JSON data to its protocol output.".to_string())?;
        if message.get("id").and_then(Value::as_u64) != Some(expected_id) {
            continue;
        }
        if let Some(error) = message.get("error") {
            let description = error
                .get("message")
                .and_then(Value::as_str)
                .unwrap_or("MCP protocol request failed.");
            return Err(description.chars().take(500).collect());
        }
        return message
            .get("result")
            .cloned()
            .ok_or_else(|| "MCP server response did not include a result.".into());
    }
}

pub(super) fn read_protocol_line(
    reader: &mut impl BufRead,
    remaining: usize,
) -> Result<Option<Vec<u8>>, String> {
    let mut line = Vec::new();
    let bytes = reader
        .take(remaining.saturating_add(1) as u64)
        .read_until(b'\n', &mut line)
        .map_err(|_| "MCP protocol read failed.".to_string())?;
    if bytes > remaining {
        return Err("MCP server response exceeded the 1 MiB discovery limit.".into());
    }
    Ok((bytes > 0).then_some(line))
}
