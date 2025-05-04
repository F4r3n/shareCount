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
    let connection = state_server::establish_connection()?;
    let state_server = state_server::StateServer { pool: connection };
    let front_url = env::var("FRONT_URL")?;
    // see https://docs.rs/tower-http/latest/tower_http/cors/index.html
    // for more details
    //
    // pay attention that for some request types like posting content-type: application/json
    // it is required to add ".allow_headers([http::header::CONTENT_TYPE])"
    // or see this issue https://github.com/tokio-rs/axum/issues/849
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
