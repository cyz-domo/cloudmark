-- Track whether the one-time write token has been delivered to a client
-- after KV migration. 0 = not yet delivered (safe to issue once on next open).
ALTER TABLE collections ADD COLUMN token_delivered INTEGER NOT NULL DEFAULT 1;
