-- This file should undo anything in `up.sql`
drop TABLE IF EXISTS groups_history;
drop TABLE IF EXISTS group_members_history;
drop TABLE IF EXISTS transactions_history;
drop TABLE IF EXISTS transaction_debts_history;

DROP TRIGGER IF EXISTS trg_groups_history ON groups;
DROP TRIGGER IF EXISTS trg_group_members_history ON group_members;