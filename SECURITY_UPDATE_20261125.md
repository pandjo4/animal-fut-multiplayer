# Animal FUT Multiplayer — Security update (2026-11-25)

## Changes
- Session tokens are 256-bit random bearer secrets (64 hex characters).
- Server expires a room seat token after 24 hours.
- A successful resume rotates the token; the previous token becomes invalid.
- Leaving/removing a seat revokes its token immediately.
- Added shared per-IP request throttling across Socket.IO connections.
- Added per-IP room creation throttling, per-IP wrong-code throttling, and a cap on simultaneous rooms associated with one IP.
- Per-socket limits remain enabled as a second layer.
- Crest shape validation now supports indices 0–24, and colors are restricted to 3- or 6-digit hex.
- Added tests for all 25 crest shapes, cross-connection IP throttles, token rotation and expiry.

## Test
Run `npm test`. The packaged source was tested with Node.js and all 35 tests passed.

## Render configuration
Keep `ALLOWED_ORIGINS` set to the exact deployed Netlify origin, for example:
`https://YOUR-SITE-NAME.netlify.app`

Do not leave `ALLOWED_ORIGINS` empty in production. Set `NODE_ENV=production`.

## Remaining architectural limitation
The server has no authenticated player account or persistent player inventory. It therefore cannot prove that a submitted animal or upgrade/facility level was actually unlocked or purchased. The frontend economy and reward systems also still live in LocalStorage. A durable fix for card ownership, upgrades, promo codes, missions, daily/weekly rewards, packs, purchases and Career Mode cooldown requires persistent user identity and a database-backed server transaction system. The IP limits and session controls in this update do not replace account-level authorization.

IP rate-limit counters and room/session state are in server memory; they reset on a Render restart. The per-IP controls are useful abuse mitigation, not a distributed anti-DDoS service.
