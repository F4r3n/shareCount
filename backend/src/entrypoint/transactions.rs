use crate::entrypoint::group_members::get_member_id;
use crate::entrypoint::group_members::GroupMemberNoDate;
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

use bigdecimal::One;
use bigdecimal::Zero;
use chrono::NaiveDateTime;
use diesel::prelude::*;
use diesel::upsert::excluded;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Deserialize, Serialize, Queryable, Debug)]
pub struct TransactionDebtQuery {
    id: Option<i32>,
    amount: BigDecimal,
    member: GroupMemberNoDate,
}

#[derive(Deserialize, Serialize, Queryable, Debug)]
pub struct TransactionDebtResponse {
    id: i32,
    amount: BigDecimal,
    member: GroupMemberNoDate,
}

#[derive(Deserialize, Serialize, Queryable, Debug)]
pub struct TransactionResponse {
    pub uuid: String,
    pub description: String,
    pub currency_id: String,
    pub paid_by: GroupMemberNoDate,
    pub created_at: NaiveDateTime,
    pub modified_at: NaiveDateTime,
    pub amount: BigDecimal,
    pub exchange_rate: BigDecimal,
    pub debtors: Vec<TransactionDebtResponse>,
}

pub async fn handler_get_all_transactions(
    State(state_server): State<state_server::StateServer>,
    Path(token): Path<String>,
) -> Result<Json<Vec<TransactionResponse>>, AppError> {
    let mut conn = state_server.pool.get()?;

    let transaction_result = groups::table
        .inner_join(transactions::table)
        .inner_join(group_members::table.on(group_members::id.eq(transactions::paid_by)))
        .select((
            transactions::id,
            transactions::uuid,
            transactions::description,
            transactions::created_at,
            transactions::amount,
            transactions::exchange_rate,
            transactions::modified_at,
            transactions::currency_id,
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

    let debts = transaction_debts::table
        .inner_join(transactions::table)
        .inner_join(group_members::table)
        .inner_join(groups::table.on(transactions::group_id.eq(groups::id)))
        .filter(groups::token.eq(token))
        .select((
            transaction_debts::id,
            transaction_debts::transaction_id,
            transaction_debts::amount,
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

pub async fn handler_get_transaction(
    State(state_server): State<state_server::StateServer>,
    Path((token, transaction_uuid)): Path<(String, String)>,
) -> Result<Json<TransactionResponse>, AppError> {
    let mut conn = state_server.pool.get()?;

    let (
        uuid,
        description,
        created_at,
        amount,
        exchange_rate,
        modified_at,
        currency_id,
        nickname,
        member_uuid,
    ) = groups::table
        .inner_join(transactions::table)
        .inner_join(group_members::table)
        .select((
            transactions::uuid,
            transactions::description,
            transactions::created_at,
            transactions::amount,
            transactions::exchange_rate,
            transactions::modified_at,
            transactions::currency_id,
            group_members::nickname,
            group_members::uuid,
        ))
        .filter(groups::token.eq(&token))
        .filter(transactions::uuid.eq(&transaction_uuid))
        .get_result::<(
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
    let mut transaction_response = TransactionResponse {
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
    };

    let debts = transaction_debts::table
        .inner_join(transactions::table)
        .inner_join(group_members::table)
        .inner_join(groups::table.on(transactions::group_id.eq(groups::id)))
        .filter(groups::token.eq(token))
        .filter(transactions::uuid.eq(&transaction_uuid))
        .select((
            transaction_debts::id,
            transaction_debts::amount,
            group_members::uuid,
            group_members::nickname,
        ))
        .load::<(i32, BigDecimal, String, String)>(&mut conn)?;

    debts
        .into_iter()
        .for_each(|(debt_id, amount, member_uuid, nickname)| {
            transaction_response.debtors.push(TransactionDebtResponse {
                id: debt_id,
                amount,
                member: GroupMemberNoDate {
                    uuid: member_uuid,
                    nickname,
                },
            });
        });

    Ok(Json(transaction_response))
}

#[derive(Debug, AsChangeset, Insertable)]
#[diesel(table_name = crate::schema::transactions)]
pub struct TransactionChangeset {
    pub uuid: String,
    pub description: String,
    pub amount: BigDecimal,
    pub paid_by: i32,
    pub currency_id: String,
    pub exchange_rate: BigDecimal,
    pub created_at: NaiveDateTime,
    pub modified_at: NaiveDateTime,
    pub group_id: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TransactionDelete {
    pub uuid: String,
    pub modified_at: NaiveDateTime,
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
    uuid: String,
    description: String,
    currency_id: String,
    paid_by: GroupMemberNoDate,
    created_at: NaiveDateTime,
    exchange_rate: BigDecimal,
    amount: BigDecimal,
    modified_at: NaiveDateTime,
    debtors: Vec<TransactionDebtQuery>,
}
use {bigdecimal::FromPrimitive, chrono::NaiveDate, std::str::FromStr};

impl TransactionQuery {
    pub fn new(
        uuid: &uuid::Uuid,
        description: &str,
        paid_by: &GroupMemberNoDate,
        amount: &str,
    ) -> Self {
        Self {
            uuid: uuid.to_string(),
            description: description.to_string(),
            paid_by: paid_by.clone(),
            amount: BigDecimal::from_str(amount).unwrap_or(BigDecimal::zero()),
            debtors: vec![],
            created_at: NaiveDate::from_ymd_opt(2016, 7, 8)
                .unwrap_or_default()
                .and_hms_opt(9, 10, 11)
                .unwrap_or_default(),
            currency_id: "USD".to_string(),
            modified_at: chrono::Utc::now().naive_utc(),
            exchange_rate: BigDecimal::from_i32(1).unwrap_or(BigDecimal::one()),
        }
    }

    pub fn add_debtor(&mut self, member: &GroupMemberNoDate, amount: &str) {
        self.modified_at = chrono::Utc::now().naive_utc();
        self.debtors.push(TransactionDebtQuery {
            id: None,
            amount: BigDecimal::from_str(amount).unwrap_or(BigDecimal::zero()),
            member: member.clone(),
        });
    }

    pub fn set_description(&mut self, description: &str) {
        self.modified_at = chrono::Utc::now().naive_utc();
        self.description = description.to_string();
    }

    pub fn set_amount(&mut self, amount: &str) {
        self.modified_at = chrono::Utc::now().naive_utc();
        self.amount = BigDecimal::from_str(amount).unwrap_or_default();
    }

    pub fn set_time(&mut self, time: &NaiveDateTime) {
        self.modified_at = *time;
    }

    pub fn get_uuid(&self) -> String {
        self.uuid.clone()
    }

    pub fn get_description(&self) -> String {
        self.description.clone()
    }
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
    conn: &mut PooledConnection<ConnectionManager<PgConnection>>,
) -> Result<(), anyhow::Error> {
    let group_id = get_group_id(&token_id, conn)?;
    let member_id = get_member_id(group_id, transaction.paid_by.uuid, conn)?;
    let changeset = TransactionChangeset {
        uuid: transaction.uuid,
        description: transaction.description,
        amount: transaction.amount,
        paid_by: member_id,
        currency_id: transaction.currency_id,
        exchange_rate: transaction.exchange_rate,
        created_at: transaction.created_at,
        modified_at: transaction.modified_at,
        group_id,
    };
    use diesel::query_dsl::methods::FilterDsl;
    let transaction_id = diesel::insert_into(transactions::table)
        .values(&changeset)
        .on_conflict(transactions::uuid)
        .do_update()
        .set(&changeset)
        .filter(transactions::modified_at.lt(excluded(transactions::modified_at)))
        .returning(transactions::id)
        .get_result::<i32>(conn)?;

    let debts = transaction
        .debtors
        .into_iter()
        .map(|debt| {
            let id: Option<i32> = if debt.id.is_some_and(|v| v > 0) {
                debt.id
            } else {
                None
            };
            let member_id = get_member_id(group_id, debt.member.uuid, conn);

            TransactionDebtUpsert {
                transaction_id,
                group_member_id: member_id.unwrap_or(0),
                amount: debt.amount,
                // Include ID only for updates
                id, //can be optional,
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

    Ok(())
}

pub async fn handler_modify_transaction(
    State(state_server): State<state_server::StateServer>,
    Path(token): Path<String>,
    Json(payload): Json<TransactionQuery>,
) -> Result<(), AppError<String>> {
    check_transaction_validity(&payload).map_err(|v| AppError {
        content: Some(v),
        error: anyhow::anyhow!(StatusCode::INTERNAL_SERVER_ERROR),
    })?;

    let mut conn = state_server.pool.get()?;
    conn.transaction::<_, anyhow::Error, _>(|conn| modify_create_transaction(token, payload, conn))
        .map_err(AppError::from)?;

    Ok(())
}

#[derive(Deserialize, Serialize, Queryable, Debug)]
pub struct TransactionIDResponse {
    pub id: i32,
}

pub async fn handler_delete_transaction(
    State(state_server): State<state_server::StateServer>,
    Path(token): Path<String>,
    Json(transaction): Json<TransactionDelete>,
) -> Result<(), AppError> {
    let mut conn = state_server.pool.get()?;
    conn.transaction::<_, anyhow::Error, _>(|conn| {
        let groud_id = get_group_id(&token, conn)?;

        diesel::delete(transactions::table)
            .filter(transactions::group_id.eq(groud_id))
            .filter(transactions::uuid.eq(transaction.uuid))
            .filter(transactions::modified_at.lt(transaction.modified_at))
            .execute(conn)?;

        Ok(())
    })
    .map_err(AppError::from)?;

    Ok(())
}

#[derive(Deserialize, Serialize, Queryable, Debug, Selectable)]
#[diesel(table_name = crate::schema::transactions)]
#[diesel(check_for_backend(diesel::pg::Pg))] // Add backend check
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
        .select(TransactionPaidByResponse::as_select())
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
