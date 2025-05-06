use crate::entrypoint::AppError;
use crate::schema::group_members;
use crate::schema::groups;
pub use crate::state_server;

use axum::{
    extract::{Path, State},
    response::Json,
};

use diesel::prelude::*;
use serde::Deserialize;
use serde::Serialize;

#[derive(Deserialize, Serialize, Queryable, Debug, AsChangeset)]
pub struct GroupMember {
    pub id: i32,
    pub nickname: String,
}

pub async fn handler_group_members(
    State(state_server): State<state_server::StateServer>,
    Path(token): Path<String>,
) -> Result<Json<Vec<GroupMember>>, AppError> {
    let mut conn = state_server.pool.get()?;

    let results = groups::table
        .inner_join(group_members::table.on(groups::id.eq(group_members::group_id)))
        .filter(groups::token.eq(token))
        .select((group_members::id, group_members::nickname))
        .load::<GroupMember>(&mut conn)?;

    Ok(Json(results)).map_err(AppError)
}

pub async fn handler_add_group_members(
    State(state_server): State<state_server::StateServer>,
    Path(token): Path<String>,
    Json(members): Json<Vec<String>>,
) -> Result<(), AppError> {
    let mut conn = state_server.pool.get()?;
    conn.transaction::<_, anyhow::Error, _>(|conn| {
        let group_id = groups::table
            .select(groups::id)
            .filter(groups::token.eq(token))
            .get_result::<i32>(conn)?;

        #[derive(Insertable)]
        #[diesel(table_name = group_members)]
        pub struct NewGroupMember {
            group_id: i32,
            nickname: String,
            user_id: Option<i32>,
        }

        let new_members: Vec<_> = members
            .into_iter()
            .map(|nickname| NewGroupMember {
                group_id,
                nickname,
                user_id: None, // Assuming user_id is optional
            })
            .collect();
        diesel::insert_into(group_members::table)
            .values(&new_members)
            .on_conflict((group_members::group_id, group_members::nickname))
            .do_nothing() // Skip existing members
            .returning(group_members::id)
            .execute(conn)?;
        Ok(())
    })
    .map_err(AppError)?;

    Ok(()).map_err(AppError)
}

#[derive(Serialize, Deserialize, Queryable, Debug)]
pub struct RenameGroupMembers {
    id: i32,
    new: String,
}

pub async fn handler_rename_group_members(
    State(state_server): State<state_server::StateServer>,
    Path(token): Path<String>,
    Json(members): Json<Vec<RenameGroupMembers>>,
) -> Result<(), AppError> {
    let mut conn = state_server.pool.get()?;

    conn.transaction::<_, anyhow::Error, _>(|conn| {
        let group_id = groups::table
            .select(groups::id)
            .filter(groups::token.eq(&token))
            .first::<i32>(conn)?;

        for rename in members {
            let update = GroupMember {
                id: rename.id,
                nickname: rename.new,
            };

            diesel::update(
                group_members::table
                    .filter(group_members::id.eq(rename.id))
                    .filter(group_members::group_id.eq(group_id)),
            )
            .set(&update)
            .execute(conn)?;
        }

        Ok(())
    })
    .map_err(AppError)?;

    Ok(()).map_err(AppError)
}
