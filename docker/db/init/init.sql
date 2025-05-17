drop TABLE IF EXISTS transaction_debts;
drop TABLE IF EXISTS transactions;
drop TABLE IF EXISTS group_members;
drop TABLE IF EXISTS groups;
drop TABLE IF EXISTS users;
drop TABLE IF EXISTS currency;

CREATE TABLE currency (
  code CHAR(3) PRIMARY KEY CHECK (code ~ '^[A-Z]{3}$'),  -- ISO 4217 codes (USD, EUR, etc.)
  name TEXT NOT NULL UNIQUE,
  symbol TEXT,
  minor_units SMALLINT NOT NULL  -- Number of decimal places (e.g., 2 for USD, 0 for JPY)
);

-- USERS
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
  currency_id TEXT NOT NULL REFERENCES currency(code),
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GROUP MEMBERS
CREATE TABLE group_members (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  uuid TEXT NOT NULL UNIQUE,
  UNIQUE (group_id, nickname)
);

-- TRANSACTIONS
CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  paid_by INTEGER NOT NULL REFERENCES group_members(id),
  currency_id TEXT NOT NULL REFERENCES currency(code),
  exchange_rate NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  uuid TEXT NOT NULL UNIQUE
);

-- TRANSACTION DEBTS
CREATE TABLE transaction_debts (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  group_member_id INTEGER NOT NULL REFERENCES group_members(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  UNIQUE (transaction_id, group_member_id)
);

INSERT INTO currency (code, name, symbol, minor_units) VALUES
  ('USD', 'US Dollar', '$', 2),
  ('EUR', 'Euro', '€', 2),
  ('JPY', 'Japanese Yen', '¥', 0),
  ('GBP', 'Pound Sterling', '£', 2),
  ('AUD', 'Australian Dollar', '$', 2),
  ('CAD', 'Canadian Dollar', '$', 2),
  ('CHF', 'Swiss Franc', 'CHF', 2),
  ('CNY', 'Yuan Renminbi', '¥', 2),
  ('SEK', 'Swedish Krona', 'kr', 2),
  ('NZD', 'New Zealand Dollar', '$', 2),
  ('MXN', 'Mexican Peso', '$', 2),
  ('SGD', 'Singapore Dollar', '$', 2),
  ('HKD', 'Hong Kong Dollar', '$', 2),
  ('NOK', 'Norwegian Krone', 'kr', 2),
  ('KRW', 'South Korean Won', '₩', 0),
  ('TRY', 'Turkish Lira', '₺', 2),
  ('RUB', 'Russian Ruble', '₽', 2),
  ('INR', 'Indian Rupee', '₹', 2),
  ('BRL', 'Brazilian Real', 'R$', 2),
  ('ZAR', 'South African Rand', 'R', 2);

-- SEED DATA
INSERT INTO users (name, email, password_hash, created_at)
VALUES 
  ('John Doe', 'john.doe@example.com', 'hashed_password_123', CURRENT_TIMESTAMP),
  ('Alice Smith', 'alice.smith@example.com', 'hashed_password_456', CURRENT_TIMESTAMP);

INSERT INTO groups (name, currency_id, token, created_at)
VALUES 
  ('Travel Group', 'USD', 'token_abc123', CURRENT_TIMESTAMP),
  ('Foodies Group', 'EUR', 'token_def456', CURRENT_TIMESTAMP);

INSERT INTO group_members (group_id, nickname, user_id, uuid)
VALUES
  (1, 'johnny', 1, 'user_uuid1'),
  (1, 'alicesmith', 2, 'user_uuid2'),
  (2, 'foodlover', 1, 'user_uuid3'),
  (2, 'alicethechef', 2, 'user_uuid4');

INSERT INTO transactions (group_id, description, amount, paid_by, currency_id, created_at, uuid)
VALUES 
  (1, 'Hotel booking for group trip', 200.00, 1, 'USD', CURRENT_TIMESTAMP, 'transaction_uuid1'),
  (1, 'Flight tickets for group trip', 500.00, 2, 'USD', CURRENT_TIMESTAMP, 'transaction_uuid2'),
  (2, 'Dinner at fancy restaurant', 100.00, 1, 'EUR', CURRENT_TIMESTAMP, 'transaction_uuid3'),
  (2, 'Cooking class for group', 150.00, 2, 'EUR', CURRENT_TIMESTAMP, 'transaction_uuid4');

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