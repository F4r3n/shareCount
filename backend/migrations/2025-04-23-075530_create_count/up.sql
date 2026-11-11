-- Initial schema.
-- Uses IF NOT EXISTS so it is a no-op on databases that were previously
-- bootstrapped from docker/db/init/init.sql. Never drop or seed here:
-- this runs automatically against production at backend startup.

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GROUPS
CREATE TABLE IF NOT EXISTS groups (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  currency_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GROUP MEMBERS
CREATE TABLE IF NOT EXISTS group_members (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  uuid TEXT NOT NULL UNIQUE,
  modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (group_id, nickname)
);

-- TRANSACTIONS
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL CONSTRAINT positive_price CHECK (amount > 0),
  paid_by INTEGER NOT NULL REFERENCES group_members(id),
  currency_id TEXT NOT NULL,
  exchange_rate NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  uuid TEXT NOT NULL UNIQUE
);

-- TRANSACTION DEBTS
CREATE TABLE IF NOT EXISTS transaction_debts (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  group_member_id INTEGER NOT NULL REFERENCES group_members(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  UNIQUE (transaction_id, group_member_id)
);
