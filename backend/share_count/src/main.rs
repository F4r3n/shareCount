use std::env;
pub mod entrypoints;
pub mod models;
pub mod schema;
pub mod state_server;
use self::models::*;

use axum::{
    http::{HeaderValue, Method},
    routing::{get, post},
    Router,
};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
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
    let cors_layer = CorsLayer::new()
        .allow_origin(front_url.parse::<HeaderValue>()?)
        .allow_methods([Method::GET]);
    let backend = async {
        let app = Router::new()
            .route(
                "/users/{user_id}/groups",
                get(entrypoints::handler_users_groups),
            )
            .route("/groups/{token_id}", get(entrypoints::handler_groups))
            .route(
                "/groups/{token_id}",
                post(entrypoints::handler_create_groups),
            )
            .with_state(state_server)
            .layer(cors_layer);
        let _ = serve(app, port).await;
    };

    tokio::join!(backend);
    Ok(())
}

async fn serve(app: Router, port: u16) -> anyhow::Result<()> {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}
