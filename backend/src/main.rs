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

    let state_server = state_server::StateServer { pool: connection };
    let front_url = env::var("FRONT_URL")?;

    let listening_url = env::var("LISTENING_URL")?;
    let app: Router = router::create_router(&front_url, state_server)?;
    let backend = async {
        let _ = serve(app, &listening_url).await;
    };

    tokio::join!(backend);
    Ok(())
}

async fn serve(app: Router, listening_url: &str) -> anyhow::Result<()> {
    println!("Backend run: {}", listening_url);

    let addr = SocketAddr::from_str(listening_url)?;
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
