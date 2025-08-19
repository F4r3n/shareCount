-- This file should undo anything in `up.sql`
drop TABLE groups_history;
drop TABLE group_members_history;
drop TABLE transactions_history;
drop TABLE transaction_debts_history;

drop trigger trg_groups_history;
drop trigger trg_group_members_history;
drop trigger trg_transactions_history;
drop trigger trg_transaction_debts_history;