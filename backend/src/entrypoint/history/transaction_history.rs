use std::collections::HashMap;

use crate::entrypoint::group_members::GroupMemberNoDate;
use crate::entrypoint::transactions::TransactionDebtResponse;
use crate::entrypoint::transactions::TransactionDebtRow;
use crate::entrypoint::transactions::TransactionResponse;
use crate::entrypoint::transactions::TransactionRow;
use crate::entrypoint::AppError;
use crate::schema::group_members;
use crate::schema::groups;
use crate::schema::transaction_debts_history;
use crate::schema::transactions;
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

#[derive(Insertable, AsChangeset, Debug)]
#[diesel(table_name = transactions_history)]
pub struct TransactionHistory {
    transaction_id: i32,
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
    transaction_debt_id: i32,
    amount: BigDecimal,
    operation: String,
}

pub fn add_transaction_history(
    transaction_row: &TransactionRow,
    transactions_debts: &[TransactionDebtRow],
    conn: &mut PooledConnection<ConnectionManager<PgConnection>>,
) -> Result<(), anyhow::Error> {
    let has_transaction = transactions_history::table
        .select(transactions_history::transaction_id)
        .get_result::<i32>(conn)
        .optional()?;
    let operation_type = if has_transaction.is_some() {
        "UPDATE"
    } else {
        "INSERT"
    };

    _add_transaction_history(transaction_row, transactions_debts, conn, operation_type)
}

pub fn delete_transaction_history(
    transaction_id: i32,
    conn: &mut PooledConnection<ConnectionManager<PgConnection>>,
) -> Result<(), anyhow::Error> {
    diesel::insert_into(transactions_history::table)
        .values((
            transactions_history::transaction_id.eq(transaction_id),
            transactions_history::operation.eq("DELETE"),
        ))
        .execute(conn)?;

    Ok(())
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
        transaction_id: transaction_row.id,
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
            transaction_debt_id: debt.id,
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
) -> Result<Json<Vec<TransactionResponse>>, AppError> {
    let mut conn = state_server.pool.get()?;

    let transaction_result = groups::table
        .inner_join(transactions_history::table)
        .inner_join(group_members::table.on(group_members::id.eq(transactions_history::paid_by)))
        .inner_join(transactions::table.on(transactions::id.eq(transactions_history::id)))
        .select((
            transactions_history::id,
            transactions::uuid,
            transactions_history::description,
            transactions_history::created_at,
            transactions_history::amount,
            transactions_history::exchange_rate,
            transactions_history::modified_at,
            transactions_history::currency_id,
            group_members::nickname,
            group_members::uuid,
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
        )>(&mut conn)?;

    let debts = transaction_debts_history::table
        .inner_join(transactions_history::table)
        .inner_join(group_members::table)
        .inner_join(groups::table.on(transactions_history::group_id.eq(groups::id)))
        .filter(groups::token.eq(token))
        .select((
            transaction_debts_history::id,
            transaction_debts_history::transaction_history_id,
            transaction_debts_history::amount,
            group_members::nickname,
            group_members::uuid,
        ))
        .load::<(i32, i32, BigDecimal, String, String)>(&mut conn)?;

    let mut map: HashMap<i32, TransactionResponse> = HashMap::new();
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
        )| {
            map.insert(
                id,
                TransactionResponse {
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
                },
            );
        },
    );

    debts
        .into_iter()
        .for_each(|(debt_id, transaction_id, amount, nickname, member_uuid)| {
            if let Some(value) = map.get_mut(&transaction_id) {
                value.debtors.push(TransactionDebtResponse {
                    id: debt_id,
                    amount,
                    member: GroupMemberNoDate {
                        uuid: member_uuid,
                        nickname,
                    },
                });
            }
        });

    let mut v = map.into_values().collect::<Vec<TransactionResponse>>();
    v.sort_by(|a: &TransactionResponse, b: &TransactionResponse| a.created_at.cmp(&b.created_at));
    Ok(Json(v))
}
