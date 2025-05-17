use crate::entrypoint::AppError;
use crate::schema::group_members;
use crate::schema::groups;
pub use crate::state_server;

use axum::{
    extract::{Path, State},
    response::Json,
};

use crate::entrypoint::groups::get_group_id;
use chrono::NaiveDateTime;
use diesel::prelude::*;
use serde::Deserialize;
use serde::Serialize;

#[derive(Queryable, Selectable, Debug, Serialize, Insertable, Deserialize, AsChangeset, Clone)]
#[diesel(table_name = crate::schema::group_members)]
#[diesel(check_for_backend(diesel::pg::Pg))] // Add backend check
pub struct GroupMember {
    pub uuid: String,
    pub nickname: String,
    pub modified_at: NaiveDateTime,
}

#[derive(Deserialize, Serialize, Queryable, Debug, Clone)]
pub struct GroupMemberNoDate {
    pub uuid: String,
    pub nickname: String,
}

impl From<GroupMember> for GroupMemberNoDate {
    fn from(item: GroupMember) -> Self {
        GroupMemberNoDate {
            nickname: item.nickname,
            uuid: item.uuid,
        }
    }
}

impl From<&GroupMember> for GroupMemberNoDate {
    fn from(item: &GroupMember) -> Self {
        GroupMemberNoDate {
            nickname: item.nickname.clone(),
            uuid: item.uuid.clone(),
        }
    }
}

pub async fn handler_group_members(
    State(state_server): State<state_server::StateServer>,
    Path(token): Path<String>,
) -> Result<Json<Vec<GroupMember>>, AppError> {
    let mut conn = state_server.pool.get()?;

    let results = groups::table
        .inner_join(group_members::table.on(groups::id.eq(group_members::group_id)))
        .filter(groups::token.eq(token))
        .select((
            group_members::uuid,
            group_members::nickname,
            group_members::modified_at,
        ))
        .get_results::<GroupMember>(&mut conn)?;

    Ok(Json(results))
}

pub async fn handler_add_group_members(
    State(state_server): State<state_server::StateServer>,
    Path(token): Path<String>,
    Json(members): Json<Vec<GroupMember>>,
) -> Result<Json<Vec<GroupMember>>, AppError> {
    let mut conn = state_server.pool.get()?;
    let result = conn
        .transaction::<Vec<GroupMember>, anyhow::Error, _>(|conn| {
            let group_id = get_group_id(token, conn)?;

            #[derive(Insertable)]
            #[diesel(table_name = group_members)]
            pub struct NewGroupMember {
                uuid: String,
                group_id: i32,
                nickname: String,
                user_id: Option<i32>,
                modified_at: NaiveDateTime,
            }

            let new_members: Vec<_> = members
                .into_iter()
                .map(|member| NewGroupMember {
                    uuid: member.uuid,
                    group_id,
                    nickname: member.nickname,
                    user_id: None, // Assuming user_id is optional
                    modified_at: chrono::Utc::now().naive_utc(),
                })
                .collect();
            let result: Vec<GroupMember> = diesel::insert_into(group_members::table)
                .values(&new_members)
                .on_conflict((group_members::group_id, group_members::nickname))
                .do_nothing() // Skip existing members
                .returning((
                    group_members::uuid,
                    group_members::nickname,
                    group_members::modified_at,
                ))
                .get_results(conn)?;
            Ok(result)
        })
        .map_err(AppError::from)?;

    Ok(Json(result))
}

#[derive(Serialize, Deserialize, Queryable, Debug)]
pub struct RenameGroupMembers {
    uuid: String,
    nickname: String,
}

pub async fn handler_rename_group_members(
    State(state_server): State<state_server::StateServer>,
    Path(token): Path<String>,
    Json(members): Json<Vec<RenameGroupMembers>>,
) -> Result<(), AppError> {
    let mut conn = state_server.pool.get()?;

    conn.transaction::<_, anyhow::Error, _>(|conn| {
        let group_id = get_group_id(token, conn)?;

        for rename in members {
            let update = GroupMember {
                uuid: rename.uuid.clone(),
                nickname: rename.nickname,
                modified_at: chrono::Utc::now().naive_utc(),
            };

            diesel::update(
                group_members::table
                    .filter(group_members::uuid.eq(rename.uuid))
                    .filter(group_members::group_id.eq(group_id)),
            )
            .set(&update)
            .execute(conn)?;
        }

        Ok(())
    })
    .map_err(AppError::from)?;

    Ok(())
}

use crate::entrypoint::transactions::{get_transaction_debt, get_transaction_paid_by};

use bigdecimal::num_traits::Zero;
use diesel::r2d2::ConnectionManager;
use diesel::r2d2::PooledConnection;

pub fn get_member_id(
    group_id: i32,
    uuid: String,
    conn: &mut PooledConnection<ConnectionManager<PgConnection>>,
) -> Result<i32, anyhow::Error> {
    let member_result = group_members::table
        .inner_join(groups::table)
        .select(group_members::id)
        .filter(group_members::uuid.eq(uuid))
        .filter(groups::id.eq(group_id))
        .get_result::<i32>(conn)?;
    Ok(member_result)
}

pub async fn handler_delete_group_members(
    State(state_server): State<state_server::StateServer>,
    Path(token): Path<String>,
    Json(members): Json<Vec<GroupMember>>,
) -> Result<(), AppError> {
    let mut conn = state_server.pool.get()?;
    conn.transaction::<(), anyhow::Error, _>(|conn| {
        let group_id = get_group_id(token, conn)?;
        for member in members {
            let member_id = get_member_id(group_id, member.uuid, conn)?;
            let transaction_debts = get_transaction_debt(group_id, member_id, conn)?;
            let has_debt = transaction_debts
                .iter()
                .any(|(_id, number)| !number.is_zero());

            let transaction_paid = get_transaction_paid_by(group_id, member_id, conn)?;
            let has_paid = transaction_paid.iter().any(|tr| !tr.amount.is_zero());

            if !has_debt && !has_paid {
                diesel::delete(group_members::table)
                    .filter(group_members::id.eq(member_id))
                    .execute(conn)?;
            }
        }

        Ok(())
    })
    .map_err(AppError::from)?;

    Ok(())
}
