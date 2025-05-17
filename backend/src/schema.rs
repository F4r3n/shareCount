// @generated automatically by Diesel CLI.

diesel::table! {
    currency(code) {
        code -> Text,
        name -> Text,
        symbol -> Text,
        minor_units -> Integer
    }
}

diesel::table! {
    users (id) {
        id -> Integer,
        name -> Text,
        email -> Text,
        password_hash -> Text,
        created_at -> Timestamp,
    }
}

diesel::table! {
    groups (id) {
        id -> Integer,
        name -> Text,
        currency_id -> Text,
        token -> Text,
        created_at -> Timestamp,
    }
}

diesel::table! {
    group_members (id) {
        id -> Integer,
        group_id -> Integer,
        nickname -> Text,
        user_id -> Nullable<Integer>,
        uuid -> Text
    }
}

diesel::table! {
    transactions (id) {
        id -> Integer,
        group_id -> Integer,
        description -> Text,
        amount -> Numeric,
        paid_by -> Integer,
        currency_id -> Text,
        exchange_rate -> Numeric,
        created_at -> Timestamp,
        uuid -> Text,
    }
}

diesel::table! {
    transaction_debts (id) {
        id -> Integer,
        transaction_id -> Integer,
        group_member_id -> Integer,
        amount -> Numeric,
    }
}

// Define relationships
diesel::joinable!(group_members -> groups (group_id));
diesel::joinable!(group_members -> users (user_id));
diesel::joinable!(transactions -> groups (group_id));
diesel::joinable!(transactions -> group_members (paid_by));
diesel::joinable!(transaction_debts -> transactions (transaction_id));
diesel::joinable!(transaction_debts -> group_members (group_member_id));
diesel::joinable!(groups -> currency (currency_id));
diesel::joinable!(transactions -> currency (currency_id));

// Enable Diesel’s ability to perform multi-table queries
diesel::allow_tables_to_appear_in_same_query!(
    users,
    groups,
    group_members,
    transactions,
    transaction_debts,
);
