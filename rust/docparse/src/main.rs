// Copyright (c) Safe Appeals. All rights reserved.

//! sa-docparse binary: loopback HTTP sidecar for DocParse / Unlimited-OCR.

use docparse::config::ServerConfig;
use docparse::server::{app_state_from_config, build_router};
use std::net::SocketAddr;
use tokio::net::TcpListener;

#[tokio::main]
async fn main() {
	if let Err(e) = run().await {
		eprintln!("sa-docparse fatal error: {e}");
		std::process::exit(1);
	}
}

async fn run() -> Result<(), Box<dyn std::error::Error>> {
	let config = ServerConfig::from_env_args()?;
	let bind = config.bind_addr();
	let addr: SocketAddr = bind.parse()?;
	let state = app_state_from_config(config);
	let app = build_router(state);

	let listener = TcpListener::bind(addr).await?;
	eprintln!("sa-docparse listening on http://{bind} (loopback only)");

	axum::serve(listener, app)
		.with_graceful_shutdown(shutdown_signal())
		.await?;

	Ok(())
}

async fn shutdown_signal() {
	let _ = tokio::signal::ctrl_c().await;
	eprintln!("sa-docparse shutting down");
}
