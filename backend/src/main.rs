use std::{env, str::FromStr};
pub mod entrypoint;
pub mod models;
pub mod schema;
pub mod state_server;
use axum::Router;
use std::net::SocketAddr;
pub mod router;
use dotenvy::dotenv;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenv().ok();
    println!("Start server...");
    let connection = state_server::establish_connection()?;
    println!("Connection established...");
    state_server::run_migrations(&connection)?;

    let state_server = state_server::StateServer { pool: connection };
    let front_url = env::var("FRONT_URL")?;

    let listening_url = env::var("LISTENING_URL")?;
    let app: Router = router::create_router(&front_url, state_server)?;
    serve(app, &listening_url).await
}

async fn serve(app: Router, listening_url: &str) -> anyhow::Result<()> {
    println!("Backend run: {listening_url}");

    let addr = SocketAddr::from_str(listening_url)?;
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    println!("Backend stopped");
    Ok(())
}

/// Resolves on Ctrl+C or SIGTERM (sent by `podman/docker stop`), so in-flight
/// requests finish and the container stops immediately instead of being killed.
async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };

    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut signal) => {
                signal.recv().await;
            }
            Err(_) => std::future::pending::<()>().await,
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}
