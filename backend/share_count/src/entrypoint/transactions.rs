use crate::entrypoint::group_members::GroupMember;
use crate::entrypoint::AppError;
use crate::schema::group_members;
use crate::schema::groups;
use crate::schema::transaction_debts;
use crate::schema::transactions;
pub use crate::state_server;
use axum::http::StatusCode;
use axum::{
    extract::{Path, State},
    response::Json,
};
use bigdecimal::BigDecimal;
use bigdecimal::Zero;
use chrono::NaiveDateTime;
use diesel::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Deserialize, Serialize, Queryable, Debug)]
pub struct TransactionDebtQuery {
    id: Option<i32>,
    amount: BigDecimal,
    member: GroupMember,
}

#[derive(Deserialize, Serialize, Queryable, Debug)]
pub struct TransactionDebtResponse {
    id: i32,
    amount: BigDecimal,
    member: GroupMember,
}

#[derive(Deserialize, Serialize, Queryable)]
pub struct TransactionResponse {
    pub id: i32,
    pub description: String,
    pub currency_id: String,
    pub paid_by: GroupMember,
    pub created_at: NaiveDateTime,
    pub amount: BigDecimal,
    pub exchange_rate: BigDecimal,
    pub debtors: Vec<TransactionDebtResponse>,
}

pub async fn handler_transactions(
    State(state_server): State<state_server::StateServer>,
    Path(token): Path<String>,
) -> Result<Json<Vec<TransactionResponse>>, AppError> {
    let mut conn = state_server.pool.get()?;

    let transaction_result = groups::table
        .inner_join(transactions::table)
        .inner_join(group_members::table)
        .select((
            transactions::id,
            transactions::description,
            transactions::created_at,
            transactions::amount,
            transactions::exchange_rate,
            transactions::currency_id,
            group_members::id,
            group_members::nickname,
        ))
        .filter(groups::token.eq(&token))
        .load::<(
            i32,
            String,
            NaiveDateTime,
            BigDecimal,
            BigDecimal,
            String,
            i32,
            String,
        )>(&mut conn)?;

    let debts = transaction_debts::table
        .inner_join(transactions::table)
        .inner_join(group_members::table)
        .inner_join(groups::table.on(transactions::group_id.eq(groups::id)))
        .filter(groups::token.eq(token))
        .select((
            transaction_debts::id,
            transaction_debts::transaction_id,
            transaction_debts::amount,
            group_members::id,
            group_members::nickname,
        ))
        .load::<(i32, i32, BigDecimal, i32, String)>(&mut conn)?;

    let mut map: HashMap<i32, TransactionResponse> = HashMap::new();
    transaction_result.into_iter().for_each(
        |(id, desc, time, amount, exchange_rate, currency_id, member_id, nickname)| {
            map.insert(
                id,
                TransactionResponse {
                    id,
                    description: desc,
                    paid_by: GroupMember {
                        id: member_id,
                        nickname,
                    },
                    created_at: time,
                    currency_id,
                    amount,
                    exchange_rate,
                    debtors: Vec::new(),
                },
            );
        },
    );

    debts
        .into_iter()
        .for_each(|(debt_id, transaction_id, amount, member_id, nickname)| {
            if let Some(value) = map.get_mut(&transaction_id) {
                value.debtors.push(TransactionDebtResponse {
                    id: debt_id,
                    amount,
                    member: GroupMember {
                        id: member_id,
                        nickname,
                    },
                });
            }
        });

    let v = map.into_values().collect();

    Ok(Json(v))
}

pub async fn handler_get_transaction(
    State(state_server): State<state_server::StateServer>,
    Path((token, transaction_id)): Path<(String, i32)>,
) -> Result<Json<TransactionResponse>, AppError> {
    let mut conn = state_server.pool.get()?;

    let (id, description, created_at, amount, exchange_rate, currency_id, member_id, nickname) =
        groups::table
            .inner_join(transactions::table)
            .inner_join(group_members::table)
            .select((
                transactions::id,
                transactions::description,
                transactions::created_at,
                transactions::amount,
                transactions::exchange_rate,
                transactions::currency_id,
                group_members::id,
                group_members::nickname,
            ))
            .filter(groups::token.eq(&token))
            .filter(transactions::id.eq(transaction_id))
            .get_result::<(
                i32,
                String,
                NaiveDateTime,
                BigDecimal,
                BigDecimal,
                String,
                i32,
                String,
            )>(&mut conn)?;
    let mut transaction_response = TransactionResponse {
        amount,
        created_at,
        currency_id,
        description,
        debtors: Vec::new(),
        exchange_rate,
        id,
        paid_by: GroupMember {
            id: member_id,
            nickname,
        },
    };

    let debts = transaction_debts::table
        .inner_join(transactions::table)
        .inner_join(group_members::table)
        .inner_join(groups::table.on(transactions::group_id.eq(groups::id)))
        .filter(groups::token.eq(token))
        .filter(transactions::id.eq(transaction_id))
        .select((
            transaction_debts::id,
            transaction_debts::amount,
            group_members::id,
            group_members::nickname,
        ))
        .load::<(i32, BigDecimal, i32, String)>(&mut conn)?;

    debts
        .into_iter()
        .for_each(|(debt_id, amount, member_id, nickname)| {
            transaction_response.debtors.push(TransactionDebtResponse {
                id: debt_id,
                amount,
                member: GroupMember {
                    id: member_id,
                    nickname,
                },
            });
        });

    Ok(Json(transaction_response))
}

#[derive(Debug, AsChangeset, Insertable)]
#[diesel(table_name = crate::schema::transactions)]
pub struct TransactionChangeset {
    pub description: String,
    pub amount: BigDecimal,
    pub paid_by: i32,
    pub currency_id: String,
    pub exchange_rate: BigDecimal,
    pub created_at: NaiveDateTime,
    pub group_id: i32,
}

#[derive(Debug, AsChangeset)]
#[diesel(table_name = crate::schema::transaction_debts)]
pub struct TransactionDebtChangeset {
    pub amount: BigDecimal,
}

#[derive(Insertable, AsChangeset, Clone, Debug)]
#[diesel(table_name = transaction_debts)]
pub struct TransactionDebtUpsert {
    id: Option<i32>,
    transaction_id: i32,
    group_member_id: i32,
    amount: BigDecimal,
}

#[derive(Deserialize, Serialize, Queryable, Debug)]
pub struct TransactionQuery {
    id: i32,
    description: String,
    currency_id: String,
    paid_by: GroupMember,
    created_at: NaiveDateTime,
    exchange_rate: BigDecimal,
    amount: BigDecimal,
    debtors: Vec<TransactionDebtQuery>,
}

fn check_transaction_validity(transaction: &TransactionQuery) -> Result<(), String> {
    if transaction.amount.le(&BigDecimal::zero()) {
        return Err("An amount should be strictly positive".to_string());
    }

    for debt in &transaction.debtors {
        if debt.amount.lt(&BigDecimal::zero()) {
            return Err("An amount cannot be negative".to_string());
        }
    }
    let debt_amount = transaction
        .debtors
        .iter()
        .fold(BigDecimal::zero(), |acc, x| acc + &x.amount);
    if debt_amount == transaction.amount {
        Ok(())
    } else {
        Err(format!(
            "The amount of debtors {} are not equivalent to the transaction {}",
            debt_amount, transaction.amount
        ))
    }
}

pub fn modify_create_transaction(
    token_id: String,
    transaction: TransactionQuery,
    transaction_id: Option<i32>,
    conn: &mut PooledConnection<ConnectionManager<PgConnection>>,
) -> Result<i32, anyhow::Error> {
    let group_id = get_group_id(token_id, conn)?;
    let changeset = TransactionChangeset {
        description: transaction.description,
        amount: transaction.amount,
        paid_by: transaction.paid_by.id,
        currency_id: transaction.currency_id,
        exchange_rate: transaction.exchange_rate,
        created_at: transaction.created_at,
        group_id,
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

    let debts = transaction
        .debtors
        .into_iter()
        .map(|debt| {
            TransactionDebtUpsert {
                transaction_id,
                group_member_id: debt.member.id,
                amount: debt.amount,
                // Include ID only for updates
                id: debt.id, //can be optional,
            }
        })
        .collect::<Vec<_>>();

    diesel::insert_into(transaction_debts::table)
        .values(&debts)
        .on_conflict((
            transaction_debts::transaction_id,
            transaction_debts::group_member_id,
        ))
        .do_update()
        .set(transaction_debts::amount.eq(diesel::upsert::excluded(transaction_debts::amount)))
        .execute(conn)?;

    Ok(transaction_id)
}

pub async fn handler_modify_transaction(
    State(state_server): State<state_server::StateServer>,
    Path((token, transaction_id)): Path<(String, i32)>,
    Json(payload): Json<TransactionQuery>,
) -> Result<(), AppError> {
    dbg!("Modify transaction");
    let mut conn = state_server.pool.get()?;
    conn.transaction::<_, anyhow::Error, _>(|conn| {
        modify_create_transaction(token, payload, Some(transaction_id), conn)
    })
    .map_err(AppError::from)?;

    Ok(())
}

#[derive(Deserialize, Serialize, Queryable, Debug)]
pub struct TransactionIDResponse {
    pub id: i32,
}

pub async fn handler_create_transaction(
    State(state_server): State<state_server::StateServer>,
    Path(token): Path<String>,
    Json(payload): Json<TransactionQuery>,
) -> Result<Json<TransactionIDResponse>, AppError<String>> {
    check_transaction_validity(&payload).map_err(|v| AppError {
        error: anyhow::anyhow!(StatusCode::INTERNAL_SERVER_ERROR),
        content: Some(v),
    })?;

    let mut conn = state_server.pool.get()?;
    let id = conn
        .transaction::<i32, anyhow::Error, _>(|conn| {
            modify_create_transaction(token, payload, None, conn)
        })
        .map_err(AppError::from)?;

    Ok(Json(TransactionIDResponse { id }))
}

pub async fn handler_delete_transaction(
    State(state_server): State<state_server::StateServer>,
    Path((token, transaction_id)): Path<(String, i32)>,
) -> Result<(), AppError> {
    let mut conn = state_server.pool.get()?;
    conn.transaction::<_, anyhow::Error, _>(|conn| {
        let groud_id = get_group_id(token, conn)?;

        diesel::delete(transactions::table)
            .filter(transactions::group_id.eq(groud_id))
            .filter(transactions::id.eq(transaction_id))
            .execute(conn)?;

        Ok(())
    })
    .map_err(AppError::from)?;

    Ok(())
}

#[derive(Deserialize, Serialize, Queryable, Debug)]
pub struct TransactionPaidByResponse {
    pub id: i32,
    pub description: String,
    pub currency_id: String,
    pub created_at: NaiveDateTime,
    pub amount: BigDecimal,
}

use diesel::r2d2::ConnectionManager;
use diesel::r2d2::PooledConnection;

use super::groups::get_group_id;
pub fn get_transaction_paid_by(
    group_id: i32,
    group_member_id: i32,
    conn: &mut PooledConnection<ConnectionManager<PgConnection>>,
) -> Result<Vec<TransactionPaidByResponse>, anyhow::Error> {
    let transaction_result = transactions::table
        .inner_join(groups::table)
        .select((
            transactions::id,
            transactions::description,
            transactions::currency_id,
            transactions::created_at,
            transactions::amount,
        ))
        .filter(groups::id.eq(group_id))
        .filter(transactions::paid_by.eq(group_member_id))
        .load::<TransactionPaidByResponse>(conn)?;
    Ok(transaction_result)
}

pub fn get_transaction_debt(
    group_id: i32,
    group_member_id: i32,
    conn: &mut PooledConnection<ConnectionManager<PgConnection>>,
) -> Result<Vec<(i32, BigDecimal)>, anyhow::Error> {
    let transaction_result = transaction_debts::table
        .inner_join(group_members::table)
        .inner_join(groups::table.on(group_members::group_id.eq(groups::id)))
        .select((transaction_debts::id, transaction_debts::amount))
        .filter(transaction_debts::group_member_id.eq(group_member_id))
        .filter(groups::id.eq(group_id))
        .load::<(i32, BigDecimal)>(conn)?;
    Ok(transaction_result)
}
