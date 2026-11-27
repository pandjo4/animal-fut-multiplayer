# ANIMAL FUT – server-side security & database (Render + Supabase + Netlify)

Two projects, **not merged**: `actual game` (static, Netlify) and `animal-fut-multiplayer` (Node, Render).
The Render server is the authority for accounts, coins, collection, upgrades, packs, rewards, missions, promo codes,
League, Career, Cups and multiplayer validation. The browser only sends *requests* (an id, a choice) and shows the answer.

## 1. Supabase (database)
1. supabase.com → New project (choose a region near your Render region). Save the **database password**.
2. SQL Editor → paste `migrations/001_init.sql` → Run. (The server also runs it on every start – it is idempotent.)
3. SQL Editor → paste `supabase/rls.sql` → Run. This makes the tables unreachable through Supabase's public REST API.
4. Project Settings → Database → *Connection string* → **Session pooler** URI (port 5432). Replace `[YOUR-PASSWORD]`.
   This string is your `DATABASE_URL`. **Never** put it, or the Supabase service-role key, in Netlify or in any file in the frontend.
   (The service-role key is not used by this project at all.)

## 2. Render (backend)
Service type: Web Service, build `npm install`, start `npm start`, Node 18+.
Environment variables (Render → Environment):

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | the Supabase pooler URI from step 1.4 |
| `ALLOWED_ORIGINS` | your Netlify origin, e.g. `https://my-game.netlify.app` (comma separated; `*` is a wildcard inside one label) |
| `SESSION_TTL_MS` | optional, default 7 days |
| `PROMO_SEED_JSON` | optional, replaces the built-in first-run promo codes (see below) |

Without `DATABASE_URL` the server **refuses to start in production** (it would otherwise silently use a throw-away file DB).
Health check path: `/health` (API: `/api/health`).

## 3. Netlify (frontend)
Deploy the `actual game` folder as before (drag & drop / Git). Only edit `config.js`:
`window.WILDXI_SERVER_URL = 'https://YOUR-RENDER-SERVICE.onrender.com';`
No environment variables or secrets are needed on Netlify.

## 4. First start checklist
1. Open the Netlify URL → create an account → buy a pack, play a Squad Game.
2. Supabase → Table editor → `players`, `ledger`: you should see your coins and every coin movement.
3. Render → Manual deploy / restart → log in again: coins and cards are still there.

## 5. Operating the promo codes
The codes that used to be written in the browser's JavaScript are seeded **once** (they were public, treat them as burnt):
`WILDXI-ADMIN1/2`, `WILDXI-COINS-10000/25000/50000/500000`, the 7 dinosaur codes. Change them in SQL Editor:
```sql
-- limit a code to 50 uses and expire it
UPDATE promo_codes SET max_uses = 50, expires_at = 1798675200000 WHERE code = 'WILDXI-COINS-10000';
-- switch a code off
UPDATE promo_codes SET active = 0 WHERE code = 'WILDXI-ADMIN1';
-- new code (reward_type 'coins' -> value is the amount; 'card' -> value is the animal id). max_uses 0 = unlimited
INSERT INTO promo_codes(code,reward_type,reward_value,max_uses,uses,expires_at,active) VALUES ('SPRING-2027','coins','2500',200,0,NULL,1);
```
`expires_at` is unix **milliseconds**. Each player can redeem a code once; the usage counter is atomic.

## 6. What the server enforces (all covered by tests)
* Accounts: scrypt password hashes, random 256-bit session tokens (only the SHA-256 is stored), 7-day expiry, rotation (`/auth/refresh`),
  logout, logout-everywhere, per-session revoke, max 10 live sessions, login throttling per IP and per username.
* Coins: stored server-side with `CHECK (coins >= 0)`; every change is a row in `ledger` (the sum always equals the balance).
* Collection / upgrades / facilities / premium crests / exclusives: only changed by server endpoints that check ownership, price, copies and max level.
* Packs: the server rolls the cards (client sends only the pack id). Idempotency-Key makes retries / double clicks safe.
* Daily bonus, daily & weekly missions: server periods (UTC), server progress, one claim only.
* Matches that pay (Squad Game, Endless League, Career, Cup/Draft): **simulated on the server** with the same engine, opponent and seed chosen by the server,
  rewards computed by the server, Squad Game 10 s / Career 60 s cooldown on the server clock.
* Backup: only club name, squads, settings and crest colours/symbol are accepted. Coins/cards/upgrades/exclusives in a backup are ignored.
* Multiplayer: the socket must log in with the session token; `team:submit` checks every animal against the account's collection and **replaces** upgrade levels and
  facilities with the account's real values (re-checks the session on every submit, so revoked sessions stop working). Existing rooms, reconnect, rematch are unchanged.

## 7. Known limits / decisions you should know about
* **Old local progress is not migrated.** Anything stored in a browser's LocalStorage cannot be trusted (that was the exploit), so every account starts with the
  300 starter coins + starter animals. If you want to reward existing players, grant them coins via a promo code or a one-off SQL `UPDATE`.
* Username + password only (no e-mail, no password reset). A forgotten password needs a manual SQL reset.
* Rate limits are in-memory – correct for one Render instance; if you scale to several instances use a shared store (e.g. Redis).
* A Cup/League/Career match is settled on the server the moment you press *Play Match*; the animation just replays it. Closing the tab mid-animation does not change the result.
* Multiplayer matches still give no coins/XP (unchanged).
* Player state is one JSON document per player (`players.state`) updated under a row lock + version check, rather than a table row per card.
* Free Render instances sleep; the first request after a pause can take up to ~1 minute (the login screen says so).
