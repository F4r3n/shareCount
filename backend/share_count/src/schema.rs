// @generated automatically by Diesel CLI.

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
        currency -> Text,
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
    }
}

diesel::table! {
    transactions (id) {
        id -> Integer,
        group_id -> Integer,
        description -> Nullable<Text>,
        amount -> Integer,
        paid_by -> Integer,
        created_at -> Timestamp,
    }
}

diesel::table! {
    transaction_debts (id) {
        id -> Integer,
        transaction_id -> Integer,
        group_member_id -> Integer,
        amount -> Integer,
    }
}

// Define relationships
diesel::joinable!(group_members -> groups (group_id));
diesel::joinable!(group_members -> users (user_id));
diesel::joinable!(transactions -> groups (group_id));
diesel::joinable!(transactions -> group_members (paid_by));
diesel::joinable!(transaction_debts -> transactions (transaction_id));
diesel::joinable!(transaction_debts -> group_members (group_member_id));

// Enable Diesel’s ability to perform multi-table queries
diesel::allow_tables_to_appear_in_same_query!(
    users,
    groups,
    group_members,
    transactions,
    transaction_debts,
);
