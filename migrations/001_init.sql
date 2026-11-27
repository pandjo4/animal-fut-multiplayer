-- ANIMAL FUT server schema. Portable: runs on PostgreSQL (Supabase) and on SQLite (local tests).
-- All timestamps are unix milliseconds (BIGINT) written by the server, never by the client.
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  username    TEXT NOT NULL,
  username_lc TEXT NOT NULL UNIQUE,
  pass_hash   TEXT NOT NULL,
  created_at  BIGINT NOT NULL,
  CHECK (length(username) BETWEEN 3 AND 20)
);

CREATE TABLE IF NOT EXISTS sessions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  created_at   BIGINT NOT NULL,
  expires_at   BIGINT NOT NULL,
  revoked_at   BIGINT,
  last_used_at BIGINT NOT NULL,
  label        TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

-- One authoritative row per player. coins can never go negative (CHECK); version is bumped on every write.
CREATE TABLE IF NOT EXISTS players (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  coins   BIGINT NOT NULL CHECK (coins >= 0),
  version BIGINT NOT NULL DEFAULT 0,
  state   TEXT NOT NULL
);

-- Every coin movement. (user_id, idem_key) is unique so a retried request can never pay twice.
CREATE TABLE IF NOT EXISTS ledger (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  delta         BIGINT NOT NULL,
  balance_after BIGINT NOT NULL CHECK (balance_after >= 0),
  reason        TEXT NOT NULL,
  idem_key      TEXT,
  created_at    BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS ledger_user_idx ON ledger(user_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS ledger_idem_uq ON ledger(user_id, idem_key);

-- Stored responses of idempotent requests (double click / retry returns the same result, no second effect).
CREATE TABLE IF NOT EXISTS idempotency (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  idem_key   TEXT NOT NULL,
  response   TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (user_id, idem_key)
);

CREATE TABLE IF NOT EXISTS promo_codes (
  code         TEXT PRIMARY KEY,
  reward_type  TEXT NOT NULL CHECK (reward_type IN ('coins','card')),
  reward_value TEXT NOT NULL,
  max_uses     BIGINT NOT NULL CHECK (max_uses >= 0),
  uses         BIGINT NOT NULL DEFAULT 0 CHECK (uses >= 0),
  expires_at   BIGINT,
  active       INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  CHECK (uses <= max_uses OR max_uses = 0)
);

CREATE TABLE IF NOT EXISTS promo_redemptions (
  code       TEXT NOT NULL REFERENCES promo_codes(code),
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at BIGINT NOT NULL,
  PRIMARY KEY (code, user_id)
);
