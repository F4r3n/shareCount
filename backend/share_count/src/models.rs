use chrono::NaiveDateTime;
use diesel::prelude::*;
use serde::Serialize;

#[derive(Queryable, Identifiable, Selectable, Debug, Serialize, Insertable)]
#[diesel(table_name = crate::schema::users)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct User {
    pub id: i32,
    pub name: String,
    pub email: String,
    pub password_hash: String,
    pub created_at: NaiveDateTime,
}

#[derive(Queryable, PartialEq, Debug, Selectable, Identifiable, Serialize, Insertable)]
#[diesel(table_name = crate::schema::groups)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct Group {
    pub id: i32,
    pub name: String,
    pub currency: String,
    pub token: String,
    pub created_at: NaiveDateTime,
}

#[derive(Queryable, Identifiable, Selectable, Associations, Debug, Serialize, Insertable)]
#[diesel(belongs_to(Group))]
#[diesel(belongs_to(User))]
#[diesel(table_name = crate::schema::group_members)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct GroupMember {
    pub id: i32,
    pub group_id: i32,
    pub nickname: String,
    pub user_id: Option<i32>,
}

#[derive(Queryable, Identifiable, Selectable, Associations, Debug, Serialize, Insertable)]
#[diesel(belongs_to(Group))]
#[diesel(belongs_to(GroupMember, foreign_key = paid_by))]
#[diesel(table_name = crate::schema::transactions)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct Transaction {
    pub id: i32,
    pub group_id: i32,
    pub description: Option<String>,
    pub amount: i32,
    pub paid_by: i32,
    pub created_at: NaiveDateTime,
}

#[derive(Queryable, Identifiable, Selectable, Associations, Debug, Serialize, Insertable)]
#[diesel(belongs_to(Transaction))]
#[diesel(belongs_to(GroupMember, foreign_key = group_member_id))]
#[diesel(table_name = crate::schema::transaction_debts)]
#[diesel(check_for_backend(diesel::sqlite::Sqlite))]
pub struct TransactionDebt {
    pub id: i32,
    pub transaction_id: i32,
    pub group_member_id: i32,
    pub amount: i32,
}
