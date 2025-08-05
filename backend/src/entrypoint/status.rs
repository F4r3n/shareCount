use axum::{extract::State, Json};

use crate::{entrypoint::AppError, state_server};

const VERSION: &str = env!("CARGO_PKG_VERSION");

pub async fn handler_version(
    State(_state_server): State<state_server::StateServer>,
) -> Result<Json<String>, AppError> {
    Ok(Json(VERSION.to_string()))
}
