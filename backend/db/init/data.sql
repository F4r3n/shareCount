-- Enable foreign keys
PRAGMA foreign_keys = ON;

-- USERS
INSERT INTO users (name, email, password_hash, salt)
VALUES 
  ('Alice', 'alice@example.com', 'hashed_pw1', 'salt1'),
  ('Bob', 'bob@example.com', 'hashed_pw2', 'salt2'),
  ('Charlie', 'charlie@example.com', 'hashed_pw3', 'salt3');

-- GROUPS
INSERT INTO groups (name, currency, created_at)
VALUES ('Trip to Spain', 'EUR', datetime('now'));

-- GROUP MEMBERS (assuming group_id = 1, user_ids = 1–3)
INSERT INTO group_members (group_id, user_id, nickname)
VALUES 
  (1, 1, 'Ali'),
  (1, 2, 'Bobby'),
  (1, 3, 'Chuck');

-- TRANSACTION (Alice paid €90)
INSERT INTO transactions (group_id, description, amount, paid_by, created_at)
VALUES (1, 'Dinner in Madrid', 9000, 1, datetime('now'));

-- TRANSACTION DEBTS (split €90 equally)
INSERT INTO transaction_debts (transaction_id, user_id, amount)
VALUES 
  (1, 1, 3000),
  (1, 2, 3000),
  (1, 3, 3000);
