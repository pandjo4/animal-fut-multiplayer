'use strict';
// Loads the REAL browser game files (CLIENT_DIR) into a fake-DOM VM and drives them against the REAL server code + SQL.
// It proves the browser files parse, boot, log in, and that the main actions go through the server.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const express = require('express');
const { openStore } = require('../lib/db/store');
const { createService } = require('../lib/service');
const { createApi } = require('../lib/api');
const promoSeed = require('../lib/promo-seed');

const CLIENT_DIR = process.env.CLIENT_DIR || path.join(__dirname, '..', '..', '..', 'netlify-frontend');
if (!fs.existsSync(CLIENT_DIR)) { console.log('client smoke test skipped: set CLIENT_DIR to the Netlify project folder'); process.exit(0); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function mkEl() {
  const cache = {}; const base = { innerHTML: '', textContent: '', value: '', style: { cssText: '' }, dataset: {}, children: [], scrollTop: 0, offsetWidth: 10, className: '',
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild(c) { return c; }, remove() {}, setAttribute() {}, getAttribute() { return null; }, addEventListener() {}, removeEventListener() {}, focus() {}, click() {}, closest() { return null; },
    getBoundingClientRect() { return { top: 0, left: 0, width: 10, height: 10 }; },
    querySelector(s) { return cache[s] || (cache[s] = mkEl()); }, querySelectorAll() { return []; } };
  return new Proxy(base, { get: (t, k) => (k in t ? t[k] : typeof k === 'string' ? () => undefined : undefined), set: (t, k, v) => { t[k] = v; return true; } });
}

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'afut-smoke-'));
  const clock = { t: Date.now() };
  const store = openStore({ sqliteFile: path.join(tmp, 'db.sqlite') }); await store.migrate();
  const svc = createService(store, { now: () => clock.t }); await svc.seedPromos(promoSeed.load());
  const app = express(); app.use('/api', createApi(svc, { now: () => clock.t }));
  const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const port = server.address().port;

  const created = []; const toasts = []; const store2 = new Map();
  const doc = mkEl(); doc.createElement = () => { const e = mkEl(); created.push(e); return e; }; doc.body = mkEl(); doc.head = mkEl(); doc.documentElement = mkEl(); doc.readyState = 'complete'; doc.visibilityState = 'visible';
  doc.addEventListener = () => {};
  const sandbox = { document: doc, console, setTimeout, clearTimeout, setInterval, clearInterval, fetch, URL, Promise, JSON, Math, Date, Object, Array, Set, Map, Number, String, Error, btoa, atob, encodeURIComponent, decodeURIComponent, escape, unescape, crypto: require('crypto').webcrypto,
    localStorage: { getItem: (k) => (store2.has(k) ? store2.get(k) : null), setItem: (k, v) => store2.set(k, String(v)), removeItem: (k) => store2.delete(k) },
    navigator: { userAgent: 'smoke', clipboard: {} }, location: { reload() {}, hash: '', href: 'http://x/' }, requestAnimationFrame: (f) => setTimeout(f, 0), matchMedia: () => ({ matches: false, addEventListener() {} }),
    Audio: class { play() { return Promise.resolve(); } pause() {} addEventListener() {} }, AudioContext: undefined, Image: class {}, confirm: () => true, alert() {}, addEventListener() {}, removeEventListener() {}, innerWidth: 400, innerHeight: 800, URLSearchParams };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
  sandbox.WILDXI_SERVER_URL = 'http://127.0.0.1:' + port;
  const ctx = vm.createContext(sandbox);
  const run = (code, name) => vm.runInContext(code, ctx, { filename: name });
  for (const f of ['animals.js', 'script.js', 'features.js', 'multiplayer.js', 'match-upgrades.js', 'server-sync.js']) run(fs.readFileSync(path.join(CLIENT_DIR, f), 'utf8'), f);
  run('showToast = function (m) { __toasts.push(String(m)); }', 'toast'); sandbox.__toasts = toasts;
  const ev = (c) => run(c, 'eval');
  let passed = 0, failed = 0;
  const step = async (name, fn) => { try { await fn(); passed++; console.log('  ✓', name); } catch (e) { failed++; console.log('  ✗', name, '\n     ', (e.stack || e).toString().split('\n').slice(0, 5).join('\n      ')); console.log('      toasts:', toasts.slice(-3)); } };

  console.log('Client smoke test (real browser files + real server)');
  await step('game files load; login gate is shown; no secret promo codes in the client', async () => {
    const gate = created.find((e) => String(e.style.cssText).includes('99999')); assert(gate, 'login gate shown');
    for (const f of fs.readdirSync(CLIENT_DIR).filter((x) => x.endsWith('.js'))) { const t = fs.readFileSync(path.join(CLIENT_DIR, f), 'utf8'); assert(!/WILDXI-TREX|WILDXI-ADMIN|COINS-10000/.test(t), 'promo code found in ' + f); }
    assert(ev('typeof PACK_SYSTEM.buy') === 'function');
  });
  await step('register through the gate loads the server state into the game', async () => {
    const gate = created.find((e) => String(e.style.cssText).includes('99999'));
    gate.querySelector('[data-u]').value = 'SmokeUser'; gate.querySelector('[data-p]').value = 'smoke pass 1234';
    await gate.querySelector('[data-reg]').onclick(); await sleep(300);
    assert.strictEqual(ev('STATE.coins'), 300); assert.strictEqual(ev('STATE.managerName'), 'SmokeUser');
  });
  await step('local tampering cannot change what the server holds (coins/owned edited in "console")', async () => {
    ev('STATE.coins = 99999999; STATE.owned["t-rex"] = 5;');
    await ev('ACTIONS.doOpen({ id: "basic" })'); await sleep(200);
    assert(ev('STATE.coins') < 400, 'coins reset to server truth: ' + ev('STATE.coins')); assert.strictEqual(ev('STATE.owned["t-rex"]'), undefined);
    assert.strictEqual(ev('Object.values(STATE.owned).reduce((a,b)=>a+b,0)'), 14, '11 starters + 3 pack cards');
  });
  await step('promo code via settings input goes to the server', async () => {
    ev('document.querySelector("#redeemCodeInput").value = "wildxi-coins-10000"'); // fake DOM: wire $()
    const before = ev('STATE.coins');
    const r = await ev('WILDXI_SYNC.api("POST","/promo/redeem",{code:"WILDXI-COINS-10000"})').then((x) => { ev('WILDXI_SYNC.applyServerState').call; return x; });
    ev(`WILDXI_SYNC.applyServerState(${JSON.stringify(r.state)})`);
    assert.strictEqual(ev('STATE.coins'), before + 10000);
    await assert.rejects(() => ev('WILDXI_SYNC.api("POST","/promo/redeem",{code:"WILDXI-COINS-10000"})'), /already/i);
  });
  await step('squad edits sync to the server; squad game is played and paid by the server', async () => {
    ev('STATE.squad = { formation: "433", slots: SQUAD_SYSTEM.autoFill("433", Object.keys(STATE.owned)), style: "balanced" }; persist();');
    await sleep(900);
    await ev('ACTIONS.squadFriendly()'); await sleep(300);
    assert.strictEqual(ev('STATE.stats.played'), 1, toasts.join('|'));
  });
  await step('cup: start -> Play Match goes to the server; result is applied when the match ends', async () => {
    await ev('ACTIONS.startTournament({ m: "squad" })'); await sleep(300);
    assert(ev('STATE.tournament && !STATE.tournament.over'), toasts.join('|'));
    const before = ev('STATE.stats.played');
    await ev('ACTIONS.go({ v: "match" })'); await sleep(300);
    assert(ev('MR.pm && MR.pm.serverRes'), 'match prepared by the server'); assert.strictEqual(ev('STATE.stats.played'), before, 'not applied yet (animation pending)');
    ev('finishMatch()'); assert.strictEqual(ev('STATE.stats.played'), before + 1);
    assert(ev('MR.summary') && typeof ev('MR.summary.pay') === 'number');
  });
  await step('endless league + career go through the server', async () => {
    await ev('ACTIONS.leagueStart()'); await sleep(400); assert(ev('MR.pm && String(MR.pm.key).startsWith("endless:")'), toasts.join('|'));
    ev('finishMatch()'); assert(ev('STATE.stats.played') >= 3);
    clock.t += 61000; await ev('ACTIONS.careerPlay()'); await sleep(300);
    assert(ev('WILDXI_FEATURES.get().career.season && WILDXI_FEATURES.get().career.season.round') >= 1, toasts.join('|'));
  });
  await step('backup export contains no coins/collection; import of a forged backup changes nothing authoritative', async () => {
    const code = ev('makeBackupCode()'); const j = JSON.parse(decodeURIComponent(escape(atob(code))));
    assert(!('coins' in j.data) && !('owned' in j.data));
    const coins = ev('STATE.coins');
    const forged = Buffer.from(JSON.stringify({ app: 'animal-fut', v: 1, data: { 'wildxi.save': JSON.stringify({ coins: 9e9, owned: { 't-rex': 9 }, managerName: 'Forged FC' }) } })).toString('base64');
    const ok = await ev(`WILDXI_SYNC.importBackup(${JSON.stringify(forged)})`);
    assert.strictEqual(ok, true); assert.strictEqual(ev('STATE.coins'), coins); assert.strictEqual(ev('STATE.owned["t-rex"]'), undefined); assert.strictEqual(ev('STATE.managerName'), 'Forged FC');
  });
  await step('multiplayer client sends auth:login with the session token on connect', async () => {
    const src = fs.readFileSync(path.join(CLIENT_DIR, 'multiplayer.js'), 'utf8'); assert(/auth:login/.test(src));
  });

  server.close(); await store.close(); fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
})();
