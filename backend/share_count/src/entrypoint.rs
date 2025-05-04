pub mod group_members;
pub mod groups;
pub mod transactions;

pub use crate::state_server;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};

pub struct AppError(pub anyhow::Error);

// Tell axum how to convert `AppError` into a response.
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        if let Some(diesel_error) = self.0.downcast_ref() {
            return match diesel_error {
                diesel::NotFound => (
                    StatusCode::NOT_FOUND,
                    format!("Something went wrong: {}", self.0),
                )
                    .into_response(),
                _ => (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Database error: {}", diesel_error),
                )
                    .into_response(),
            };
        }

        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Something went wrong: {}", self.0),
        )
            .into_response()
    }
}

impl<E> From<E> for AppError
where
    E: Into<anyhow::Error>,
{
    fn from(err: E) -> Self {
        Self(err.into())
    }
}
