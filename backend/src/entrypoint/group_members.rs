use crate::entrypoint::AppError;
use crate::schema::group_members;
use crate::schema::groups;
pub use crate::state_server;

use anyhow::anyhow;
use axum::{
    extract::{Path, State},
    response::Json,
};

use crate::entrypoint::groups::get_group_id;
use chrono::NaiveDateTime;
use diesel::prelude::*;
use serde::Deserialize;
use serde::Serialize;
const MAX_MEMBER_NAME_SIZE : usize = 250;

#[derive(Queryable, Selectable, Debug, Serialize, Insertable, Deserialize, AsChangeset, Clone)]
#[diesel(table_name = crate::schema::group_members)]
#[diesel(check_for_backend(diesel::pg::Pg))] // Add backend check
pub struct GroupMember {
    pub uuid: String,
    pub nickname: String,
    pub modified_at: NaiveDateTime,
}

impl GroupMember {
    pub fn new(name: &str) -> Self {
        Self {
            uuid: uuid::Uuid::new_v4().to_string(),
            nickname: name.to_string(),
            modified_at: chrono::Utc::now().naive_utc(),
        }
    }
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
use diesel::r2d2::ConnectionManager;
use diesel::r2d2::PooledConnection;
pub fn get_all_members(
    token: &str,
    conn: &mut PooledConnection<ConnectionManager<PgConnection>>,
) -> Result<Vec<GroupMember>, anyhow::Error> {
    let results = groups::table
        .inner_join(group_members::table.on(groups::id.eq(group_members::group_id)))
        .filter(groups::token.eq(token))
        .select(GroupMember::as_select())
        .get_results::<GroupMember>(conn)?;

    Ok(results)
}

pub async fn handler_group_members(
    State(state_server): State<state_server::StateServer>,
    Path(token): Path<String>,
) -> Result<Json<Vec<GroupMember>>, AppError> {
    let mut conn = state_server.pool.get()?;

    let results = get_all_members(&token, &mut conn)?;

    Ok(Json(results))
}

pub fn get_uuid(
    in_group_id: i32,
    nickname: &str,
    conn: &mut PooledConnection<ConnectionManager<PgConnection>>,
) -> Result<String, anyhow::Error> {
    group_members::table
        .select(group_members::uuid)
        .filter(group_members::group_id.eq(in_group_id))
        .filter(group_members::nickname.eq(nickname))
        .get_result::<String>(conn)
        .map_err(|v| anyhow!(v))
}

pub fn add_group_members(
    group_id: i32,
    members: Vec<GroupMember>,
    conn: &mut PooledConnection<ConnectionManager<PgConnection>>,
) -> Result<(), anyhow::Error> {
    #[derive(Insertable, AsChangeset, Debug)]
    #[diesel(table_name = group_members)]
    pub struct NewGroupMember {
        uuid: String,
        group_id: i32,
        nickname: String,
        user_id: Option<i32>,
        modified_at: NaiveDateTime,
    }
    use unicode_truncate::UnicodeTruncateStr;

    for member in members {
        let new_member = NewGroupMember {
            group_id,
            modified_at: member.modified_at,
            nickname: member.nickname.as_str().unicode_truncate(MAX_MEMBER_NAME_SIZE).0.to_string(),
            user_id: None,
            uuid: member.uuid,
        };

        //check unicity
        if let Ok(_uuid) = get_uuid(group_id, &new_member.nickname, conn) {
            continue;
        }

        use diesel::query_dsl::methods::FilterDsl;
        use diesel::upsert::excluded;
        diesel::insert_into(group_members::table)
            .values(&new_member)
            .on_conflict(group_members::uuid)
            .do_update()
            .set((
                group_members::group_id.eq(group_id),
                group_members::modified_at.eq(&new_member.modified_at),
                group_members::nickname.eq(&new_member.nickname),
                group_members::uuid.eq(&new_member.uuid),
            ))
            .filter(group_members::modified_at.lt(excluded(group_members::modified_at)))
            .returning(GroupMember::as_returning())
            .execute(conn)?;
    }
    Ok(())
}

pub async fn handler_add_group_members(
    State(state_server): State<state_server::StateServer>,
    Path(token): Path<String>,
    Json(members): Json<Vec<GroupMember>>,
) -> Result<Json<Vec<GroupMember>>, AppError> {
    dbg!(&members);
    let mut conn = state_server.pool.get()?;
    let result = conn
        .transaction::<Vec<GroupMember>, anyhow::Error, _>(|conn| {
            let group_id = get_group_id(&token, conn)?;
            add_group_members(group_id, members, conn)?;

            get_all_members(&token, conn)
        })
        .map_err(AppError::from)?;

    Ok(Json(result))
}

use crate::entrypoint::transactions::{get_transaction_debt, get_transaction_paid_by};

use bigdecimal::num_traits::Zero;

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
        let group_id = get_group_id(&token, conn)?;
        for member in members {
            if let Ok(member_id) = get_member_id(group_id, member.uuid, conn) {
                let transaction_debts = get_transaction_debt(group_id, member_id, conn)?;
                let has_debt = transaction_debts
                    .iter()
                    .any(|(_id, number)| !number.is_zero());

                let transaction_paid = get_transaction_paid_by(group_id, member_id, conn)?;
                let has_paid = transaction_paid.iter().any(|tr| !tr.amount.is_zero());

                if !has_debt && !has_paid {
                    diesel::delete(group_members::table)
                        .filter(group_members::id.eq(member_id))
                        .filter(group_members::modified_at.lt(member.modified_at))
                        .execute(conn)?;
                }
            }
        }

        Ok(())
    })
    .map_err(AppError::from)?;

    Ok(())
}
