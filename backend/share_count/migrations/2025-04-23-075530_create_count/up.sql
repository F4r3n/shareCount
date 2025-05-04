-- USERS
drop TABLE IF EXISTS transaction_debts;
drop TABLE IF EXISTS transactions;
drop TABLE IF EXISTS group_members;
drop TABLE IF EXISTS groups;
drop TABLE IF EXISTS users;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GROUPS
CREATE TABLE groups (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  currency TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GROUP MEMBERS
CREATE TABLE group_members (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE (group_id, nickname)
);

-- TRANSACTIONS
CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  paid_by INTEGER NOT NULL REFERENCES group_members(id),
  currency TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- TRANSACTION DEBTS
CREATE TABLE transaction_debts (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  group_member_id INTEGER NOT NULL REFERENCES group_members(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL
);

-- SEED DATA
INSERT INTO users (name, email, password_hash, created_at)
VALUES 
  ('John Doe', 'john.doe@example.com', 'hashed_password_123', CURRENT_TIMESTAMP),
  ('Alice Smith', 'alice.smith@example.com', 'hashed_password_456', CURRENT_TIMESTAMP);

INSERT INTO groups (name, currency, token, created_at)
VALUES 
  ('Travel Group', 'USD', 'token_abc123', CURRENT_TIMESTAMP),
  ('Foodies Group', 'EUR', 'token_def456', CURRENT_TIMESTAMP);

INSERT INTO group_members (group_id, nickname, user_id)
VALUES
  (1, 'johnny', 1),
  (1, 'alicesmith', 2),
  (2, 'foodlover', 1),
  (2, 'alicethechef', 2);

INSERT INTO transactions (group_id, description, amount, paid_by, currency, created_at)
VALUES 
  (1, 'Hotel booking for group trip', 200.00, 1, 'USD', CURRENT_TIMESTAMP),
  (1, 'Flight tickets for group trip', 500.00, 2, 'USD', CURRENT_TIMESTAMP),
  (2, 'Dinner at fancy restaurant', 100.00, 1, 'EUR', CURRENT_TIMESTAMP),
  (2, 'Cooking class for group', 150.00, 2, 'EUR', CURRENT_TIMESTAMP);

INSERT INTO transaction_debts (transaction_id, group_member_id, amount)
VALUES
  (1, 1, 100.00),
  (1, 2, 100.00),
  (2, 1, 250.00),
  (2, 2, 250.00),
  (3, 1, 50.00),
  (3, 2, 50.00),
  (4, 1, 75.00),
  (4, 2, 75.00);