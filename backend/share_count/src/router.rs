use crate::entrypoints;
use crate::state_server;

use axum::{
    http::HeaderValue,
    routing::{get, post},
    Router,
};
use state_server::StateServer;
use tower_http::cors::CorsLayer;

pub fn create_router(url: &str, state_server: StateServer) -> Result<Router, anyhow::Error> {
    let cors_layer = CorsLayer::new()
        .allow_origin(vec![
            url.parse::<HeaderValue>()?,
            "http://192.168.1.10:5173".parse::<HeaderValue>()?,
        ])
        .allow_credentials(true)
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
        ])
        .allow_headers([axum::http::header::CONTENT_TYPE]);

    let app = Router::new()
        .route(
            "/users/{user_id}/groups",
            get(entrypoints::handler_users_groups),
        )
        .route("/groups/{token_id}", get(entrypoints::handler_groups))
        .route("/groups", post(entrypoints::handler_create_groups))
        .route(
            "/transactions/{token_id}",
            get(entrypoints::handler_transactions),
        )
        .route(
            "/groups/{token_id}/transactions/{transaction_id}",
            post(entrypoints::handler_post_transaction),
        )
        .route(
            "/groups/{token_id}/transactions",
            post(entrypoints::handler_post_transaction),
        )
        .route(
            "/groups/{token_id}/group_members",
            get(entrypoints::handler_group_members),
        )
        .with_state(state_server)
        .layer(cors_layer);

    Ok(app)
}
