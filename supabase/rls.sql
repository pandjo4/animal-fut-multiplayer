-- Run ONCE in Supabase > SQL Editor, after the server has created the tables (or after pasting migrations/001_init.sql).
-- The Render server connects with the database owner role (DATABASE_URL) and is not affected by RLS.
-- Enabling RLS with NO policies means the public "anon"/"authenticated" API keys can read or write NOTHING in these tables
-- (important: users.pass_hash and sessions must never be reachable through Supabase's auto-generated REST API).
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE players           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger            ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency       ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_redemptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON users, sessions, players, ledger, idempotency, promo_codes, promo_redemptions FROM anon, authenticated;
