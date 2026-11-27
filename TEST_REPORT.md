# Test report

Run: `npm test` (server) and `npm run test:client` (the real browser files in a fake-DOM VM; expects the Netlify folder next to this one as `../actual game`). Node v22.23.5; SQL runs on SQLite (node:sqlite).

## Result
```
Server tests
  ✓ engine on server is deterministic and matches repeated runs
  ✓ create room -> code format, host in lobby
  ✓ crest validator accepts all 25 shapes and rejects unsafe colours
  ✓ IP room-creation limit is shared across separate sockets
  ✓ session token rotates on resume; old token cannot resume again
  ✓ expired session is revoked server-side
  ✓ second player joins with correct code (lowercase/spaces tolerated); host is notified
  ✓ incorrect room code, malformed code
  ✓ brute-force joins are throttled
  ✓ wrong room codes are throttled across separate sockets by IP
  ✓ third player cannot join a full room
  ✓ cannot create/join multiple rooms with one connection
  ✓ host leaves in lobby -> guest becomes host, room stays
  ✓ last player leaving destroys the room
  ✓ leave then create/join another room
  ✓ validation: start needs host, opponent, teams and ready
  ✓ invalid teams rejected (unknown animal, duplicates, wrong size, bad formation)
  ✓ full synchronized match: both clients get identical ordered events, score and result
  ✓ team changes / ready changes rejected during a match; start before ready rejected
  ✓ impersonation: payload identity/side/score fields are ignored
  ✓ guest cannot hijack host seat with a join payload token of the wrong value
  ✓ refresh in lobby: resume with token on a new socket replaces the old one
  ✓ refresh mid-match: pause, resume gets snapshot, match completes once, no duplicates
  ✓ disconnected player who never returns: match resumes after grace and still finishes; state shows offline
  ✓ leaving mid-match = forfeit for the leaver; opponent gets match:end once
  ✓ rematch: needs both, swaps sides, new match id; duplicate rematch requests harmless
  ✓ back to lobby after match lets players change teams and ready up again
  ✓ opponent leaves after the match: remaining player keeps result, can wait for new opponent
  ✓ lobby disconnect: seat kept during grace, freed afterwards
  ✓ abandoned rooms are cleaned up by the sweeper
  ✓ sweep removes idle/expired rooms and clears timers
  ✓ resume of a non-existent room (server restarted) is reported cleanly
  ✓ same name for both players is disambiguated in match text
  ✓ garbage payloads never crash the server
  ✓ rate limiter blocks floods
35 passed, 0 failed
Account / economy tests
  ✓ register, login, wrong password, unknown user, duplicate name
  ✓ invalid / missing / forged tokens and broken JSON are rejected
  ✓ session expiry, refresh rotation, logout, logout-all, per-session revoke
  ✓ brute-force login is rate limited
  ✓ coins cannot be raised by crafted requests (extra fields are ignored, no endpoint sets coins)
  ✓ pack purchase: price checked, coins deducted, 3 server-chosen cards added, unknown/insufficient rejected
  ✓ prehistoric pack gives exactly 1 Dinosaur + 2 Legendary
  ✓ idempotency: a retried purchase (same key) is applied once
  ✓ parallel requests: same idempotency key x8 pays once; unaffordable parallel buys never overdraw
  ✓ card upgrade: not owned / not enough copies / not enough coins rejected; valid upgrade costs coins; exclusive cannot upgrade
  ✓ facility upgrade: price from server, max level enforced
  ✓ premium crest: needs 10,000 coins, cannot equip a locked crest, backup cannot unlock one
  ✓ exclusive animals: cannot be claimed without the quest; no way to add them by hand
  ✓ squad: only owned animals; duplicates / bad formation rejected; best chem/ovr computed by server
  ✓ daily & weekly missions + daily bonus cannot be claimed early or twice
  ✓ promo: coins & card codes work once per user; unknown, expired, inactive rejected
  ✓ promo usage limit holds under parallel redemption by many users; same user in parallel gets it once
  ✓ promo brute force is throttled
  ✓ career: 60s cooldown is enforced by the server clock, rewards are server-defined
  ✓ squad game: server simulates + pays; 10s cooldown; client cannot pick opponent or score
  ✓ endless league: start required, rewards by streak, loss ends run, milestones paid once per run
  ✓ draft: server offers, picks must come from the offer, +75 coins once, draft squad is server-held
  ✓ cup: needs a complete valid squad; server plays every match, pays the bracket once; cannot replay or double-pay
  ✓ cup: a squad card that is no longer owned blocks the match; cup results are deterministic per seed
  ✓ backup import can never change collection, coins, upgrades, exclusives or stats
  ✓ ownership is per account: user A cannot see or use user B collection
  ✓ reset keeps redeemed promo codes redeemed (no re-farming)
  ✓ data survives a server restart (same database file)
  ✓ multiplayer: login required; unowned animals are refused; forged upgrade levels are replaced by the server
  ✓ multiplayer: effective upgrade levels and facilities come from the account, not from the client
  ✓ multiplayer: a revoked session cannot keep submitting teams; reconnect needs a fresh login
31 passed, 0 failed
Client smoke test (real browser files + real server)
  ✓ game files load; login gate is shown; no secret promo codes in the client
  ✓ register through the gate loads the server state into the game
  ✓ local tampering cannot change what the server holds (coins/owned edited in "console")
  ✓ promo code via settings input goes to the server
  ✓ squad edits sync to the server; squad game is played and paid by the server
  ✓ cup: start -> Play Match goes to the server; result is applied when the match ends
  ✓ endless league + career go through the server
  ✓ backup export contains no coins/collection; import of a forged backup changes nothing authoritative
  ✓ multiplayer client sends auth:login with the session token on connect
9 passed, 0 failed
```

## Mapping to your 13 required tests
| # | Requirement | Test(s) |
|---|---|---|
| 1 | Cannot use an animal you do not own | multiplayer: "unowned animals are refused"; squad: "only owned animals"; "ownership is per account" |
| 2 | Cannot add an exclusive animal | "exclusive animals: cannot be claimed without the quest"; crafted `owned`/`exclusiveClaims` fields ignored |
| 3 | No free card upgrade | "card upgrade: not owned / not enough copies / not enough coins rejected" |
| 4 | No coins via LocalStorage/console | "coins cannot be raised by crafted requests"; client smoke "local tampering cannot change what the server holds" |
| 5 | Daily Bonus once | "daily & weekly missions + daily bonus cannot be claimed early or twice" |
| 6 | Mission once | same test (incl. 5 parallel claims) |
| 7 | Promo limit | "promo usage limit holds under parallel redemption by many users" |
| 8 | Parallel requests | idempotency x8, parallel promo, parallel mission claims, parallel purchases never overdraw |
| 9 | Career cooldown | "career: 60s cooldown is enforced by the server clock" |
| 10 | Backup cannot change collection | "backup import can never change collection, coins, upgrades, exclusives or stats" (+ client smoke forged-backup test) |
| 11 | Pack purchase | "pack purchase…", "prehistoric pack gives exactly 1 Dinosaur + 2 Legendary", ledger-sum checks |
| 12 | Existing multiplayer tests | all 35 original tests in `test/run.js` still pass unchanged |
| 13 | Data survives restart | "data survives a server restart (same database file)" |
Extra: invalid/forged/expired/revoked sessions, brute-force login and promo throttling, malformed JSON, unknown users, refresh rotation, logout-all.

## NOT tested (be aware)
* **PostgreSQL / Supabase.** The sandbox has no network and no Postgres, so `lib/db/store.js` (pg driver) and the Supabase setup were **never executed**.
  The SQL is portable and every query runs on SQLite in the tests, but first-time Postgres behaviour (type coercion of BIGINT, `FOR UPDATE`, pooler) must be verified on your Supabase project – see checklist in `DEPLOY_AND_SECURITY.md` §4.
* Real network Socket.IO (the multiplayer tests use the in-process fake from the original suite) and a real browser (the client smoke test runs the real files in a fake-DOM VM: it proves logic and wiring, not visuals/touch).
* Deployment on Render / Netlify and CORS with your real domains.
