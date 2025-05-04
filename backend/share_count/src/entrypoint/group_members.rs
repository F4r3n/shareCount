use crate::entrypoint::AppError;
use crate::schema::group_members;
use crate::schema::groups;
pub use crate::state_server;
use axum::{
    extract::{Path, State},
    response::Json,
};

use diesel::prelude::*;

pub async fn handler_group_members(
    State(state_server): State<state_server::StateServer>,
    Path(token): Path<String>,
) -> Result<Json<Vec<String>>, AppError> {
    let mut conn = state_server.pool.get()?;

    let results = groups::table
        .inner_join(group_members::table.on(groups::id.eq(group_members::group_id)))
        .filter(groups::token.eq(token))
        .select(group_members::nickname)
        .load::<String>(&mut conn)?;

    Ok(Json(results)).map_err(AppError)
}
