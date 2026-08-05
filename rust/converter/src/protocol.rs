// Copyright (c) Safe Appeals. All rights reserved.

//! NDJSON protocol types and framing helpers.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{self, BufRead, Write};

pub const VERSION: &str = "0.1.0";

/// Incoming request line.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct Request {
	pub id: String,
	pub method: String,
	#[serde(default)]
	pub params: Value,
}

/// Successful response envelope.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct Response {
	pub id: String,
	pub result: Value,
}

/// Error payload inside a response.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct ErrorBody {
	pub code: String,
	pub message: String,
	#[serde(skip_serializing_if = "Option::is_none")]
	pub data: Option<Value>,
}

/// Error response envelope.
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct ErrorResponse {
	pub id: String,
	pub error: ErrorBody,
}

/// Progress notification aligned with sidecar plan (method + params envelope).
#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct ProgressNotification {
	#[serde(skip_serializing_if = "Option::is_none")]
	pub id: Option<String>,
	pub method: String,
	pub params: ProgressParams,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq)]
pub struct ProgressParams {
	pub job_id: String,
	pub progress: u8,
	pub message: String,
	#[serde(rename = "type")]
	pub progress_type: String,
}

/// Outcome of reading one NDJSON line from the stream.
#[derive(Debug, Clone, PartialEq)]
pub enum ReadOutcome {
	/// End of input (stdin closed).
	Eof,
	/// Successfully parsed request.
	Request(Request),
	/// Malformed JSON on a non-blank line.
	Malformed {
		line: String,
		error: String,
		id: Option<String>,
	},
}

/// Read the next NDJSON request, skipping blank lines. Returns `Eof` only on end of input.
pub fn read_next_request<R: BufRead>(reader: &mut R) -> io::Result<ReadOutcome> {
	loop {
		let mut line = String::new();
		let bytes = reader.read_line(&mut line)?;
		if bytes == 0 {
			return Ok(ReadOutcome::Eof);
		}
		let trimmed = line.trim();
		if trimmed.is_empty() {
			continue;
		}
		match serde_json::from_str::<Request>(trimmed) {
			Ok(request) => return Ok(ReadOutcome::Request(request)),
			Err(e) => {
				return Ok(ReadOutcome::Malformed {
					line: trimmed.to_string(),
					error: e.to_string(),
					id: extract_request_id(trimmed),
				});
			}
		}
	}
}

/// Best-effort extraction of `id` from a malformed request line.
pub fn extract_request_id(line: &str) -> Option<String> {
	let value: Value = serde_json::from_str(line.trim()).ok()?;
	value.get("id")?.as_str().map(str::to_string)
}

/// Read one NDJSON request from a line-oriented reader (legacy helper for tests).
pub fn read_request<R: BufRead>(reader: &mut R) -> io::Result<Option<Request>> {
	match read_next_request(reader)? {
		ReadOutcome::Eof => Ok(None),
		ReadOutcome::Request(request) => Ok(Some(request)),
		ReadOutcome::Malformed { error, .. } => Err(io::Error::new(
			io::ErrorKind::InvalidData,
			format!("invalid JSON request: {error}"),
		)),
	}
}

/// Write a success response as one NDJSON line.
pub fn write_response<W: Write>(writer: &mut W, id: &str, result: Value) -> io::Result<()> {
	let response = Response {
		id: id.to_string(),
		result,
	};
	write_line(writer, &response)
}

/// Write an error response as one NDJSON line.
pub fn write_error<W: Write>(writer: &mut W, id: &str, code: &str, message: &str) -> io::Result<()> {
	write_error_with_data(writer, id, code, message, None)
}

/// Write an error response with optional structured data.
pub fn write_error_with_data<W: Write>(
	writer: &mut W,
	id: &str,
	code: &str,
	message: &str,
	data: Option<Value>,
) -> io::Result<()> {
	let response = ErrorResponse {
		id: id.to_string(),
		error: ErrorBody {
			code: code.to_string(),
			message: message.to_string(),
			data,
		},
	};
	write_line(writer, &response)
}

/// Write a progress notification as one NDJSON line.
pub fn write_progress<W: Write>(
	writer: &mut W,
	job_id: &str,
	progress: u8,
	message: &str,
) -> io::Result<()> {
	let notification = ProgressNotification {
		id: Some(job_id.to_string()),
		method: "progress".to_string(),
		params: ProgressParams {
			job_id: job_id.to_string(),
			progress,
			message: message.to_string(),
			progress_type: "single_progress".to_string(),
		},
	};
	write_line(writer, &notification)
}

fn write_line<W: Write, T: Serialize>(writer: &mut W, value: &T) -> io::Result<()> {
	let json = serde_json::to_string(value).map_err(|e| {
		io::Error::new(
			io::ErrorKind::InvalidData,
			format!("JSON serialize failed: {e}"),
		)
	})?;
	writer.write_all(json.as_bytes())?;
	writer.write_all(b"\n")?;
	writer.flush()
}

/// Parse a response line and return the correlated id.
pub fn parse_response_id(line: &str) -> Option<String> {
	let value: Value = serde_json::from_str(line).ok()?;
	value.get("id")?.as_str().map(str::to_string)
}

#[cfg(test)]
mod tests {
	use super::*;
	use std::io::Cursor;

	#[test]
	fn round_trip_request() {
		let json = r#"{"id":"req-1","method":"ping","params":{}}"#;
		let mut cursor = Cursor::new(format!("{json}\n"));
		let req = read_request(&mut cursor).unwrap().unwrap();
		assert_eq!(req.id, "req-1");
		assert_eq!(req.method, "ping");
	}

	#[test]
	fn response_id_correlation() {
		let mut buf = Vec::new();
		write_response(&mut buf, "abc-123", serde_json::json!({"ok": true})).unwrap();
		let line = String::from_utf8(buf).unwrap();
		assert_eq!(parse_response_id(&line), Some("abc-123".to_string()));
	}

	#[test]
	fn error_response_format() {
		let mut buf = Vec::new();
		write_error(&mut buf, "e-1", "UNKNOWN_METHOD", "no such method").unwrap();
		let line = String::from_utf8(buf).unwrap();
		let parsed: ErrorResponse = serde_json::from_str(line.trim()).unwrap();
		assert_eq!(parsed.id, "e-1");
		assert_eq!(parsed.error.code, "UNKNOWN_METHOD");
	}

	#[test]
	fn progress_notification_format() {
		let mut buf = Vec::new();
		write_progress(&mut buf, "job-1", 50, "halfway").unwrap();
		let line = String::from_utf8(buf).unwrap();
		let parsed: ProgressNotification = serde_json::from_str(line.trim()).unwrap();
		assert_eq!(parsed.id, Some("job-1".to_string()));
		assert_eq!(parsed.method, "progress");
		assert_eq!(parsed.params.job_id, "job-1");
		assert_eq!(parsed.params.progress, 50);
		assert_eq!(parsed.params.message, "halfway");
		assert_eq!(parsed.params.progress_type, "single_progress");
	}

	#[test]
	fn read_next_request_skips_blank_lines() {
		let mut cursor = Cursor::new("\n\n{\"id\":\"r1\",\"method\":\"ping\",\"params\":{}}\n");
		let outcome = read_next_request(&mut cursor).unwrap();
		assert!(matches!(outcome, ReadOutcome::Request(_)));
	}

	#[test]
	fn read_next_request_malformed_returns_outcome() {
		let mut cursor = Cursor::new("{not json}\n");
		let outcome = read_next_request(&mut cursor).unwrap();
		assert!(matches!(outcome, ReadOutcome::Malformed { .. }));
	}

	#[test]
	fn extract_request_id_from_valid_json() {
		assert_eq!(
			extract_request_id(r#"{"id":"x-1","method":"ping"}"#),
			Some("x-1".to_string())
		);
		assert_eq!(extract_request_id("{not json}"), None);
	}
}
