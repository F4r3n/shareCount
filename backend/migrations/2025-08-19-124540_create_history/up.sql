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
      (group_member_id, nickname, modified_at, operation)
    VALUES
      (OLD.id, OLD.nickname, OLD.modified_at, 'DELETE');
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO group_members_history
      (group_member_id, nickname, modified_at, operation)
    VALUES
      (NEW.id, NEW.nickname, NEW.modified_at, 'UPDATE');
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO group_members_history
      (group_member_id, nickname, modified_at, operation)
    VALUES
      (NEW.id, NEW.nickname, NEW.modified_at, 'INSERT');
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
      (transaction_id, description, amount, paid_by, currency_id, exchange_rate, created_at, modified_at, operation)
    VALUES
      (OLD.id, OLD.description, OLD.amount, OLD.paid_by, OLD.currency_id, OLD.exchange_rate, OLD.created_at, OLD.modified_at, 'DELETE');
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO transactions_history
      (transaction_id, description, amount, paid_by, currency_id, exchange_rate, created_at, modified_at, operation)
    VALUES
      (NEW.id, NEW.description, NEW.amount, NEW.paid_by, NEW.currency_id, NEW.exchange_rate, NEW.created_at, NEW.modified_at, 'UPDATE');
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO transactions_history
      (transaction_id, description, amount, paid_by, currency_id, exchange_rate, created_at, modified_at, operation)
    VALUES
      (NEW.id, NEW.description, NEW.amount, NEW.paid_by, NEW.currency_id, NEW.exchange_rate, NEW.created_at, NEW.modified_at, 'INSERT');
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
  transaction_debt_id INTEGER NOT NULL REFERENCES transaction_debts(id),
  amount NUMERIC NOT NULL,
  operation TEXT -- 'INSERT', 'UPDATE', 'DELETE'
);

CREATE OR REPLACE FUNCTION log_transaction_debts_history()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO transaction_debts_history
      (transaction_debt_id, amount, operation)
    VALUES
      (OLD.id, OLD.amount, 'DELETE');
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO transaction_debts_history
      (transaction_debt_id, amount, operation)
    VALUES
      (NEW.id, NEW.amount, 'UPDATE');
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO transaction_debts_history
      (transaction_debt_id, amount, operation)
    VALUES
      (NEW.id, NEW.amount, 'INSERT');
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_transaction_debts_history
AFTER INSERT OR UPDATE OR DELETE ON transaction_debts
FOR EACH ROW EXECUTE FUNCTION log_transaction_debts_history();
