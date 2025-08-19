drop TABLE IF EXISTS groups_history;
drop TABLE IF EXISTS group_members_history;
drop TABLE IF EXISTS transactions_history;
drop TABLE IF EXISTS transaction_debts_history;

DROP TRIGGER IF EXISTS trg_groups_history ON groups;
DROP TRIGGER IF EXISTS trg_group_members_history ON group_members;
DROP TRIGGER IF EXISTS trg_transactions_history ON transactions;
DROP TRIGGER IF EXISTS trg_transaction_debts_history ON transaction_debts;


drop TABLE IF EXISTS transaction_debts;
drop TABLE IF EXISTS transactions;
drop TABLE IF EXISTS group_members;
drop TABLE IF EXISTS groups;
drop TABLE IF EXISTS users;


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
  currency_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GROUP MEMBERS
CREATE TABLE group_members (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  uuid TEXT NOT NULL UNIQUE,
  modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (group_id, nickname)
);

-- TRANSACTIONS
CREATE TABLE transactions (
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
CREATE TABLE transaction_debts (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  group_member_id INTEGER NOT NULL REFERENCES group_members(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  UNIQUE (transaction_id, group_member_id)
);

-- GROUPS
CREATE TABLE groups_history (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id),
  name TEXT NOT NULL,
  currency_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  operation TEXT -- 'INSERT', 'UPDATE', 'DELETE'
);

CREATE OR REPLACE FUNCTION log_groups_history()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO groups_history
      (group_id, name, currency_id, token, modified_at, created_at, operation)
    VALUES
      (OLD.id, OLD.name, OLD.currency_id, OLD.token, OLD.modified_at, OLD.created_at, 'DELETE');
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO groups_history
      (group_id, name, currency_id, token, modified_at, created_at, operation)
    VALUES
      (NEW.id, NEW.name, NEW.currency_id, NEW.token, NEW.modified_at, NEW.created_at, 'UPDATE');
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO groups_history
      (group_id, name, currency_id, token, modified_at, created_at, operation)
    VALUES
      (NEW.id, NEW.name, NEW.currency_id, NEW.token, NEW.modified_at, NEW.created_at, 'INSERT');
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_groups_history
AFTER INSERT OR UPDATE OR DELETE ON groups
FOR EACH ROW EXECUTE FUNCTION log_groups_history();


-- GROUP MEMBERS
CREATE TABLE group_members_history (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id),
  group_member_id INTEGER NOT NULL REFERENCES group_members(id),
  nickname TEXT NOT NULL,
  modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  operation TEXT -- 'INSERT', 'UPDATE', 'DELETE'
);

CREATE OR REPLACE FUNCTION log_group_members_history()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO group_members_history
      (group_id, group_member_id, nickname, modified_at, operation)
    VALUES
      (OLD.group_id, OLD.id, OLD.nickname, OLD.modified_at, 'DELETE');
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO group_members_history
      (group_id, group_member_id, nickname, modified_at, operation)
    VALUES
      (NEW.group_id, NEW.id, NEW.nickname, NEW.modified_at, 'UPDATE');
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO group_members_history
      (group_id, group_member_id, nickname, modified_at, operation)
    VALUES
      (NEW.group_id, NEW.id, NEW.nickname, NEW.modified_at, 'INSERT');
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_group_members_history
AFTER INSERT OR UPDATE OR DELETE ON group_members
FOR EACH ROW EXECUTE FUNCTION log_group_members_history();


-- TRANSACTIONS
CREATE TABLE transactions_history (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id),
  transaction_id INTEGER NOT NULL REFERENCES transactions(id),
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL CONSTRAINT positive_price CHECK (amount > 0),
  paid_by INTEGER NOT NULL REFERENCES group_members(id),
  currency_id TEXT NOT NULL,
  exchange_rate NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  operation TEXT -- 'INSERT', 'UPDATE', 'DELETE'
);

CREATE OR REPLACE FUNCTION log_transactions_history()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO transactions_history
      (group_id, transaction_id, description, amount, paid_by, currency_id, exchange_rate, created_at, modified_at, operation)
    VALUES
      (OLD.group_id, OLD.id, OLD.description, OLD.amount, OLD.paid_by, OLD.currency_id, OLD.exchange_rate, OLD.created_at, OLD.modified_at, 'DELETE');
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO transactions_history
      (group_id, transaction_id, description, amount, paid_by, currency_id, exchange_rate, created_at, modified_at, operation)
    VALUES
      (NEW.group_id, NEW.id, NEW.description, NEW.amount, NEW.paid_by, NEW.currency_id, NEW.exchange_rate, NEW.created_at, NEW.modified_at, 'UPDATE');
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO transactions_history
      (group_id, transaction_id, description, amount, paid_by, currency_id, exchange_rate, created_at, modified_at, operation)
    VALUES
      (NEW.group_id, NEW.id, NEW.description, NEW.amount, NEW.paid_by, NEW.currency_id, NEW.exchange_rate, NEW.created_at, NEW.modified_at, 'INSERT');
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_transactions_history
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION log_transactions_history();


-- TRANSACTION DEBTS
CREATE TABLE transaction_debts_history (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id),
  group_member_id INTEGER NOT NULL REFERENCES group_members(id) ON DELETE CASCADE,
  transaction_debt_id INTEGER NOT NULL REFERENCES transaction_debts(id),
  amount NUMERIC NOT NULL,
  operation TEXT -- 'INSERT', 'UPDATE', 'DELETE'
);

CREATE OR REPLACE FUNCTION log_transaction_debts_history()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO transaction_debts_history
      (transaction_id, group_member_id, transaction_debt_id, amount, operation)
    VALUES
      (OLD.transaction_id, OLD.group_member_id, OLD.id, OLD.amount, 'DELETE');
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO transaction_debts_history
      (transaction_id, group_member_id, transaction_debt_id, amount, operation)
    VALUES
      (NEW.transaction_id, NEW.group_member_id, NEW.id, NEW.amount, 'UPDATE');
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO transaction_debts_history
      (transaction_id, group_member_id, transaction_debt_id, amount, operation)
    VALUES
      (NEW.transaction_id, NEW.group_member_id, NEW.id, NEW.amount, 'INSERT');
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_transaction_debts_history
AFTER INSERT OR UPDATE OR DELETE ON transaction_debts
FOR EACH ROW EXECUTE FUNCTION log_transaction_debts_history();



-- SEED DATA
INSERT INTO users (name, email, password_hash, created_at)
VALUES 
  ('John Doe', 'john.doe@example.com', 'hashed_password_123', CURRENT_TIMESTAMP),
  ('Alice Smith', 'alice.smith@example.com', 'hashed_password_456', CURRENT_TIMESTAMP);

INSERT INTO groups (name, currency_id, token, created_at, modified_at)
VALUES 
  ('Travel Group', 'USD', 'token_abc123', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Foodies Group', 'EUR', 'token_def456', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO group_members (group_id, nickname, user_id, uuid, modified_at)
VALUES
  (1, 'johnny', 1, 'user_uuid1', CURRENT_TIMESTAMP),
  (1, 'alicesmith', 2, 'user_uuid2', CURRENT_TIMESTAMP),
  (2, 'foodlover', 1, 'user_uuid3', CURRENT_TIMESTAMP),
  (2, 'alicethechef', 2, 'user_uuid4',CURRENT_TIMESTAMP);

INSERT INTO transactions (group_id, description, amount, paid_by, currency_id, created_at, uuid, modified_at)
VALUES 
  (1, 'Hotel booking for group trip', 200.00, 1, 'USD', CURRENT_TIMESTAMP, 'transaction_uuid1', CURRENT_TIMESTAMP),
  (1, 'Flight tickets for group trip', 500.00, 2, 'USD', CURRENT_TIMESTAMP, 'transaction_uuid2', CURRENT_TIMESTAMP),
  (2, 'Dinner at fancy restaurant', 100.00, 1, 'EUR', CURRENT_TIMESTAMP, 'transaction_uuid3', CURRENT_TIMESTAMP),
  (2, 'Cooking class for group', 150.00, 2, 'EUR', CURRENT_TIMESTAMP, 'transaction_uuid4',CURRENT_TIMESTAMP);

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