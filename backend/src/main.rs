use std::env;
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

    let port = env::var("PORT")?.parse::<u16>()?;
    let app: Router = router::create_router(&front_url, state_server)?;
    let backend = async {
        let _ = serve(app, port).await;
    };

    tokio::join!(backend);
    Ok(())
}

async fn serve(app: Router, port: u16) -> anyhow::Result<()> {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    println!("Backend run: 127.0.0.1:{}", port);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
