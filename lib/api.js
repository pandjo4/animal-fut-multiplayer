'use strict';
const express = require('express');
const game = require('./game');
const { ApiError } = game;

function createApi(service, opts) {
  const o = Object.assign({ isAllowedOrigin: () => true, now: () => Date.now() }, opts || {});
  const router = express.Router();
  const buckets = new Map();
  function hit(key, max, windowMs) {
    const now = o.now(); const b = buckets.get(key);
    if (!b || now - b.t > windowMs) { buckets.set(key, { t: now, n: 1 }); return true; }
    b.n++; return b.n <= max;
  }
  const sweep = setInterval(() => { const now = o.now(); for (const [k, b] of buckets) if (now - b.t > 15 * 60e3) buckets.delete(k); }, 60e3);
  if (sweep.unref) sweep.unref();
  const lim = Object.assign({ authIp: 20, authIpWindow: 60e3, loginFail: 8, loginFailWindow: 10 * 60e3, apiUser: 120, apiWindow: 10e3, promoFail: 10, promoWindow: 10 * 60e3 }, o.limits || {});

  router.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && !o.isAllowedOrigin(origin)) return res.status(403).json({ ok: false, code: 'ORIGIN', message: 'Origin not allowed.' });
    if (origin) { res.set('Access-Control-Allow-Origin', origin); res.set('Vary', 'Origin'); res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key'); res.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS'); res.set('Access-Control-Max-Age', '600'); }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.use(express.json({ limit: '200kb' }));

  const wrap = (fn) => (req, res) => {
    Promise.resolve().then(() => fn(req, res)).then((out) => { if (out !== undefined && !res.headersSent) res.json(out); }).catch((e) => {
      if (e instanceof ApiError) return res.status(e.status).json({ ok: false, code: e.code, message: e.message });
      if (e && e.type === 'entity.parse.failed') return res.status(400).json({ ok: false, code: 'BAD_JSON', message: 'Invalid JSON.' });
      console.error('[api]', e && e.stack || e);
      res.status(500).json({ ok: false, code: 'SERVER_ERROR', message: 'Server error.' });
    });
  };
  const ip = (req) => req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
  const authIp = (req) => { if (!hit('a:' + ip(req), lim.authIp, lim.authIpWindow)) throw new ApiError(429, 'RATE_LIMIT', 'Too many attempts. Try again in a minute.'); };
  const label = (req) => String(req.headers['user-agent'] || '').slice(0, 80);

  async function auth(req) {
    const h = String(req.headers.authorization || '');
    const m = /^Bearer ([0-9a-f]{64})$/.exec(h);
    const a = m && await service.authenticate(m[1]);
    if (!a) throw new ApiError(401, 'UNAUTHORIZED', 'Not logged in or session expired.');
    if (!hit('u:' + a.userId, lim.apiUser, lim.apiWindow)) throw new ApiError(429, 'RATE_LIMIT', 'Too many requests.');
    a.token = m[1]; return a;
  }
  const authed = (fn) => wrap(async (req, res) => fn(req, res, await auth(req)));
  const idem = (req) => req.headers['idempotency-key'] || undefined;
  const body = (req) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {});
  const act = (fn) => authed((req, res, a) => service.withPlayer(a.userId, idem(req), (ctx) => fn(ctx, body(req), req)));

  /* ---- accounts ---- */
  router.post('/auth/register', wrap(async (req) => {
    authIp(req); const b = body(req);
    const r = await service.register(b.username, b.password, label(req));
    return { ok: true, ...r, state: await service.getState(r.userId) };
  }));
  router.post('/auth/login', wrap(async (req) => {
    authIp(req); const b = body(req); const k = 'l:' + String(b.username || '').toLowerCase().slice(0, 40);
    const bucket = buckets.get(k);
    if (bucket && o.now() - bucket.t <= lim.loginFailWindow && bucket.n >= lim.loginFail) throw new ApiError(429, 'RATE_LIMIT', 'Too many failed logins. Try again later.');
    try { const r = await service.login(b.username, b.password, label(req)); buckets.delete(k); return { ok: true, ...r, state: await service.getState(r.userId) }; }
    catch (e) { if (e instanceof ApiError && e.code === 'BAD_CREDENTIALS') hit(k, 1e9, lim.loginFailWindow); throw e; }
  }));
  router.post('/auth/refresh', wrap(async (req) => {
    const m = /^Bearer ([0-9a-f]{64})$/.exec(String(req.headers.authorization || ''));
    if (!m) throw new ApiError(401, 'UNAUTHORIZED', 'Not logged in.');
    return { ok: true, ...(await service.refresh(m[1])) };
  }));
  router.post('/auth/logout', authed(async (req, res, a) => { await service.logout(a.sessionId); return { ok: true }; }));
  router.post('/auth/logout-all', authed(async (req, res, a) => { await service.logoutAll(a.userId); return { ok: true }; }));
  router.get('/auth/sessions', authed(async (req, res, a) => ({ ok: true, current: a.sessionId, sessions: await service.listSessions(a.userId) })));
  router.delete('/auth/sessions/:id', authed(async (req, res, a) => { await service.revokeSession(a.userId, String(req.params.id).slice(0, 40)); return { ok: true }; }));
  router.get('/health', (req, res) => res.json({ ok: true }));

  /* ---- game ---- */
  router.get('/state', authed(async (req, res, a) => ({ ok: true, state: await service.getState(a.userId) })));
  router.post('/packs/buy', act((ctx, b) => game.buyPack(ctx, b.packId, service.rnd())));
  router.post('/cards/upgrade', act((ctx, b) => game.upgradeCard(ctx, b.id)));
  router.post('/facilities/upgrade', act((ctx, b) => game.upgradeFacility(ctx, b.id)));
  router.post('/crests/buy', act((ctx, b) => game.buyCrest(ctx, b.index)));
  router.post('/crests/save', act((ctx, b) => game.saveCrest(ctx, b)));
  router.post('/exclusives/claim', act((ctx, b) => game.claimExclusive(ctx, b.id)));
  router.post('/missions/claim', act((ctx, b) => game.claimMission(ctx, b.type, b.id)));
  router.post('/missions/bonus', act((ctx) => game.claimBonus(ctx)));
  router.post('/squad/save', act((ctx, b) => game.saveSquad(ctx, b)));
  router.post('/squadgame/play', act((ctx) => game.playSquadGame(ctx, service.rnd())));
  router.post('/draft/start', act((ctx, b) => { ctx.rnd = service.rnd(); return game.draftStart(ctx, b.formation, ctx.rnd); }));
  router.post('/draft/pick', act((ctx, b) => { ctx.rnd = service.rnd(); return game.draftPick(ctx, b.id, b.slot); }));
  router.post('/draft/clear', act((ctx) => game.draftClear(ctx)));
  router.post('/cup/start', act((ctx, b) => game.cupCreate(ctx, b.mode, service.rnd())));
  router.post('/cup/play', act((ctx) => game.cupPlay(ctx)));
  router.post('/cup/clear', act((ctx) => game.cupClear(ctx)));
  router.post('/league/start', act((ctx) => game.leagueStart(ctx)));
  router.post('/league/play', act((ctx) => game.leaguePlay(ctx, service.rnd())));
  router.post('/career/play', act((ctx) => game.careerPlay(ctx)));
  router.post('/career/next', act((ctx) => game.careerNext(ctx)));
  router.post('/backup/import', act((ctx, b) => game.importBackup(ctx, b.data)));
  router.post('/account/reset', act(async (ctx, b) => { if (b.confirm !== 'RESET') throw new ApiError(400, 'CONFIRM', 'Confirmation missing.'); const p = game.newPlayer(); p.state.managerName = ctx.state.managerName; p.state.redeemedCodes = ctx.state.redeemedCodes; ctx.state = p.state; ctx.coins = p.coins; ctx.ledger.push({ delta: 0, reason: 'reset', balance: p.coins }); return {}; }));
  router.get('/backup/export', authed(async (req, res, a) => {
    const st = await service.getState(a.userId);
    return { ok: true, data: { app: 'animal-fut', v: 2, managerName: st.managerName, settings: st.settings, squad: st.squad, savedSquads: st.savedSquads, crest: st.crest } };
  }));
  router.post('/promo/redeem', authed(async (req, res, a) => {
    if (!hit('p:' + a.userId, lim.promoFail, lim.promoWindow)) throw new ApiError(429, 'RATE_LIMIT', 'Too many code attempts. Try again later.');
    return service.redeemPromo(a.userId, body(req).code, idem(req));
  }));
  router.use((req, res) => res.status(404).json({ ok: false, code: 'NOT_FOUND', message: 'Unknown endpoint.' }));
  return router;
}
module.exports = { createApi };
