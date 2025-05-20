use crate::entrypoint::AppError;
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

#[derive(Queryable, Selectable, Debug, Serialize, Insertable, Deserialize, AsChangeset, Clone)]
#[diesel(table_name = crate::schema::groups)]
#[diesel(check_for_backend(diesel::pg::Pg))] // Add backend check
pub struct GroupNoID {
    pub token: String,
    pub name: String,
    pub modified_at: NaiveDateTime,
    pub created_at: NaiveDateTime,
    pub currency_id: String,
}

impl GroupNoID {
    pub fn new(name: &str, currency: &str) -> Self {
        Self {
            token: uuid::Uuid::new_v4().to_string(),
            name: name.to_string(),
            modified_at: chrono::Utc::now().naive_utc(),
            created_at: chrono::Utc::now().naive_utc(),
            currency_id: currency.to_string(),
        }
    }
}

pub fn get_group_id(
    token_id: &str,
    conn: &mut PooledConnection<ConnectionManager<PgConnection>>,
) -> Result<i32, anyhow::Error> {
    let group_id = groups::table
        .select(groups::id)
        .filter(groups::token.eq(token_id))
        .get_result::<i32>(conn)?;

    Ok(group_id)
}

pub fn get_group(
    id: i32,
    conn: &mut PooledConnection<ConnectionManager<PgConnection>>,
) -> Result<GroupNoID, anyhow::Error> {
    let group = groups::table
        .select(GroupNoID::as_select())
        .filter(groups::id.eq(id))
        .get_result::<GroupNoID>(conn)?;

    Ok(group)
}

//users/{user_id}/groups
pub async fn handler_users_groups(
    State(state_server): State<state_server::StateServer>,
    Path(user_id): Path<i32>,
) -> Result<Json<Vec<GroupNoID>>, AppError> {
    let mut conn = state_server.pool.get()?;

    let results = groups::table
        .inner_join(group_members::table.on(groups::id.eq(group_members::group_id)))
        .filter(group_members::user_id.eq(user_id))
        .select(GroupNoID::as_select())
        .load::<GroupNoID>(&mut conn)?;

    Ok(Json(results))
}

///groups/{token_id}
pub async fn handler_groups(
    State(state_server): State<state_server::StateServer>,
    Path(token): Path<String>,
) -> Result<Json<GroupNoID>, AppError> {
    let mut conn = state_server.pool.get()?;

    let results = groups::table
        .select(GroupNoID::as_select())
        .filter(groups::token.eq(token))
        .first::<GroupNoID>(&mut conn)?;
    Ok(Json(results))
}

///groups
pub async fn handler_create_group(
    State(state_server): State<state_server::StateServer>,
    Json(group_query): Json<GroupNoID>,
) -> Result<Json<GroupNoID>, AppError> {
    let mut conn = state_server.pool.get()?;

    #[derive(Queryable, PartialEq, Debug, Selectable, Serialize, Insertable, AsChangeset)]
    struct Group {
        name: String,
        currency_id: String,
        token: String,
        created_at: NaiveDateTime,
        modified_at: NaiveDateTime,
    }
    let group = conn
        .transaction::<GroupNoID, anyhow::Error, _>(|conn| {
            let to_insert = Group {
                created_at: group_query.created_at,
                currency_id: group_query.currency_id,
                name: group_query.name,
                token: group_query.token,
                modified_at: group_query.modified_at,
            };
            use diesel::query_dsl::methods::FilterDsl;
            use diesel::upsert::excluded;
            let group_id = insert_into(groups::table)
                .values(&to_insert)
                .on_conflict(groups::token)
                .do_update()
                .set(&to_insert)
                .filter(groups::modified_at.lt(excluded(groups::modified_at)))
                .returning(groups::id)
                .get_result::<i32>(conn)?;

            Ok(get_group(group_id, conn)?)
        })
        .map_err(AppError::from);

    Ok(Json(group?))
}

pub async fn handler_delete_group(
    State(state_server): State<state_server::StateServer>,
    Json(group_query): Json<GroupNoID>,
) -> Result<(), AppError> {
    let mut conn = state_server.pool.get()?;

    conn.transaction::<(), anyhow::Error, _>(|conn| {
        diesel::delete(groups::table)
            .filter(groups::modified_at.lt(group_query.modified_at))
            .filter(groups::token.eq(group_query.token))
            .execute(conn)?;
        Ok(())
    })
    .map_err(AppError::from)
}
