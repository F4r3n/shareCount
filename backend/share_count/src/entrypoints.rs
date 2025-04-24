use crate::schema;
pub use crate::state_server;
use crate::Group;
use axum::http::StatusCode;
use axum::{
    extract::{Path, Query, State},
    response::{IntoResponse, Json, Response},
};
use diesel::dsl::insert_into;
use diesel::prelude::*;
use schema::group_members;
use schema::groups;
use uuid::Uuid;

pub struct AppError(anyhow::Error);

// Tell axum how to convert `AppError` into a response.
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
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

pub async fn handler_users_groups(
    State(state_server): State<state_server::StateServer>,
    Path(user_id): Path<i32>,
) -> Result<Json<Vec<Group>>, AppError> {
    let mut conn = state_server.pool.get()?;

    let results = groups::table
        .inner_join(group_members::table.on(groups::id.eq(group_members::group_id)))
        .filter(group_members::user_id.eq(user_id))
        .select(Group::as_select())
        .load::<Group>(&mut conn)?;

    Ok(Json(results)).map_err(AppError)
}
#[derive(serde::Serialize)]
pub struct GroupResponse {
    name: String,
    currency: String,
    created_at: chrono::NaiveDateTime,
}
pub async fn handler_groups(
    State(state_server): State<state_server::StateServer>,
    Path(token): Path<String>,
) -> Result<Json<Vec<GroupResponse>>, AppError> {
    let mut conn = state_server.pool.get()?;

    let results = groups::table
        .filter(groups::token.eq(token))
        .select(Group::as_select())
        .load::<Group>(&mut conn)?;

    let simplified_results: Vec<GroupResponse> = results
        .iter()
        .map(|group| GroupResponse {
            name: group.name.clone(),
            currency: group.currency.clone(),
            created_at: group.created_at,
        })
        .collect();

    Ok(Json(simplified_results)).map_err(AppError)
}

use serde::Deserialize;
#[derive(Deserialize)]
pub struct CreateGroups {
    name: String,
    currency: String,
    nicknames: Vec<String>,
}

pub async fn handler_create_groups(
    State(state_server): State<state_server::StateServer>,
    Query(create): Query<CreateGroups>,
) -> Result<Json<String>, AppError> {
    let mut conn = state_server.pool.get()?;
    let token = Uuid::new_v4().to_string();
    let result = insert_into(groups::table)
        .values((
            groups::dsl::name.eq(create.name),
            groups::dsl::currency.eq(create.currency),
            groups::dsl::token.eq(token.clone()),
        ))
        .get_result::<Group>(&mut conn)?;

    let mut vec = vec![];
    for n in create.nicknames {
        vec.push((
            group_members::dsl::group_id.eq(result.id),
            group_members::dsl::nickname.eq(n),
        ));
    }

    insert_into(group_members::table)
        .values(&vec)
        .execute(&mut conn)?;

    Ok(Json(token)).map_err(AppError)
}
