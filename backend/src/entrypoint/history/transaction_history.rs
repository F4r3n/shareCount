use std::collections::HashMap;

use crate::entrypoint::group_members::GroupMemberNoDate;
use crate::entrypoint::transactions::TransactionDebtRow;
use crate::entrypoint::transactions::TransactionRow;
use crate::entrypoint::AppError;
use crate::schema::group_members;
use crate::schema::groups;
use crate::schema::transaction_debts_history;
use crate::schema::transactions_history;
pub use crate::state_server;

use axum::extract::Path;
use axum::extract::State;
use axum::Json;
use bigdecimal::BigDecimal;

use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel::r2d2::ConnectionManager;
use diesel::r2d2::PooledConnection;
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Queryable, Debug, PartialEq)]
pub struct TransactionResponseHistory {
    pub id: i32,
    pub uuid: String,
    pub description: String,
    pub currency_id: String,
    pub paid_by: GroupMemberNoDate,
    pub created_at: NaiveDateTime,
    pub modified_at: NaiveDateTime,
    pub amount: BigDecimal,
    pub exchange_rate: BigDecimal,
    pub debtors: Vec<TransactionDebtHistoryResponse>,
    pub operation: String,
}

#[derive(Deserialize, Serialize, Queryable, Debug, PartialEq)]
#[diesel(table_name = transaction_debts_history)]
pub struct TransactionDebtHistoryResponse {
    pub amount: BigDecimal,
    pub member: GroupMemberNoDate,
}

#[derive(Insertable, AsChangeset, Debug)]
#[diesel(table_name = transactions_history)]
pub struct TransactionHistory {
    uuid: String,
    group_id: i32,
    description: String,
    amount: BigDecimal,
    paid_by: i32,
    currency_id: String,
    exchange_rate: BigDecimal,
    created_at: NaiveDateTime,
    modified_at: NaiveDateTime,
    operation: String,
}

#[derive(Insertable, AsChangeset, Debug)]
#[diesel(table_name = transaction_debts_history)]
pub struct TransactionDebtHistory {
    group_member_id: i32,
    transaction_history_id: i32,
    amount: BigDecimal,
    operation: String,
}

pub fn add_transaction_history(
    transaction_row: &TransactionRow,
    transactions_debts: &[TransactionDebtRow],
    conn: &mut PooledConnection<ConnectionManager<PgConnection>>,
) -> Result<(), anyhow::Error> {
    let has_transaction = transactions_history::table
        .select(transactions_history::uuid)
        .filter(transactions_history::uuid.eq(&transaction_row.uuid))
        .execute(conn)?;
    let operation_type = if has_transaction > 0 {
        "UPDATE"
    } else {
        "INSERT"
    };

    _add_transaction_history(transaction_row, transactions_debts, conn, operation_type)
}

pub fn delete_transaction_history(
    transaction_id: i32,
    conn: &mut PooledConnection<ConnectionManager<PgConnection>>,
) {
    use crate::schema::{transactions, transactions_history};

    // First fetch the transaction being deleted
    let tx = transactions::table
        .find(transaction_id)
        .first::<TransactionRow>(conn);

    if let Ok(tx) = tx {
        let new_transaction_history = TransactionHistory {
            amount: tx.amount.clone(),
            created_at: tx.created_at,
            currency_id: tx.currency_id.clone(),
            description: tx.description.clone(),
            exchange_rate: tx.exchange_rate.clone(),
            group_id: tx.group_id,
            modified_at: tx.modified_at,
            paid_by: tx.paid_by,
            uuid: tx.uuid,
            operation: "DELETE".to_string(),
        };

        // Insert into history with all fields + operation
        let _result = diesel::insert_into(transactions_history::table)
            .values(&new_transaction_history)
            .execute(conn);
    }
}

fn _add_transaction_history(
    transaction_row: &TransactionRow,
    transactions_debts: &[TransactionDebtRow],
    conn: &mut PooledConnection<ConnectionManager<PgConnection>>,
    operation_type: &str,
) -> Result<(), anyhow::Error> {
    let new_transaction_history = TransactionHistory {
        amount: transaction_row.amount.clone(),
        created_at: transaction_row.created_at,
        currency_id: transaction_row.currency_id.clone(),
        description: transaction_row.description.clone(),
        exchange_rate: transaction_row.exchange_rate.clone(),
        group_id: transaction_row.group_id,
        modified_at: transaction_row.modified_at,
        paid_by: transaction_row.paid_by,
        uuid: transaction_row.uuid.clone(),
        operation: operation_type.to_string(),
    };

    let transaction_history_id = diesel::insert_into(transactions_history::table)
        .values(new_transaction_history)
        .returning(transactions_history::id)
        .get_result::<i32>(conn)?;

    for debt in transactions_debts {
        let new_history_debt = TransactionDebtHistory {
            amount: debt.amount.clone(),
            group_member_id: debt.group_member_id,
            operation: operation_type.to_string(),
            transaction_history_id: transaction_history_id,
        };
        diesel::insert_into(transaction_debts_history::table)
            .values(new_history_debt)
            .execute(conn)?;
    }

    Ok(())
}

pub async fn handler_get_transactions_history(
    State(state_server): State<state_server::StateServer>,
    Path(token): Path<String>,
) -> Result<Json<Vec<TransactionResponseHistory>>, AppError> {
    let mut conn = state_server.pool.get()?;

    let transaction_result = groups::table
        .inner_join(transactions_history::table)
        .inner_join(group_members::table.on(group_members::id.eq(transactions_history::paid_by)))
        .select((
            transactions_history::id,
            transactions_history::uuid,
            transactions_history::description,
            transactions_history::created_at,
            transactions_history::amount,
            transactions_history::exchange_rate,
            transactions_history::modified_at,
            transactions_history::currency_id,
            group_members::nickname,
            group_members::uuid,
            transactions_history::operation,
        ))
        .filter(groups::token.eq(&token))
        .load::<(
            i32,
            String,
            String,
            NaiveDateTime,
            BigDecimal,
            BigDecimal,
            NaiveDateTime,
            String,
            String,
            String,
            String,
        )>(&mut conn)?;

    let debts = transaction_debts_history::table
        .inner_join(transactions_history::table)
        .inner_join(group_members::table)
        .inner_join(groups::table.on(transactions_history::group_id.eq(groups::id)))
        .filter(groups::token.eq(token))
        .select((
            transaction_debts_history::transaction_history_id,
            transaction_debts_history::amount,
            group_members::nickname,
            group_members::uuid,
        ))
        .load::<(i32, BigDecimal, String, String)>(&mut conn)?;

    let mut map: HashMap<i32, TransactionResponseHistory> = HashMap::new();
    transaction_result.into_iter().for_each(
        |(
            id,
            uuid,
            desc,
            time,
            amount,
            exchange_rate,
            modified_at,
            currency_id,
            nickname,
            member_uuid,
            operation,
        )| {
            map.insert(
                id,
                TransactionResponseHistory {
                    id,
                    uuid,
                    description: desc,
                    modified_at,
                    paid_by: GroupMemberNoDate {
                        uuid: member_uuid,
                        nickname,
                    },
                    created_at: time,
                    currency_id,
                    amount,
                    exchange_rate,
                    debtors: Vec::new(),
                    operation,
                },
            );
        },
    );

    debts
        .into_iter()
        .for_each(|(transaction_id, amount, nickname, member_uuid)| {
            if let Some(value) = map.get_mut(&transaction_id) {
                value.debtors.push(TransactionDebtHistoryResponse {
                    amount,
                    member: GroupMemberNoDate {
                        uuid: member_uuid,
                        nickname,
                    },
                });
            }
        });

    let mut v = map
        .into_values()
        .collect::<Vec<TransactionResponseHistory>>();
    v.sort_by(|a: &TransactionResponseHistory, b: &TransactionResponseHistory| b.id.cmp(&a.id));
    Ok(Json(v))
}

pub async fn handler_get_transaction_history(
    State(state_server): State<state_server::StateServer>,
    Path((token, transaction_uuid)): Path<(String, String)>,
) -> Result<Json<TransactionResponseHistory>, AppError> {
    let mut conn = state_server.pool.get()?;

    let (
        id,
        uuid,
        description,
        created_at,
        amount,
        exchange_rate,
        modified_at,
        currency_id,
        nickname,
        member_uuid,
        operation,
    ) = groups::table
        .inner_join(transactions_history::table)
        .inner_join(group_members::table.on(group_members::id.eq(transactions_history::paid_by)))
        .select((
            transactions_history::id,
            transactions_history::uuid,
            transactions_history::description,
            transactions_history::created_at,
            transactions_history::amount,
            transactions_history::exchange_rate,
            transactions_history::modified_at,
            transactions_history::currency_id,
            group_members::nickname,
            group_members::uuid,
            transactions_history::operation,
        ))
        .filter(transactions_history::uuid.eq(&transaction_uuid))
        .filter(groups::token.eq(&token))
        .get_result::<(
            i32,
            String,
            String,
            NaiveDateTime,
            BigDecimal,
            BigDecimal,
            NaiveDateTime,
            String,
            String,
            String,
            String,
        )>(&mut conn)?;

    let mut transaction_response = TransactionResponseHistory {
        id,
        amount,
        created_at,
        currency_id,
        description,
        debtors: Vec::new(),
        exchange_rate,
        uuid,
        modified_at,
        paid_by: GroupMemberNoDate {
            uuid: member_uuid,
            nickname,
        },
        operation,
    };

    let debts = transaction_debts_history::table
        .inner_join(transactions_history::table)
        .inner_join(group_members::table)
        .inner_join(groups::table.on(transactions_history::group_id.eq(groups::id)))
        .filter(groups::token.eq(token))
        .filter(transactions_history::uuid.eq(&transaction_uuid))
        .select((
            transaction_debts_history::amount,
            group_members::uuid,
            group_members::nickname,
        ))
        .load::<(BigDecimal, String, String)>(&mut conn)?;

    debts
        .into_iter()
        .for_each(|(amount, member_uuid, nickname)| {
            transaction_response
                .debtors
                .push(TransactionDebtHistoryResponse {
                    amount,
                    member: GroupMemberNoDate {
                        uuid: member_uuid,
                        nickname,
                    },
                });
        });

    Ok(Json(transaction_response))
}
