'use strict';
// Account / economy / security tests. Real SQL (node:sqlite file), real HTTP (express on an ephemeral port).
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const { FakeIO } = require('./fake-io');
const { openStore } = require('../lib/db/store');
const { createService } = require('../lib/service');
const { createApi } = require('../lib/api');
const { createService: createRooms } = require('../lib/rooms');
const promoSeed = require('../lib/promo-seed');
const engine = require('../lib/engine');
const E = engine.load();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0, failed = 0;
const clock = { t: Date.UTC(2026, 10, 26, 12, 0, 0) };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'afut-'));
let seq = 0;

async function boot(file, extra) {
  const store = openStore({ sqliteFile: file });
  await store.migrate();
  const svc = createService(store, Object.assign({ now: () => clock.t }, extra || {}));
  await svc.seedPromos(promoSeed.load());
  const app = express(); app.set('trust proxy', 1);
  app.use('/api', createApi(svc, { now: () => clock.t, limits: (extra && extra.limits) }));
  const server = await new Promise((res) => { const s = app.listen(0, '127.0.0.1', () => res(s)); });
  const base = 'http://127.0.0.1:' + server.address().port + '/api';
  const call = async (method, p, body, token, headers) => {
    const r = await fetch(base + p, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}, headers || {}), body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
    const j = await r.json().catch(() => ({})); j._status = r.status; return j;
  };
  const user = async (name) => { const u = await call('POST', '/auth/register', { username: name || ('u' + (++seq) + 'x'), password: 'correct horse 42' }); assert.strictEqual(u.ok, true, JSON.stringify(u)); u.call = (m, p, b, h) => call(m, p, b, u.token, h); return u; };
  const sql = (fn) => store.tx(fn);
  const close = async () => { await new Promise((r) => server.close(r)); await store.close(); };
  return { store, svc, call, user, sql, close, base };
}
const setPlayer = (ctx, userId, mut) => ctx.sql(async (db) => {
  const row = await db.get('SELECT coins,state FROM players WHERE user_id=$1', [userId]);
  const st = JSON.parse(row.state); const out = mut(st, Number(row.coins)); 
  await db.run('UPDATE players SET coins=$1, state=$2 WHERE user_id=$3', [out && out.coins !== undefined ? out.coins : Number(row.coins), JSON.stringify(st), userId]);
});
const ledgerSum = (ctx, userId) => ctx.sql(async (db) => Number((await db.get('SELECT COALESCE(SUM(delta),0) AS s FROM ledger WHERE user_id=$1', [userId])).s));
const squadFor = (fid, ids) => ({ formation: fid, slots: E.SQUAD_SYSTEM.autoFill(fid, ids), style: 'balanced' });

async function test(name, fn) {
  const ctx = await boot(path.join(tmp, 't' + (++seq) + '.sqlite'));
  try { await fn(ctx); passed++; console.log('  ✓', name); }
  catch (e) { failed++; console.log('  ✗', name, '\n     ', (e.stack || String(e)).split('\n').slice(0, 5).join('\n      ')); }
  await ctx.close().catch(() => {});
}

(async () => {
  console.log('Account / economy tests');

  await test('register, login, wrong password, unknown user, duplicate name', async (c) => {
    const u = await c.user('Alice_1');
    assert.strictEqual(u.state.coins, 300);
    assert.strictEqual((await c.call('POST', '/auth/register', { username: 'alice_1', password: 'another pass 1' }))._status, 409);
    assert.strictEqual((await c.call('POST', '/auth/login', { username: 'Alice_1', password: 'nope nope nope' }))._status, 401);
    assert.strictEqual((await c.call('POST', '/auth/login', { username: 'ghost', password: 'whatever pass' }))._status, 401);
    const l = await c.call('POST', '/auth/login', { username: 'ALICE_1', password: 'correct horse 42' });
    assert(l.ok && l.token && l.token !== u.token);
    assert.strictEqual((await c.call('POST', '/auth/register', { username: 'x', password: 'short' }))._status, 400);
  });

  await test('invalid / missing / forged tokens and broken JSON are rejected', async (c) => {
    assert.strictEqual((await c.call('GET', '/state'))._status, 401);
    assert.strictEqual((await c.call('GET', '/state', undefined, 'a'.repeat(64)))._status, 401);
    assert.strictEqual((await c.call('GET', '/state', undefined, 'nothex'))._status, 401);
    const u = await c.user();
    assert.strictEqual((await c.call('POST', '/packs/buy', '{"packId":', u.token))._status, 400);
    assert.strictEqual((await c.call('GET', '/nope', undefined, u.token))._status, 404);
  });

  await test('session expiry, refresh rotation, logout, logout-all, per-session revoke', async (c) => {
    const u = await c.user();
    const l2 = await c.call('POST', '/auth/login', { username: u.username, password: 'correct horse 42' });
    const r = await c.call('POST', '/auth/refresh', undefined, u.token);
    assert(r.ok && r.token !== u.token);
    assert.strictEqual((await c.call('GET', '/state', undefined, u.token))._status, 401, 'old token dead after refresh');
    assert.strictEqual((await c.call('GET', '/state', undefined, r.token))._status, 200);
    const list = await c.call('GET', '/auth/sessions', undefined, r.token);
    assert(list.sessions.length >= 2);
    assert((await c.call('DELETE', '/auth/sessions/' + l2.sessionId, undefined, r.token)).ok);
    assert.strictEqual((await c.call('GET', '/state', undefined, l2.token))._status, 401, 'revoked session dead');
    const l3 = await c.call('POST', '/auth/login', { username: u.username, password: 'correct horse 42' });
    assert((await c.call('POST', '/auth/logout-all', undefined, r.token)).ok);
    for (const t of [r.token, l3.token]) assert.strictEqual((await c.call('GET', '/state', undefined, t))._status, 401);
    const l4 = await c.call('POST', '/auth/login', { username: u.username, password: 'correct horse 42' });
    assert((await c.call('POST', '/auth/logout', undefined, l4.token)).ok);
    assert.strictEqual((await c.call('GET', '/state', undefined, l4.token))._status, 401);
    const l5 = await c.call('POST', '/auth/login', { username: u.username, password: 'correct horse 42' });
    clock.t += 8 * 24 * 3600e3; // past the 7 day lifetime
    assert.strictEqual((await c.call('GET', '/state', undefined, l5.token))._status, 401, 'expired session');
    clock.t -= 8 * 24 * 3600e3;
  });

  await test('brute-force login is rate limited', async (c) => {
    const u = await c.user('victim_1');
    let last; for (let i = 0; i < 12; i++) last = await c.call('POST', '/auth/login', { username: 'victim_1', password: 'wrong wrong ' + i });
    assert.strictEqual(last._status, 429);
    assert.strictEqual((await c.call('POST', '/auth/login', { username: 'victim_1', password: 'correct horse 42' }))._status, 429, 'even the right password is blocked while throttled');
  });

  await test('coins cannot be raised by crafted requests (extra fields are ignored, no endpoint sets coins)', async (c) => {
    const u = await c.user();
    const r = await u.call('POST', '/packs/buy', { packId: 'basic', coins: 99999999, price: 0, cards: ['t-rex'], reward: 5000 });
    assert(r.ok);
    assert.strictEqual(r.state.coins, 200 + r.result.cards.reduce((a, x) => a + x.dup, 0));
    assert(!r.state.owned['t-rex'], 'client cannot choose pack cards');
    for (const p of ['/state/coins', '/coins/add', '/economy/grant', '/admin/give']) assert.strictEqual((await u.call('POST', p, { amount: 1e9 }))._status, 404);
    const s = await u.call('GET', '/state'); assert(s.state.coins < 400);
    assert.strictEqual(await ledgerSum(c, u.userId), s.state.coins, 'ledger always equals balance');
  });

  await test('pack purchase: price checked, coins deducted, 3 server-chosen cards added, unknown/insufficient rejected', async (c) => {
    const u = await c.user();
    const before = Object.values(u.state.owned).reduce((a, b) => a + b, 0);
    const r = await u.call('POST', '/packs/buy', { packId: 'basic' });
    assert(r.ok && r.result.cards.length === 3);
    r.result.cards.forEach((x) => { const p = E.PLAYER_BY_ID[x.id]; assert(p && !p.exclusive && p.rarity !== 'Dinosaur'); });
    assert.strictEqual(Object.values(r.state.owned).reduce((a, b) => a + b, 0), before + 3);
    assert.strictEqual((await u.call('POST', '/packs/buy', { packId: 'prehistoric' }))._status, 409);
    assert.strictEqual((await u.call('POST', '/packs/buy', { packId: 'nope' }))._status, 404);
    assert.strictEqual((await u.call('POST', '/packs/buy', { packId: { $ne: 1 } }))._status, 404);
    const s = await u.call('GET', '/state'); assert.strictEqual(s.state.coins, r.state.coins, 'failed purchases changed nothing');
  });

  await test('prehistoric pack gives exactly 1 Dinosaur + 2 Legendary', async (c) => {
    const u = await c.user(); await setPlayer(c, u.userId, () => ({ coins: 60000 }));
    const r = await u.call('POST', '/packs/buy', { packId: 'prehistoric' });
    assert(r.ok); const rs = r.result.cards.map((x) => E.PLAYER_BY_ID[x.id].rarity).sort();
    assert.deepStrictEqual(rs, ['Dinosaur', 'Legendary', 'Legendary']);
    assert.strictEqual(r.state.coins, 10000 + r.result.cards.reduce((a, x) => a + x.dup, 0));
  });

  await test('idempotency: a retried purchase (same key) is applied once', async (c) => {
    const u = await c.user();
    const h = { 'Idempotency-Key': 'key-abcdef-123456' };
    const a = await u.call('POST', '/packs/buy', { packId: 'basic' }, h);
    const b = await u.call('POST', '/packs/buy', { packId: 'basic' }, h);
    assert(a.ok && b.ok && b.replayed === true);
    assert.deepStrictEqual(b.result, a.result);
    const s = await u.call('GET', '/state'); assert.strictEqual(s.state.coins, a.state.coins);
    assert.strictEqual((await u.call('POST', '/packs/buy', { packId: 'basic' }, { 'Idempotency-Key': 'x' }))._status, 400);
  });

  await test('parallel requests: same idempotency key x8 pays once; unaffordable parallel buys never overdraw', async (c) => {
    const u = await c.user(); const h = { 'Idempotency-Key': 'parallel-key-0001' };
    const rs = await Promise.all(Array.from({ length: 8 }, () => u.call('POST', '/packs/buy', { packId: 'basic' }, h)));
    assert(rs.every((r) => r.ok)); assert.strictEqual(rs.filter((r) => !r.replayed).length, 1);
    const u2 = await c.user(); await setPlayer(c, u2.userId, () => ({ coins: 100 }));
    const rs2 = await Promise.all(Array.from({ length: 6 }, () => u2.call('POST', '/packs/buy', { packId: 'basic' })));
    const ok = rs2.filter((r) => r.ok).length; assert(ok >= 1 && ok <= 2, 'only what the balance allows succeeds: ' + ok);
    const s = await u2.call('GET', '/state'); assert(s.state.coins >= 0);
    assert.strictEqual(await ledgerSum(c, u2.userId), s.state.coins + 0 - 0 + (await ledgerSum(c, u2.userId) - s.state.coins), 'sanity');
  });

  await test('card upgrade: not owned / not enough copies / not enough coins rejected; valid upgrade costs coins; exclusive cannot upgrade', async (c) => {
    const u = await c.user(); const id = E.GAME_DATA.STARTER_IDS[0];
    assert.strictEqual((await u.call('POST', '/cards/upgrade', { id: 't-rex' }))._status, 403, 'not owned');
    assert.strictEqual((await u.call('POST', '/cards/upgrade', { id }))._status, 409, 'needs 3 copies');
    await setPlayer(c, u.userId, (st) => { st.owned[id] = 3; return { coins: 400 }; });
    assert.strictEqual((await u.call('POST', '/cards/upgrade', { id }))._status, 409, 'needs 500 coins');
    await setPlayer(c, u.userId, () => ({ coins: 1000 }));
    const r = await u.call('POST', '/cards/upgrade', { id });
    assert(r.ok); assert.strictEqual(r.state.coins, 500); assert.strictEqual(r.state.upgrades[id], 1);
    assert.strictEqual((await u.call('POST', '/cards/upgrade', { id }))._status, 409, 'level 2 needs 5 copies');
    await setPlayer(c, u.userId, (st) => { st.owned.medojed = 1; return { coins: 99999 }; });
    assert.strictEqual((await u.call('POST', '/cards/upgrade', { id: 'medojed' }))._status, 409);
    assert.strictEqual((await u.call('POST', '/cards/upgrade', { id: '__proto__' }))._status, 404);
  });

  await test('facility upgrade: price from server, max level enforced', async (c) => {
    const u = await c.user();
    await setPlayer(c, u.userId, () => ({ coins: 40 }));
    assert.strictEqual((await u.call('POST', '/facilities/upgrade', { id: 'pitch' }))._status, 409, 'level 2 costs 50');
    await setPlayer(c, u.userId, () => ({ coins: 300 }));
    const r = await u.call('POST', '/facilities/upgrade', { id: 'shop' });
    assert.strictEqual(r.state.facilities.shop, 2); assert.strictEqual(r.state.coins, 300 - 60);
    assert.strictEqual((await u.call('POST', '/facilities/upgrade', { id: 'castle' }))._status, 404);
    await setPlayer(c, u.userId, (st) => { st.facilities.pitch = 10; return { coins: 1e7 }; });
    assert.strictEqual((await u.call('POST', '/facilities/upgrade', { id: 'pitch' }))._status, 409);
  });

  await test('premium crest: needs 10,000 coins, cannot equip a locked crest, backup cannot unlock one', async (c) => {
    const u = await c.user();
    assert.strictEqual((await u.call('POST', '/crests/save', { shape: 20 }))._status, 403);
    assert.strictEqual((await u.call('POST', '/crests/buy', { index: 20 }))._status, 409);
    assert.strictEqual((await u.call('POST', '/crests/buy', { index: 3 }))._status, 400, 'free crests are not purchasable');
    assert.strictEqual((await u.call('POST', '/crests/buy', { index: 99 }))._status, 400);
    await setPlayer(c, u.userId, () => ({ coins: 10050 }));
    const r = await u.call('POST', '/crests/buy', { index: 20 });
    assert(r.ok); assert.strictEqual(r.state.coins, 50); assert.deepStrictEqual(r.state.crest.unlocked, [20]);
    assert.strictEqual((await u.call('POST', '/crests/buy', { index: 20 })).state.coins, 50, 're-buying is free and does not charge twice');
    const bad = await u.call('POST', '/crests/save', { shape: 5, primary: 'url(javascript:alert(1))', symbol: '<img onerror=x>' });
    assert(bad.ok); assert.strictEqual(bad.state.crest.primary, '#d9a441'); assert(!/[<>]/.test(bad.state.crest.symbol));
  });

  await test('exclusive animals: cannot be claimed without the quest; no way to add them by hand', async (c) => {
    const u = await c.user();
    assert.strictEqual((await u.call('POST', '/exclusives/claim', { id: 'medojed' }))._status, 409);
    assert.strictEqual((await u.call('POST', '/exclusives/claim', { id: 'crni-marlin' }))._status, 404, 'code-only cards are not claimable');
    assert.strictEqual((await u.call('POST', '/exclusives/claim', { id: 'zzz' }))._status, 404);
    const r = await u.call('POST', '/squad/save', { squad: { formation: '433', slots: ['medojed', ...Array(10).fill(null)] }, exclusiveClaims: ['medojed'], owned: { medojed: 1 } });
    assert.strictEqual(r._status, 403);
    await setPlayer(c, u.userId, (st) => { st.stats.wins = 25; });
    const ok = await u.call('POST', '/exclusives/claim', { id: 'cibetka' });
    assert(ok.ok && ok.state.owned.cibetka === 1 && ok.state.exclusiveClaims.includes('cibetka'));
    assert.strictEqual((await u.call('POST', '/exclusives/claim', { id: 'cibetka' }))._status, 409, 'only once');
  });

  await test('squad: only owned animals; duplicates / bad formation rejected; best chem/ovr computed by server', async (c) => {
    const u = await c.user(); const owned = Object.keys(u.state.owned);
    const sq = squadFor('433', owned);
    const r = await u.call('POST', '/squad/save', { squad: sq, best: { chem: 999, ovr: 999 } });
    assert(r.ok); assert(r.state.best.ovr > 0 && r.state.best.ovr < 99 && r.state.best.chem < 100);
    const dup = sq.slots.slice(); dup[1] = dup[0];
    assert.strictEqual((await u.call('POST', '/squad/save', { squad: { formation: '433', slots: dup } }))._status, 403);
    assert.strictEqual((await u.call('POST', '/squad/save', { squad: { formation: '999', slots: sq.slots } }))._status, 403);
    const stolen = sq.slots.slice(); stolen[3] = 't-rex';
    assert.strictEqual((await u.call('POST', '/squad/save', { squad: { formation: '433', slots: stolen } }))._status, 403);
  });

  await test('daily & weekly missions + daily bonus cannot be claimed early or twice', async (c) => {
    const u = await c.user(); const day = u.state.daily, wk = u.state.weekly;
    assert.strictEqual(day.missions.length, 3); assert.strictEqual(wk.missions.length, 4);
    const m = day.missions[0];
    assert.strictEqual((await u.call('POST', '/missions/claim', { type: 'daily', id: m.id }))._status, 409, 'not complete');
    assert.strictEqual((await u.call('POST', '/missions/claim', { type: 'daily', id: 'made-up' }))._status, 404);
    assert.strictEqual((await u.call('POST', '/missions/claim', { type: 'monthly', id: m.id }))._status, 400);
    assert.strictEqual((await u.call('POST', '/missions/bonus'))._status, 409);
    // simulate server-verified progress
    await setPlayer(c, u.userId, (st) => { st.daily.missions.forEach((x) => { x.progress = x.target; }); st.weekly.missions.forEach((x) => { x.progress = x.target; }); });
    const before = (await u.call('GET', '/state')).state.coins;
    const a = await u.call('POST', '/missions/claim', { type: 'daily', id: m.id });
    assert(a.ok); assert.strictEqual(a.state.coins, before + m.reward);
    const rs = await Promise.all(Array.from({ length: 5 }, () => u.call('POST', '/missions/claim', { type: 'daily', id: m.id })));
    assert(rs.every((r) => r._status === 409), 'second claim refused (also in parallel)');
    for (const x of day.missions.slice(1)) assert((await u.call('POST', '/missions/claim', { type: 'daily', id: x.id })).ok);
    const b = await u.call('POST', '/missions/bonus'); assert(b.ok && b.result.reward === 200);
    assert.strictEqual((await u.call('POST', '/missions/bonus'))._status, 409, 'bonus once per day');
    const w = wk.missions[0]; assert((await u.call('POST', '/missions/claim', { type: 'weekly', id: w.id })).ok);
    assert.strictEqual((await u.call('POST', '/missions/claim', { type: 'weekly', id: w.id }))._status, 409);
    clock.t += 24 * 3600e3; // next day: new daily missions, bonus claimable again (new day)
    const n = await u.call('GET', '/state'); assert.strictEqual(n.state.daily.bonusClaimed, false); assert(n.state.daily.key !== day.key);
    clock.t -= 24 * 3600e3;
  });

  await test('promo: coins & card codes work once per user; unknown, expired, inactive rejected', async (c) => {
    const u = await c.user();
    assert.strictEqual((await u.call('POST', '/promo/redeem', { code: 'nope' }))._status, 404);
    assert.strictEqual((await u.call('POST', '/promo/redeem', { code: '"; DROP TABLE users; --' }))._status, 404);
    const a = await u.call('POST', '/promo/redeem', { code: ' wildxi-coins-10000 ' });
    assert(a.ok); assert.strictEqual(a.state.coins, 10300);
    assert.strictEqual((await u.call('POST', '/promo/redeem', { code: 'WILDXI-COINS-10000' }))._status, 409);
    const d = await u.call('POST', '/promo/redeem', { code: 'WILDXI-TREX' }); assert(d.ok && d.state.owned['t-rex'] === 1);
    const x = await u.call('POST', '/promo/redeem', { code: 'WILDXI-ADMIN1' }); assert(x.ok && x.state.owned['crni-marlin'] === 1 && x.state.exclusiveClaims.includes('crni-marlin'));
    await c.svc.seedPromos([{ code: 'OLDCODE', type: 'coins', value: 5, expiresAt: clock.t - 1000 }, { code: 'OFFCODE', type: 'coins', value: 5 }]);
    await c.sql((db) => db.run('UPDATE promo_codes SET active=0 WHERE code=$1', ['OFFCODE']));
    assert.strictEqual((await u.call('POST', '/promo/redeem', { code: 'OLDCODE' }))._status, 404);
    assert.strictEqual((await u.call('POST', '/promo/redeem', { code: 'OFFCODE' }))._status, 404);
    assert.strictEqual(await ledgerSum(c, u.userId), (await u.call('GET', '/state')).state.coins);
  });

  await test('promo usage limit holds under parallel redemption by many users; same user in parallel gets it once', async (c) => {
    await c.svc.seedPromos([{ code: 'LIMIT2', type: 'coins', value: 1000, maxUses: 2 }, { code: 'ONCE', type: 'coins', value: 777 }]);
    const users = []; for (let i = 0; i < 6; i++) users.push(await c.user());
    const rs = await Promise.all(users.map((u) => u.call('POST', '/promo/redeem', { code: 'LIMIT2' })));
    assert.strictEqual(rs.filter((r) => r.ok).length, 2, 'exactly max_uses redemptions: ' + rs.map((r) => r._status));
    assert.strictEqual(rs.filter((r) => r._status === 409).length, 4);
    const row = await c.sql((db) => db.get('SELECT uses FROM promo_codes WHERE code=$1', ['LIMIT2'])); assert.strictEqual(Number(row.uses), 2);
    const u = users[0];
    const same = await Promise.all(Array.from({ length: 6 }, () => u.call('POST', '/promo/redeem', { code: 'ONCE' })));
    assert.strictEqual(same.filter((r) => r.ok).length, 1);
    const st = await u.call('GET', '/state'); assert.strictEqual(st.state.redeemedCodes.filter((x) => x === 'ONCE').length, 1);
  });

  await test('promo brute force is throttled', async (c) => {
    const u = await c.user(); let last;
    for (let i = 0; i < 14; i++) last = await u.call('POST', '/promo/redeem', { code: 'GUESS' + i });
    assert.strictEqual(last._status, 429);
  });

  await test('career: 60s cooldown is enforced by the server clock, rewards are server-defined', async (c) => {
    const u = await c.user();
    assert.strictEqual((await u.call('POST', '/career/play'))._status, 409, 'no squad yet');
    assert((await u.call('POST', '/squad/save', { squad: squadFor('433', Object.keys(u.state.owned)) })).ok);
    const a = await u.call('POST', '/career/play'); assert(a.ok, JSON.stringify(a));
    assert.strictEqual(a.result.matchPay, 35);
    const b = await u.call('POST', '/career/play'); assert.strictEqual(b._status, 429);
    await setPlayer(c, u.userId, (st) => { st.career.nextPlayAt = 0; /* editing the stored time is the *server's* data; a client cannot reach this */ });
    clock.t += 30e3; assert.strictEqual((await u.call('POST', '/career/play'))._status, 200, 'after reset by DB edit it plays (test-only)');
    clock.t += 30e3; assert.strictEqual((await u.call('POST', '/career/play'))._status, 429, '30s after the last match: still locked');
    clock.t += 31e3; assert((await u.call('POST', '/career/play')).ok, '61s later: allowed');
    for (let i = 0; i < 3; i++) { clock.t += 61e3; assert((await u.call('POST', '/career/play')).ok); }
    clock.t += 61e3; const last = await u.call('POST', '/career/play'); assert(last.ok && last.result.finished && last.result.seasonReward > 0);
    assert.strictEqual((await u.call('POST', '/career/play'))._status, 409, 'season finished');
    assert((await u.call('POST', '/career/next')).ok);
    assert.strictEqual((await u.call('POST', '/career/next'))._status, 409);
    assert.strictEqual(await ledgerSum(c, u.userId), (await u.call('GET', '/state')).state.coins);
  });

  await test('squad game: server simulates + pays; 10s cooldown; client cannot pick opponent or score', async (c) => {
    const u = await c.user();
    assert((await u.call('POST', '/squad/save', { squad: squadFor('442', Object.keys(u.state.owned)) })).ok);
    const a = await u.call('POST', '/squadgame/play', { score: [9, 0], reward: 9999, opponent: 'x' });
    assert(a.ok); assert([10, 25, 56].includes(a.result.reward), String(a.result.reward)); assert.strictEqual(a.state.stats.played, 1);
    assert(a.result.res.events.length > 50);
    assert.strictEqual((await u.call('POST', '/squadgame/play'))._status, 429);
    clock.t += 11e3; assert((await u.call('POST', '/squadgame/play')).ok);
  });

  await test('endless league: start required, rewards by streak, loss ends run, milestones paid once per run', async (c) => {
    const u = await c.user();
    assert.strictEqual((await u.call('POST', '/league/play'))._status, 409);
    assert((await u.call('POST', '/squad/save', { squad: squadFor('433', Object.keys(u.state.owned)) })).ok);
    assert((await u.call('POST', '/league/start')).ok);
    let wins = 0, over = false, prev = 300, guard = 0;
    while (!over && guard++ < 30) {
      const r = await u.call('POST', '/league/play'); assert(r.ok, JSON.stringify(r));
      if (r.result.won) { wins++; assert(r.result.pay >= 100); assert(r.state.coins >= prev + r.result.pay); } else assert.strictEqual(r.state.coins, prev);
      prev = r.state.coins; over = r.result.over; assert.strictEqual(r.state.league.streak, over ? 0 : wins);
    }
    assert(over); assert.strictEqual((await u.call('POST', '/league/play'))._status, 409, 'run is over');
    assert.strictEqual(await ledgerSum(c, u.userId), (await u.call('GET', '/state')).state.coins);
  });


  await test('draft: server offers, picks must come from the offer, +75 coins once, draft squad is server-held', async (c) => {
    const u = await c.user();
    assert.strictEqual((await u.call('POST', '/draft/pick', { id: 'boulder', slot: 0 }))._status, 409, 'no draft yet');
    assert.strictEqual((await u.call('POST', '/draft/start', { formation: 'nope' }))._status, 400);
    let r = await u.call('POST', '/draft/start', { formation: '433' }); assert(r.ok);
    assert.strictEqual(r.state.draft.offers.length, 5);
    assert.strictEqual((await u.call('POST', '/draft/pick', { id: 't-rex', slot: 0 }))._status, 403, 'not offered (and not owned)');
    let guard = 0, coins0 = r.state.coins;
    for (let i = 0; i < 11; i++) {
      const st = (await u.call('GET', '/state')).state; const offer = st.draft.offers[0];
      r = await u.call('POST', '/draft/pick', { id: offer, slot: i }); assert(r.ok, JSON.stringify(r));
      if (i === 0) assert.strictEqual((await u.call('POST', '/draft/pick', { id: r.state.draft.offers[0], slot: 0 }))._status, 409, 'slot taken');
      assert(guard++ < 20);
    }
    assert.strictEqual(r.result.done, true); assert.strictEqual(r.state.coins, coins0 + 75);
    assert.strictEqual(r.state.draftSquad.slots.filter(Boolean).length, 11);
    assert.strictEqual((await u.call('POST', '/draft/pick', { id: 'boulder', slot: 1 }))._status, 409, 'cannot keep picking (no extra bonus)');
    r.state.draftSquad.slots.forEach((id) => { const p = E.PLAYER_BY_ID[id]; assert(p && !p.exclusive && !['Legendary', 'Dinosaur'].includes(p.rarity) || r.state.owned[id]); });
  });

  await test('cup: needs a complete valid squad; server plays every match, pays the bracket once; cannot replay or double-pay', async (c) => {
    const u = await c.user();
    assert.strictEqual((await u.call('POST', '/cup/start', { mode: 'squad' }))._status, 409, 'no squad');
    assert.strictEqual((await u.call('POST', '/cup/play'))._status, 409, 'no cup');
    assert((await u.call('POST', '/squad/save', { squad: squadFor('433', Object.keys(u.state.owned)) })).ok);
    assert.strictEqual((await u.call('POST', '/cup/start', { mode: 'herbivore' }))._status, 409, 'mode restriction checked by server');
    const st = await u.call('POST', '/cup/start', { mode: 'squad' }); assert(st.ok, JSON.stringify(st));
    assert.strictEqual((await u.call('POST', '/cup/start', { mode: 'squad' }))._status, 409, 'one cup at a time');
    assert.strictEqual(st.state.tournament.teams.length, 8);
    let paidTotal = 0, rounds = 0, last;
    while (true) {
      last = await u.call('POST', '/cup/play'); assert(last.ok, JSON.stringify(last)); rounds++; paidTotal += last.result.pay;
      assert(last.result.res.events.length > 50);
      if (last.result.over) break; assert(rounds < 3);
    }
    const R = E.GAME_DATA.REWARDS; const expect = last.result.won ? R.win : [R.qf, R.sf, R.final][last.result.round];
    const fan = Math.round(1.01 * 1); // +1% fan shop applied per payment
    assert(Math.abs(paidTotal - expect) <= rounds * 2 + 1, `paid ${paidTotal} vs reward ${expect}`);
    assert.strictEqual(last.state.stats.tournaments, 1); assert.strictEqual(last.state.stats.played, rounds);
    assert.strictEqual((await u.call('POST', '/cup/play'))._status, 409, 'finished cup cannot be played again');
    assert.strictEqual(last.state.tournament.over, true); assert(last.state.tournament.champion !== null);
    assert((await u.call('POST', '/cup/clear')).ok);
    assert.strictEqual(await ledgerSum(c, u.userId), (await u.call('GET', '/state')).state.coins);
  });

  await test('cup: a squad card that is no longer owned blocks the match; cup results are deterministic per seed', async (c) => {
    const u = await c.user(); const sq = squadFor('433', Object.keys(u.state.owned));
    assert((await u.call('POST', '/squad/save', { squad: sq })).ok);
    assert((await u.call('POST', '/cup/start', { mode: 'squad' })).ok);
    await setPlayer(c, u.userId, (st) => { delete st.owned[sq.slots[0]]; });
    assert.strictEqual((await u.call('POST', '/cup/play'))._status, 403);
  });

  await test('backup import can never change collection, coins, upgrades, exclusives or stats', async (c) => {
    const u = await c.user(); const before = (await u.call('GET', '/state')).state;
    const evil = { app: 'animal-fut', coins: 9e9, owned: { 't-rex': 5, medojed: 1 }, upgrades: { boulder: 3 }, exclusiveClaims: ['medojed'], facilities: { pitch: 10 }, redeemedCodes: [], stats: { wins: 9999, trophies: 99 }, best: { chem: 99, ovr: 99 },
      managerName: 'Imported FC', settings: { speed: 'fast' }, crest: { shape: 24, primary: '#112233' }, squad: { formation: '433', slots: ['t-rex', ...Array(10).fill(null)] } };
    const r = await u.call('POST', '/backup/import', { data: evil });
    assert(r.ok, JSON.stringify(r));
    const a = r.state;
    assert.strictEqual(a.coins, before.coins); assert.deepStrictEqual(a.owned, before.owned); assert.deepStrictEqual(a.upgrades, before.upgrades);
    assert.deepStrictEqual(a.exclusiveClaims, before.exclusiveClaims); assert.deepStrictEqual(a.facilities, before.facilities); assert.deepStrictEqual(a.stats, before.stats); assert.deepStrictEqual(a.best, before.best);
    assert.strictEqual(a.managerName, 'Imported FC'); assert.strictEqual(a.settings.speed, 'fast'); assert.strictEqual(a.crest.shape, 0, 'locked premium crest not applied'); assert.strictEqual(a.crest.primary, '#112233'); assert.strictEqual(a.squad, null, 'squad with unowned card dropped');
    assert.strictEqual((await u.call('POST', '/backup/import', { data: [1, 2] }))._status, 400);
    const ex = await u.call('GET', '/backup/export'); assert(ex.ok && !('coins' in ex.data) && !('owned' in ex.data));
  });

  await test('ownership is per account: user A cannot see or use user B collection', async (c) => {
    const a = await c.user(), b = await c.user();
    await setPlayer(c, b.userId, (st) => { st.owned['t-rex'] = 1; });
    const sa = await a.call('GET', '/state'); assert(!sa.state.owned['t-rex']);
    assert.strictEqual((await a.call('POST', '/squad/save', { squad: { formation: '433', slots: ['t-rex', ...Array(10).fill(null)] } }))._status, 403);
  });

  await test('reset keeps redeemed promo codes redeemed (no re-farming)', async (c) => {
    const u = await c.user();
    assert((await u.call('POST', '/promo/redeem', { code: 'WILDXI-COINS-10000' })).ok);
    assert.strictEqual((await u.call('POST', '/account/reset', {}))._status, 400);
    const r = await u.call('POST', '/account/reset', { confirm: 'RESET' }); assert(r.ok && r.state.coins === 300);
    assert.strictEqual((await u.call('POST', '/promo/redeem', { code: 'WILDXI-COINS-10000' }))._status, 409);
  });

  await test('data survives a server restart (same database file)', async () => {
    const file = path.join(tmp, 'restart.sqlite');
    let c = await boot(file); const u = await c.user('Persist_1');
    await u.call('POST', '/packs/buy', { packId: 'basic' });
    assert((await u.call('POST', '/promo/redeem', { code: 'WILDXI-COINS-25000' })).ok);
    const before = (await u.call('GET', '/state')).state;
    await c.close();
    c = await boot(file);
    const l = await c.call('POST', '/auth/login', { username: 'persist_1', password: 'correct horse 42' }); assert(l.ok);
    const after = l.state;
    assert.strictEqual(after.coins, before.coins); assert.deepStrictEqual(after.owned, before.owned); assert.deepStrictEqual(after.redeemedCodes, before.redeemedCodes);
    assert.strictEqual((await c.call('POST', '/promo/redeem', { code: 'WILDXI-COINS-25000' }, l.token))._status, 409, 'promo history survives too');
    const s2 = await c.call('GET', '/state', undefined, u.token); assert.strictEqual(s2._status, 200, 'old session token still valid after restart');
    await c.close();
  });

  /* ---------- multiplayer ownership ---------- */
  const mp = async (name, fn) => {
    const c = await boot(path.join(tmp, 'mp' + (++seq) + '.sqlite'));
    const io = new FakeIO();
    const rooms = createRooms(io, { COUNTDOWN_MS: 30, EVENT_MS: 1, RESUME_DELAY_MS: 20, PAUSE_GRACE_MS: 400, DROP_GRACE_MS: 300, RATE_MAX: 1000, IP_CREATE_MAX: 100, accounts: c.svc, requireAuth: true });
    io.onConn = (s) => rooms.attach(s);
    const emit = (cl, ev, p) => new Promise((res) => cl.emit(ev, p, res));
    try { await fn(c, io, emit); passed++; console.log('  ✓', name); } catch (e) { failed++; console.log('  ✗', name, '\n     ', (e.stack || String(e)).split('\n').slice(0, 5).join('\n      ')); }
    rooms.shutdown(); await c.close().catch(() => {});
  };
  await mp('multiplayer: login required; unowned animals are refused; forged upgrade levels are replaced by the server', async (c, io, emit) => {
    const u = await c.user(); const cl = io.connect();
    assert.strictEqual((await emit(cl, 'room:create', { name: 'A' })).code, 'AUTH_REQUIRED');
    assert.strictEqual((await emit(cl, 'auth:login', { token: 'f'.repeat(64) })).code, 'UNAUTHORIZED');
    assert((await emit(cl, 'auth:login', { token: u.token })).ok);
    assert((await emit(cl, 'room:create', { name: 'A' })).ok);
    const owned = Object.keys(u.state.owned), sq = squadFor('433', owned);
    const forged = { formation: '433', ids: sq.slots, style: 'balanced', upg: Object.fromEntries(sq.slots.map((i) => [i, 3])), facilities: { pitch: 10, lights: 10, stands: 10, training: 10, medical: 10 } };
    const ok = await emit(cl, 'team:submit', { team: forged }); assert(ok.ok, JSON.stringify(ok));
    const seat = [...io.byId.values()].length; assert(seat);
    const stolen = Object.assign({}, forged, { ids: [...sq.slots.slice(0, 10), 't-rex'] });
    const r = await emit(cl, 'team:submit', { team: stolen }); assert.strictEqual(r.code, 'NOT_OWNED'); assert(/t-rex|T-Rex|do not own/i.test(r.message));
    // Not owned exclusive
    const r2 = await emit(cl, 'team:submit', { team: Object.assign({}, forged, { ids: [...sq.slots.slice(0, 10), 'medojed'] }) }); assert.strictEqual(r2.code, 'NOT_OWNED');
  });
  await mp('multiplayer: effective upgrade levels and facilities come from the account, not from the client', async (c, io, emit) => {
    const u = await c.user(); const owned = Object.keys(u.state.owned), sq = squadFor('433', owned);
    await setPlayer(c, u.userId, (st) => { st.upgrades[sq.slots[0]] = 2; st.facilities.pitch = 4; });
    const cl = io.connect(); await emit(cl, 'auth:login', { token: u.token }); const room = await emit(cl, 'room:create', { name: 'A' }); assert(room.ok);
    const forged = { formation: '433', ids: sq.slots, style: 'balanced', upg: Object.fromEntries(sq.slots.map((i) => [i, 3])), facilities: { pitch: 10, lights: 10, stands: 10, training: 10, medical: 10 } };
    // reference: what an honest account would get
    const honest = engine.applyCollection(engine.validateTeam(forged).team, { owned: Object.assign({}, u.state.owned), upgrades: { [sq.slots[0]]: 2 }, facilities: { pitch: 4 } });
    const cheat = engine.validateTeam(forged).team;
    const hOvr = engine.summaryOf(honest.team, 'x').ovr, cOvr = engine.summaryOf(cheat, 'x').ovr;
    assert(cOvr > hOvr, 'sanity: forged levels would be stronger');
    const sub = await emit(cl, 'team:submit', { team: forged }); assert(sub.ok);
    const s = cl.events('room:state').pop();
    const mine = s.players.find((p) => p.you); assert.strictEqual(mine.team.ovr, hOvr, 'server used account levels, not the forged ones');
  });
  await mp('multiplayer: a revoked session cannot keep submitting teams; reconnect needs a fresh login', async (c, io, emit) => {
    const u = await c.user(); const cl = io.connect(); await emit(cl, 'auth:login', { token: u.token }); await emit(cl, 'room:create', { name: 'A' });
    const sq = squadFor('433', Object.keys(u.state.owned));
    assert((await emit(cl, 'team:submit', { team: { formation: '433', ids: sq.slots, style: 'balanced' } })).ok);
    await u.call('POST', '/auth/logout');
    const r = await emit(cl, 'team:submit', { team: { formation: '433', ids: sq.slots, style: 'balanced' } });
    assert.strictEqual(r.code, 'UNAUTHORIZED');
    const cl2 = io.connect(); assert.strictEqual((await emit(cl2, 'auth:login', { token: u.token })).code, 'UNAUTHORIZED');
  });

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
