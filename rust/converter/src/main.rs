// Copyright (c) Safe Appeals. All rights reserved.

//! sa-converter binary entry point: long-lived NDJSON sidecar on stdin/stdout.

use sa_converter::protocol::{read_next_request, write_error, ReadOutcome};
use sa_converter::Server;
use std::io::{self, BufReader};

fn main() {
	if let Err(e) = run() {
		eprintln!("sa-converter fatal error: {e}");
		std::process::exit(1);
	}
}

fn run() -> io::Result<()> {
	let stdin = io::stdin();
	let mut reader = BufReader::new(stdin.lock());
	let mut stdout = io::stdout().lock();
	let mut server = Server::new();

	loop {
		match read_next_request(&mut reader)? {
			ReadOutcome::Eof => break,
			ReadOutcome::Request(request) => {
				server.handle_request(&request, &mut stdout)?;
				if server.shutdown_requested() {
					break;
				}
			}
			ReadOutcome::Malformed { error, id, .. } => {
				if let Some(id) = id {
					write_error(
						&mut stdout,
						&id,
						"INVALID_REQUEST",
						&format!("invalid JSON request: {error}"),
					)?;
				} else {
					eprintln!("sa-converter: invalid JSON request (no id): {error}");
				}
			}
		}
	}

	Ok(())
}
