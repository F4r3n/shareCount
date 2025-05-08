use crate::entrypoint::AppError;
use crate::schema::currency;
use crate::schema::group_members;
use crate::schema::groups;

pub use crate::state_server;
use axum::{
    extract::{Path, State},
    response::Json,
};
use chrono::NaiveDateTime;
use diesel::dsl::insert_into;
use diesel::prelude::*;
use diesel::r2d2::ConnectionManager;
use diesel::r2d2::PooledConnection;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Deserialize, Serialize, Queryable, Debug)]
pub struct GroupResponse {
    pub name: String,
    pub currency: String,
    pub created_at: NaiveDateTime,
}

pub fn get_group_id(
    token_id: String,
    conn: &mut PooledConnection<ConnectionManager<PgConnection>>,
) -> Result<i32, anyhow::Error> {
    let group_id = groups::table
        .select(groups::id)
        .filter(groups::token.eq(token_id))
        .get_result::<i32>(conn)?;

    Ok(group_id)
}

//users/{user_id}/groups
pub async fn handler_users_groups(
    State(state_server): State<state_server::StateServer>,
    Path(user_id): Path<i32>,
) -> Result<Json<Vec<GroupResponse>>, AppError> {
    let mut conn = state_server.pool.get()?;

    let results = groups::table
        .inner_join(group_members::table.on(groups::id.eq(group_members::group_id)))
        .filter(group_members::user_id.eq(user_id))
        .select((groups::name, groups::currency_id, groups::created_at))
        .load::<GroupResponse>(&mut conn)?;

    Ok(Json(results)).map_err(AppError)
}

///groups/{token_id}
pub async fn handler_groups(
    State(state_server): State<state_server::StateServer>,
    Path(token): Path<String>,
) -> Result<Json<GroupResponse>, AppError> {
    let mut conn = state_server.pool.get()?;

    let results = groups::table
        .select((groups::name, groups::currency_id, groups::created_at))
        .filter(groups::token.eq(token))
        .first::<GroupResponse>(&mut conn)?;
    Ok(Json(results)).map_err(AppError)
}

#[derive(Deserialize)]
pub struct CreateGroups {
    name: String,
    currency_id: String,
    nicknames: Vec<String>,
}

///groups
pub async fn handler_create_groups(
    State(state_server): State<state_server::StateServer>,
    Json(create): Json<CreateGroups>,
) -> Result<Json<String>, AppError> {
    let mut conn = state_server.pool.get()?;
    let token = Uuid::new_v4().to_string();

    #[derive(Queryable, PartialEq, Debug, Selectable, Identifiable, Serialize, Insertable)]
    struct Group {
        id: i32,
        name: String,
        currency_id: String,
        token: String,
        created_at: NaiveDateTime,
    }
    let token = conn
        .transaction::<String, anyhow::Error, _>(|conn| {
            let result = insert_into(groups::table)
                .values((
                    groups::dsl::name.eq(create.name),
                    groups::dsl::currency_id.eq(create.currency_id),
                    groups::dsl::token.eq(token.clone()),
                ))
                .get_result::<Group>(conn)?;

            if !create.nicknames.is_empty() {
                let mut vec = vec![];

                for n in create.nicknames {
                    vec.push((
                        group_members::dsl::group_id.eq(result.id),
                        group_members::dsl::nickname.eq(n),
                    ));
                }

                insert_into(group_members::table)
                    .values(&vec)
                    .execute(conn)?;
            }
            Ok(token)
        })
        .map_err(AppError);

    Ok(Json(token?)).map_err(AppError)
}
