// @generated automatically by Diesel CLI.

diesel::table! {
    group_members (id) {
        id -> Integer,
        group_id -> Integer,
        user_id -> Integer,
        nickname -> Nullable<Text>,
    }
}

diesel::table! {
    groups (id) {
        id -> Integer,
        name -> Text,
        currency -> Text,
        created_at -> Nullable<Timestamp>,
    }
}

diesel::table! {
    transaction_debts (id) {
        id -> Integer,
        transaction_id -> Integer,
        user_id -> Integer,
        amount -> Integer,
    }
}

diesel::table! {
    transactions (id) {
        id -> Integer,
        group_id -> Integer,
        description -> Nullable<Text>,
        amount -> Integer,
        paid_by -> Integer,
        created_at -> Nullable<Timestamp>,
    }
}

diesel::table! {
    users (id) {
        id -> Integer,
        name -> Text,
        email -> Text,
        password_hash -> Text,
        salt -> Text,
    }
}

diesel::joinable!(group_members -> groups (group_id));
diesel::joinable!(group_members -> users (user_id));
diesel::joinable!(transaction_debts -> transactions (transaction_id));
diesel::joinable!(transaction_debts -> users (user_id));
diesel::joinable!(transactions -> groups (group_id));
diesel::joinable!(transactions -> users (paid_by));

diesel::allow_tables_to_appear_in_same_query!(
    group_members,
    groups,
    transaction_debts,
    transactions,
    users,
);
