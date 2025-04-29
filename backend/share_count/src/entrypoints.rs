use crate::schema::group_members;
use crate::schema::groups;
use crate::schema::transaction_debts;
use crate::schema::transactions;
pub use crate::state_server;
use crate::Group;
use axum::http::StatusCode;
use axum::{
    extract::{Path, Query, State},
    response::{IntoResponse, Json, Response},
};
use chrono::NaiveDateTime;
use diesel::dsl::insert_into;
use diesel::prelude::*;
use std::collections::HashMap;

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

use serde::{Deserialize, Serialize};
#[derive(Deserialize, Serialize, Queryable)]
pub struct GroupResponse {
    name: String,
    currency: String,
    created_at: NaiveDateTime,
}

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

#[derive(Deserialize, Serialize, Queryable)]
pub struct TransactionDebt {
    id: i32,
    amount: i32,
    nickname: String,
}

#[derive(Deserialize, Serialize, Queryable)]
pub struct TransactionResponse {
    id: i32,
    description: String,
    currency: String,
    paid_by: String,
    created_at: NaiveDateTime,
    amount: i32,
    debtors: Vec<TransactionDebt>,
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
        .load::<(i32, String, NaiveDateTime, i32, String, String)>(&mut conn)?;

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
        .load::<(i32, i32, i32, String)>(&mut conn)?;

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
                value.debtors.push(TransactionDebt {
                    id: debt_id,
                    amount,
                    nickname,
                });
            }
        });

    let v = map.into_values().collect();

    Ok(Json(v)).map_err(AppError)
}

#[derive(Deserialize, Serialize, Queryable)]
pub struct TransactionQuery {
    description: String,
    currency: String,
    paid_by: i32,
    created_at: NaiveDateTime,
    amount: i32,
    debtors: Vec<TransactionDebt>,
}

#[derive(Debug, AsChangeset)]
#[diesel(table_name = crate::schema::transactions)]
pub struct TransactionChangeset {
    pub description: String,
    pub amount: i32,
    pub paid_by: i32,
    pub currency: String,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, AsChangeset)]
#[diesel(table_name = crate::schema::transaction_debts)]
pub struct TransactionDebtChangeset {
    pub amount: i32,
}

pub async fn handler_put_transaction(
    State(state_server): State<state_server::StateServer>,
    Path(transaction_id): Path<i32>,
    Json(payload): Json<TransactionQuery>,
) -> Result<(), AppError> {
    let mut conn = state_server.pool.get()?;
    let changeset = TransactionChangeset {
        description: payload.description,
        amount: payload.amount,
        paid_by: payload.paid_by,
        currency: payload.currency,
        created_at: payload.created_at,
    };

    diesel::update(transactions::table)
        .filter(transactions::id.eq(transaction_id))
        .set(&changeset)
        .execute(&mut conn)?;

    for debt in payload.debtors {
        diesel::update(transaction_debts::table)
            .filter(transaction_debts::id.eq(debt.id))
            .set(TransactionDebtChangeset {
                amount: debt.amount,
            })
            .execute(&mut conn)?;
    }

    Ok(()).map_err(AppError)
}
