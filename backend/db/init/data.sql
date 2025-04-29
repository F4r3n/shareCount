-- USERS
INSERT INTO users (name, email, password_hash, created_at)
VALUES 
  ('John Doe', 'john.doe@example.com', 'hashed_password_123', CURRENT_TIMESTAMP),
  ('Alice Smith', 'alice.smith@example.com', 'hashed_password_456', CURRENT_TIMESTAMP);

-- GROUPS
INSERT INTO groups (name, currency, token, created_at)
VALUES 
  ('Travel Group', 'USD', 'token_abc123', CURRENT_TIMESTAMP),
  ('Foodies Group', 'EUR', 'token_def456', CURRENT_TIMESTAMP);

-- GROUP MEMBERS
-- Insert members for "Travel Group"
INSERT INTO group_members (group_id, nickname, user_id)
VALUES
  (1, 'johnny', 1),  -- John Doe
  (1, 'alicesmith', 2);  -- Alice Smith

-- Insert members for "Foodies Group"
INSERT INTO group_members (group_id, nickname, user_id)
VALUES
  (2, 'foodlover', 1),  -- John Doe
  (2, 'alicethechef', 2);  -- Alice Smith

-- TRANSACTIONS
-- Transaction for "Travel Group"
INSERT INTO transactions (group_id, description, amount, paid_by, currency, created_at)
VALUES 
  (1, 'Hotel booking for group trip', 200, 1, 'USD', CURRENT_TIMESTAMP),  -- Paid by John Doe
  (1, 'Flight tickets for group trip', 500, 2, 'USD', CURRENT_TIMESTAMP);  -- Paid by Alice Smith

-- Transaction for "Foodies Group"
INSERT INTO transactions (group_id, description, amount, paid_by, currency, created_at)
VALUES 
  (2, 'Dinner at fancy restaurant', 100, 1, 'USD',CURRENT_TIMESTAMP),  -- Paid by John Doe
  (2, 'Cooking class for group', 150, 2, 'USD',CURRENT_TIMESTAMP);  -- Paid by Alice Smith

-- TRANSACTION DEBTS
-- Debts for "Travel Group"
INSERT INTO transaction_debts (transaction_id, group_member_id, amount)
VALUES
  (1, 1, 100),  -- John Doe owes $100 for the first transaction
  (1, 2, 100),  -- Alice Smith owes $100 for the first transaction
  (2, 1, 250),  -- John Doe owes $250 for the second transaction
  (2, 2, 250);  -- Alice Smith owes $250 for the second transaction

-- Debts for "Foodies Group"
INSERT INTO transaction_debts (transaction_id, group_member_id, amount)
VALUES
  (3, 1, 50),   -- John Doe owes $50 for the first transaction
  (3, 2, 50),   -- Alice Smith owes $50 for the first transaction
  (4, 1, 75),   -- John Doe owes $75 for the second transaction
  (4, 2, 75);   -- Alice Smith owes $75 for the second transaction
