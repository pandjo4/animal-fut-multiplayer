'use strict';
const crypto = require('crypto');
const { promisify } = require('util');
const game = require('./game');
const { ApiError, bad } = game;
const scrypt = promisify(crypto.scrypt);

const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS) || 7 * 24 * 3600e3;
const MAX_SESSIONS = 10;
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
const rid = (n) => crypto.randomBytes(n).toString('hex');

async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}
async function verifyPassword(pw, stored) {
  const [alg, saltHex, keyHex] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const key = await scrypt(pw, Buffer.from(saltHex, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  const want = Buffer.from(keyHex, 'hex');
  return key.length === want.length && crypto.timingSafeEqual(key, want);
}
const DUMMY_HASH = 'scrypt$' + '00'.repeat(16) + '$' + '00'.repeat(64);

function createService(store, opts) {
  const o = Object.assign({ now: () => Date.now(), random: Math.random }, opts || {});

  async function newSession(db, userId, label) {
    const now = o.now(), token = rid(32), id = rid(8);
    // keep the number of live sessions bounded: drop the oldest ones
    const live = await db.all('SELECT id FROM sessions WHERE user_id=$1 AND revoked_at IS NULL AND expires_at>$2 ORDER BY created_at DESC', [userId, now]);
    for (const old of live.slice(MAX_SESSIONS - 1)) await db.run('UPDATE sessions SET revoked_at=$1 WHERE id=$2', [now, old.id]);
    await db.run('INSERT INTO sessions(id,user_id,token_hash,created_at,expires_at,last_used_at,label) VALUES($1,$2,$3,$4,$5,$6,$7)', [id, userId, sha(token), now, now + SESSION_TTL_MS, now, String(label || '').slice(0, 80)]);
    return { token, sessionId: id, expiresAt: now + SESSION_TTL_MS };
  }

  async function register(username, password, label) {
    username = String(username == null ? '' : username).trim();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) throw bad('BAD_USERNAME', 'Username must be 3-20 letters, digits or underscore.');
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw bad('BAD_PASSWORD', 'Password must be 8-128 characters.');
    const pass_hash = await hashPassword(password);
    return store.tx(async (db) => {
      const now = o.now(), id = rid(12);
      if (await db.get('SELECT id FROM users WHERE username_lc=$1', [username.toLowerCase()])) throw bad('USERNAME_TAKEN', 'That username is already taken.', 409);
      await db.run('INSERT INTO users(id,username,username_lc,pass_hash,created_at) VALUES($1,$2,$3,$4,$5)', [id, username, username.toLowerCase(), pass_hash, now]);
      const p = game.newPlayer(); p.state.managerName = username.slice(0, 18);
      await db.run('INSERT INTO players(user_id,coins,version,state) VALUES($1,$2,0,$3)', [id, p.coins, JSON.stringify(p.state)]);
      await db.run('INSERT INTO ledger(id,user_id,delta,balance_after,reason,idem_key,created_at) VALUES($1,$2,$3,$4,$5,NULL,$6)', [rid(8), id, p.coins, p.coins, 'welcome', now]);
      const sess = await newSession(db, id, label);
      return { userId: id, username, ...sess };
    });
  }
  async function login(username, password, label) {
    username = String(username == null ? '' : username).trim();
    const u = typeof password === 'string' && password.length <= 128 ? await store.tx((db) => db.get('SELECT id,username,pass_hash FROM users WHERE username_lc=$1', [username.toLowerCase()])) : null;
    const ok = await verifyPassword(typeof password === 'string' ? password : '', u ? u.pass_hash : DUMMY_HASH); // constant work for unknown users
    if (!u || !ok) throw bad('BAD_CREDENTIALS', 'Wrong username or password.', 401);
    return store.tx(async (db) => ({ userId: u.id, username: u.username, ...(await newSession(db, u.id, label)) }));
  }
  async function authenticate(token) {
    if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return null;
    return store.tx(async (db) => {
      const now = o.now();
      const s = await db.get('SELECT id,user_id,expires_at,revoked_at FROM sessions WHERE token_hash=$1', [sha(token)]);
      if (!s || s.revoked_at != null || Number(s.expires_at) <= now) return null;
      await db.run('UPDATE sessions SET last_used_at=$1 WHERE id=$2', [now, s.id]);
      return { userId: s.user_id, sessionId: s.id, expiresAt: Number(s.expires_at) };
    });
  }
  // Rotate: the presented token stops working, a fresh one with a new lifetime is returned.
  async function refresh(token) {
    const a = await authenticate(token); if (!a) throw bad('UNAUTHORIZED', 'Session expired. Please log in again.', 401);
    return store.tx(async (db) => {
      await db.run('UPDATE sessions SET revoked_at=$1 WHERE id=$2', [o.now(), a.sessionId]);
      return { userId: a.userId, ...(await newSession(db, a.userId, 'refreshed')) };
    });
  }
  const logout = (sessionId) => store.tx((db) => db.run('UPDATE sessions SET revoked_at=$1 WHERE id=$2 AND revoked_at IS NULL', [o.now(), sessionId]));
  const logoutAll = (userId) => store.tx((db) => db.run('UPDATE sessions SET revoked_at=$1 WHERE user_id=$2 AND revoked_at IS NULL', [o.now(), userId]));
  const listSessions = (userId) => store.tx((db) => db.all('SELECT id,created_at,last_used_at,expires_at,label FROM sessions WHERE user_id=$1 AND revoked_at IS NULL AND expires_at>$2 ORDER BY created_at DESC', [userId, o.now()]));
  const revokeSession = (userId, id) => store.tx((db) => db.run('UPDATE sessions SET revoked_at=$1 WHERE id=$2 AND user_id=$3 AND revoked_at IS NULL', [o.now(), id, userId]));

  /* Runs fn(ctx) as ONE atomic, serialised transaction on the player's row.
     idemKey: a repeated request with the same key returns the stored response and has no new effect. */
  async function withPlayer(userId, idemKey, fn) {
    if (idemKey !== undefined && idemKey !== null && !/^[A-Za-z0-9_-]{8,64}$/.test(String(idemKey))) throw bad('BAD_IDEMPOTENCY_KEY', 'Invalid Idempotency-Key.');
    return store.tx(async (db) => {
      const row = await db.get('SELECT coins,version,state FROM players WHERE user_id=$1' + db.lockSuffix, [userId]);
      if (!row) throw bad('NO_PLAYER', 'Player not found.', 404);
      if (idemKey) {
        const prev = await db.get('SELECT response FROM idempotency WHERE user_id=$1 AND idem_key=$2', [userId, idemKey]);
        if (prev) return Object.assign(JSON.parse(prev.response), { replayed: true });
      }
      const ctx = { coins: Number(row.coins), state: typeof row.state === 'string' ? JSON.parse(row.state) : row.state, ledger: [], now: o.now(), db, userId };
      const result = await fn(ctx);
      const pub = game.publicState(ctx); // also rolls daily/weekly periods
      await db.run('UPDATE players SET coins=$1, version=version+1, state=$2 WHERE user_id=$3 AND version=$4', [ctx.coins, JSON.stringify(ctx.state), userId, row.version])
        .then((r) => { if (r.changes !== 1) throw bad('CONFLICT', 'Concurrent update, please retry.', 409); });
      for (let i = 0; i < ctx.ledger.length; i++) {
        const l = ctx.ledger[i];
        await db.run('INSERT INTO ledger(id,user_id,delta,balance_after,reason,idem_key,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)', [rid(8), userId, l.delta, l.balance, l.reason, i === 0 ? (idemKey || null) : null, ctx.now]);
      }
      const response = { ok: true, result: result || {}, state: pub };
      if (idemKey) await db.run('INSERT INTO idempotency(user_id,idem_key,response,created_at) VALUES($1,$2,$3,$4)', [userId, idemKey, JSON.stringify(response), ctx.now]);
      return response;
    });
  }
  const getState = (userId) => withPlayer(userId, null, () => ({})).then((r) => r.state);

  // Read-only snapshot used by multiplayer to check ownership against the server collection.
  async function collectionOf(userId) {
    return store.tx(async (db) => {
      const row = await db.get('SELECT state FROM players WHERE user_id=$1', [userId]);
      if (!row) return null;
      const st = typeof row.state === 'string' ? JSON.parse(row.state) : row.state;
      return { owned: st.owned, upgrades: st.upgrades, facilities: st.facilities, managerName: st.managerName, crest: st.crest };
    });
  }

  async function redeemPromo(userId, rawCode, idemKey) {
    const code = String(rawCode == null ? '' : rawCode).trim().toUpperCase().replace(/\s+/g, '');
    if (!code || code.length > 64 || !/^[A-Z0-9_-]+$/.test(code)) throw bad('INVALID_CODE', 'Code is invalid or inactive.', 404);
    return withPlayer(userId, idemKey, async (ctx) => {
      const db = ctx.db, now = ctx.now;
      const row = await db.get('SELECT * FROM promo_codes WHERE code=$1', [code]);
      if (!row || Number(row.active) !== 1 || (row.expires_at != null && Number(row.expires_at) <= now)) throw bad('INVALID_CODE', 'Code is invalid or inactive.', 404);
      if (await db.get('SELECT 1 AS x FROM promo_redemptions WHERE code=$1 AND user_id=$2', [code, userId])) throw bad('ALREADY_REDEEMED', 'This code has already been redeemed.', 409);
      // Atomic usage counter: the WHERE clause is the limit check, so parallel requests cannot exceed max_uses.
      const upd = await db.run('UPDATE promo_codes SET uses=uses+1 WHERE code=$1 AND active=1 AND (max_uses=0 OR uses<max_uses)', [code]);
      if (upd.changes !== 1) throw bad('CODE_EXHAUSTED', 'This code has reached its usage limit.', 409);
      await db.run('INSERT INTO promo_redemptions(code,user_id,created_at) VALUES($1,$2,$3)', [code, userId, now]);
      ctx.state.redeemedCodes.push(code);
      return game.applyPromoReward(ctx, row);
    });
  }

  async function seedPromos(list) {
    await store.tx(async (db) => {
      for (const p of list) await db.run('INSERT INTO promo_codes(code,reward_type,reward_value,max_uses,uses,expires_at,active) VALUES($1,$2,$3,$4,0,$5,1) ON CONFLICT (code) DO NOTHING',
        [p.code, p.type, String(p.value), p.maxUses || 0, p.expiresAt || null]);
    });
  }
  const resetPlayer = (userId) => withPlayer(userId, null, (ctx) => {
    const p = game.newPlayer(); p.state.managerName = ctx.state.managerName; p.state.redeemedCodes = ctx.state.redeemedCodes; // redeemed promo codes stay redeemed
    ctx.state = p.state; ctx.coins = p.coins; ctx.ledger.push({ delta: 0, reason: 'reset', balance: ctx.coins }); return {};
  });

  // housekeeping: stored idempotent responses older than 3 days and long-dead sessions are no longer needed
  const cleanup = () => store.tx(async (db) => { const now = o.now(); await db.run('DELETE FROM idempotency WHERE created_at<$1', [now - 3 * 24 * 3600e3]); await db.run('DELETE FROM sessions WHERE expires_at<$1 OR (revoked_at IS NOT NULL AND revoked_at<$1)', [now - 24 * 3600e3]); });

  return { cleanup, register, login, authenticate, refresh, logout, logoutAll, listSessions, revokeSession, withPlayer, getState, collectionOf, redeemPromo, seedPromos, resetPlayer, store, rnd: () => o.random };
}
module.exports = { createService, ApiError };
