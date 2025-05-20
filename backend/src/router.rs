use crate::entrypoint::{group_members, groups, transactions};
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
            axum::http::Method::DELETE,
            axum::http::Method::PATCH,
        ])
        .allow_headers([axum::http::header::CONTENT_TYPE]);

    let app = Router::new()
        .route("/users/{user_id}/groups", get(groups::handler_users_groups))
        .route("/groups/{token_id}", get(groups::handler_groups))
        .route(
            "/groups",
            post(groups::handler_create_group).delete(groups::handler_delete_group),
        )
        .route(
            "/groups/{token_id}/transactions",
            get(transactions::handler_get_all_transactions)
                .delete(transactions::handler_delete_transaction)
                .post(transactions::handler_modify_transaction),
        )
        .route(
            "/groups/{token_id}/transactions/{transaction_uuid}",
            get(transactions::handler_get_transaction),
        )
        .route(
            "/groups/{token_id}/group_members",
            get(group_members::handler_group_members)
                .post(group_members::handler_add_group_members)
                .delete(group_members::handler_delete_group_members),
        )
        .with_state(state_server)
        .layer(cors_layer);

    Ok(app)
}
