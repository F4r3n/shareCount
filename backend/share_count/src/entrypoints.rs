use crate::schema::group_members;
use crate::schema::groups;
use crate::schema::transaction_debts;
use crate::schema::transactions;
pub use crate::state_server;
use axum::http::StatusCode;
use axum::{
    extract::{Path, State},
    response::{IntoResponse, Json, Response},
};
use bigdecimal::BigDecimal;
use chrono::NaiveDateTime;
use diesel::dsl::insert_into;
use diesel::prelude::*;
use std::collections::HashMap;

use uuid::Uuid;

pub struct AppError(anyhow::Error);

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

use serde::{Deserialize, Serialize};
#[derive(Deserialize, Serialize, Queryable, Debug)]
pub struct GroupResponse {
    pub name: String,
    pub currency: String,
    pub created_at: NaiveDateTime,
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
        .select((groups::name, groups::currency, groups::created_at))
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
        .select((groups::name, groups::currency, groups::created_at))
        .filter(groups::token.eq(token))
        .first::<GroupResponse>(&mut conn)?;
    Ok(Json(results)).map_err(AppError)
}

#[derive(Deserialize)]
pub struct CreateGroups {
    name: String,
    currency: String,
    nicknames: Vec<String>,
}

///groups
pub async fn handler_create_groups(
    State(state_server): State<state_server::StateServer>,
    Json(create): Json<CreateGroups>,
) -> Result<Json<String>, AppError> {
    println!("Create groups");
    let mut conn = state_server.pool.get()?;
    let token = Uuid::new_v4().to_string();

    #[derive(Queryable, PartialEq, Debug, Selectable, Identifiable, Serialize, Insertable)]
    struct Group {
        id: i32,
        name: String,
        currency: String,
        token: String,
        created_at: NaiveDateTime,
    }
    let token = conn
        .transaction::<String, anyhow::Error, _>(|conn| {
            let result = insert_into(groups::table)
                .values((
                    groups::dsl::name.eq(create.name),
                    groups::dsl::currency.eq(create.currency),
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

#[derive(Deserialize, Serialize, Queryable, Debug)]
pub struct TransactionDebtQuery {
    id: i32,
    amount: BigDecimal,
    nickname: String,
}

#[derive(Deserialize, Serialize, Queryable, Debug)]
pub struct TransactionDebtResponse {
    id: i32,
    amount: BigDecimal,
    nickname: String,
}

#[derive(Deserialize, Serialize, Queryable)]
pub struct TransactionResponse {
    id: i32,
    description: String,
    currency: String,
    paid_by: String,
    created_at: NaiveDateTime,
    amount: BigDecimal,
    debtors: Vec<TransactionDebtResponse>,
}

pub async fn handler_transactions(
    State(state_server): State<state_server::StateServer>,
    Path(token): Path<String>,
) -> Result<Json<Vec<TransactionResponse>>, AppError> {
    let mut conn = state_server.pool.get()?;

    let transaction_result = groups::table
        .inner_join(transactions::table.on(groups::id.eq(transactions::group_id)))
        .inner_join(group_members::table.on(transactions::paid_by.eq(group_members::id)))
        .select((
            transactions::id,
            transactions::description,
            transactions::created_at,
            transactions::amount,
            transactions::currency,
            group_members::nickname,
        ))
        .filter(groups::token.eq(&token))
        .load::<(i32, String, NaiveDateTime, BigDecimal, String, String)>(&mut conn)?;

    let debts = transaction_debts::table
        .inner_join(transactions::table.on(transaction_debts::transaction_id.eq(transactions::id)))
        .inner_join(
            group_members::table.on(transaction_debts::group_member_id.eq(group_members::id)),
        )
        .inner_join(groups::table.on(transactions::group_id.eq(groups::id)))
        .filter(groups::token.eq(token))
        .select((
            transaction_debts::id,
            transaction_debts::transaction_id,
            transaction_debts::amount,
            group_members::nickname,
        ))
        .load::<(i32, i32, BigDecimal, String)>(&mut conn)?;

    let mut map: HashMap<i32, TransactionResponse> = HashMap::new();
    transaction_result
        .into_iter()
        .for_each(|(id, desc, time, amount, currency, nickname)| {
            map.insert(
                id,
                TransactionResponse {
                    id,
                    description: desc,
                    paid_by: nickname,
                    created_at: time,
                    currency,
                    amount,
                    debtors: Vec::new(),
                },
            );
        });

    debts
        .into_iter()
        .for_each(|(debt_id, transaction_id, amount, nickname)| {
            if let Some(value) = map.get_mut(&transaction_id) {
                value.debtors.push(TransactionDebtResponse {
                    id: debt_id,
                    amount,
                    nickname,
                });
            }
        });

    let v = map.into_values().collect();

    Ok(Json(v)).map_err(AppError)
}

#[derive(Debug, AsChangeset, Insertable)]
#[diesel(table_name = crate::schema::transactions)]
pub struct TransactionChangeset {
    pub description: String,
    pub amount: BigDecimal,
    pub paid_by: i32,
    pub currency: String,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, AsChangeset)]
#[diesel(table_name = crate::schema::transaction_debts)]
pub struct TransactionDebtChangeset {
    pub amount: BigDecimal,
}

#[derive(Insertable, AsChangeset)]
#[diesel(table_name = transaction_debts)]
pub struct TransactionDebtUpsert {
    id: i32,
    transaction_id: i32,
    group_member_id: i32,
    amount: BigDecimal,
}

#[derive(Deserialize, Serialize, Queryable, Debug)]
pub struct TransactionQuery {
    id: i32,
    description: String,
    currency: String,
    paid_by: String,
    created_at: NaiveDateTime,
    amount: BigDecimal,
    debtors: Vec<TransactionDebtQuery>,
}

pub async fn handler_post_transaction(
    State(state_server): State<state_server::StateServer>,
    Path((token, transaction_id)): Path<(String, Option<i32>)>,
    Json(payload): Json<TransactionQuery>,
) -> Result<(), AppError> {
    dbg!(&payload);

    let mut conn = state_server.pool.get()?;
    conn.transaction::<_, anyhow::Error, _>(|conn| {
        let group_member_id = group_members::table
            .select(group_members::id)
            .inner_join(groups::table.on(groups::id.eq(group_members::id)))
            .filter(groups::token.eq(token))
            .get_result::<i32>(conn)?;

        let changeset = TransactionChangeset {
            description: payload.description,
            amount: payload.amount,
            paid_by: group_member_id,
            currency: payload.currency,
            created_at: payload.created_at,
        };

        let transaction_id = match transaction_id {
            Some(id) => {
                diesel::update(transactions::table)
                    .filter(transactions::id.eq(id))
                    .set(&changeset)
                    .execute(conn)?;
                id
            }
            None => diesel::insert_into(transactions::table)
                .values(&changeset)
                .returning(transactions::id)
                .get_result::<i32>(conn)?,
        };

        let debts = payload
            .debtors
            .into_iter()
            .map(|debt| {
                TransactionDebtUpsert {
                    transaction_id,
                    group_member_id,
                    amount: debt.amount,
                    // Include ID only for updates
                    id: debt.id,
                }
            })
            .collect::<Vec<_>>();

        diesel::insert_into(transaction_debts::table)
            .values(&debts)
            .on_conflict((transaction_debts::id, transaction_debts::transaction_id))
            .do_update()
            .set(transaction_debts::amount.eq(diesel::upsert::excluded(transaction_debts::amount)))
            .execute(conn)?;
        Ok(())
    })
    .map_err(AppError)?;

    Ok(()).map_err(AppError)
}

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
