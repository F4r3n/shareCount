use axum::{
    extract::{Path, State},
    Json,
};
use chrono::NaiveDateTime;
use diesel::{
    r2d2::{ConnectionManager, PooledConnection},
    AsChangeset, Connection, ExpressionMethods, Insertable, PgConnection, QueryDsl, Queryable,
    RunQueryDsl, Selectable, SelectableHelper,
};
use serde::{Deserialize, Serialize};

use crate::{
    entrypoint::{groups::get_group_id, AppError},
    schema::{group_members_history, groups_history},
    state_server,
};

#[derive(Queryable, Selectable, Debug, Serialize, Insertable, Deserialize, AsChangeset, Clone)]
#[diesel(table_name = crate::schema::group_members_history)]
#[diesel(check_for_backend(diesel::pg::Pg))] // Add backend check
pub struct GroupMemberHistory {
    pub nickname: String,
    pub modified_at: NaiveDateTime,
    pub operation: String,
    pub group_member_id: i32,
}

fn get_members_history(
    group_id: i32,
    conn: &mut PooledConnection<ConnectionManager<PgConnection>>,
) -> Result<Vec<GroupMemberHistory>, anyhow::Error> {
    let results = group_members_history::table
        .select(GroupMemberHistory::as_select())
        .filter(group_members_history::group_id.eq(group_id))
        .order(group_members_history::group_member_id.asc())
        .then_order_by(group_members_history::modified_at.desc())
        .get_results::<GroupMemberHistory>(conn)?;

    Ok(results)
}

pub async fn handler_get_members_history(
    State(state_server): State<state_server::StateServer>,
    Path(token): Path<String>,
) -> Result<Json<Vec<GroupMemberHistory>>, AppError> {
    let mut conn = state_server.pool.get()?;
    let r = conn
        .transaction::<Vec<GroupMemberHistory>, anyhow::Error, _>(|conn| {
            let group_id = get_group_id(&token, conn)?;
            let results = get_members_history(group_id, conn)?;

            Ok(results)
        })
        .map_err(AppError::from)?;

    Ok(Json(r))
}

#[derive(Queryable, Selectable, Debug, Serialize, Insertable, Deserialize, AsChangeset, Clone)]
#[diesel(table_name = crate::schema::groups_history)]
#[diesel(check_for_backend(diesel::pg::Pg))] // Add backend check
pub struct GroupHistory {
    pub name: String,
    pub currency_id: String,
}

pub async fn handler_get_group_history(
    State(state_server): State<state_server::StateServer>,
    Path(token): Path<String>,
) -> Result<Json<Vec<GroupHistory>>, AppError> {
    let mut conn = state_server.pool.get()?;
    let r = conn
        .transaction::<Vec<GroupHistory>, anyhow::Error, _>(|conn| {
            let group_id = get_group_id(&token, conn)?;
            let results = groups_history::table
                .select(GroupHistory::as_select())
                .filter(groups_history::id.eq(group_id))
                .order(groups_history::modified_at.desc())
                .get_results::<GroupHistory>(conn)?;

            Ok(results)
        })
        .map_err(AppError::from)?;

    Ok(Json(r))
}
