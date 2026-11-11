pub mod group_members;
pub mod groups;
pub mod status;
pub mod transactions;
pub use crate::state_server;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde::Serialize;
use serde_json::json;

pub struct AppError<T: Serialize = ()> {
    error: anyhow::Error,
    content: Option<T>,
}

/// Error raised when the client sent an invalid payload. Mapped to HTTP 400.
#[derive(Debug)]
pub struct BadRequest(pub String);

impl std::fmt::Display for BadRequest {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl std::error::Error for BadRequest {}

impl<T: Serialize> AppError<T> {
    pub fn bad_request(message: String, content: Option<T>) -> Self {
        Self {
            error: BadRequest(message).into(),
            content,
        }
    }
}

impl<T: Serialize> AppError<T> {
    fn convert_content(&self) -> serde_json::value::Value {
        match &self.content {
            Some(content) => serde_json::to_value(content).unwrap_or_default(),
            None => serde_json::to_value(serde_json::value::Value::Null).unwrap_or_default(),
        }
    }

    fn message(&self) -> String {
        let content = self.convert_content();
        let m = json!({"message":self.error.to_string(), "content":content});
        serde_json::to_string(&m).unwrap_or(String::from(""))
    }

    pub fn convert_message(&self) -> (StatusCode, String) {
        if self.error.downcast_ref::<BadRequest>().is_some() {
            return (StatusCode::BAD_REQUEST, self.message());
        }
        if let Some(diesel_error) = self.error.downcast_ref() {
            return match diesel_error {
                diesel::NotFound => (StatusCode::NOT_FOUND, self.message()),
                _ => (StatusCode::INTERNAL_SERVER_ERROR, self.message()),
            };
        }

        (StatusCode::INTERNAL_SERVER_ERROR, self.message())
    }
}

impl<E, T> From<E> for AppError<T>
where
    T: Serialize,
    E: Into<anyhow::Error>,
{
    fn from(err: E) -> Self {
        Self {
            error: err.into(),
            content: None,
        }
    }
}

// Tell axum how to convert `AppError` into a response.
impl<T: Serialize> IntoResponse for AppError<T> {
    fn into_response(self) -> Response {
        self.convert_message().into_response()
    }
}
