-- GROUPS
CREATE TABLE groups_history (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id),
  name TEXT NOT NULL,
  currency_id TEXT NOT NULL,
  token TEXT NOT NULL,
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
  modified_by_uuid TEXT NOT NULL,
  group_id INTEGER NOT NULL REFERENCES groups(id),
  uuid TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL CONSTRAINT positive_price CHECK (amount > 0),
  paid_by INTEGER NOT NULL REFERENCES group_members(id),
  currency_id TEXT NOT NULL,
  exchange_rate NUMERIC NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  operation TEXT -- 'INSERT', 'UPDATE', 'DELETE'
);


-- TRANSACTION DEBTS
CREATE TABLE transaction_debts_history (
  id SERIAL PRIMARY KEY,
  transaction_history_id INTEGER NOT NULL REFERENCES transactions_history(id),
  group_member_id INTEGER NOT NULL REFERENCES group_members(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  operation TEXT -- 'INSERT', 'UPDATE', 'DELETE'
);

