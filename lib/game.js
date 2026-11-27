'use strict';
/*
  Server-side game rules (economy, collection, rewards). Pure functions over a "ctx":
      ctx = { coins, state, ledger: [], now }
  Nothing here trusts the client: callers pass only ids/choices, every price, reward, odds roll and
  opponent comes from this file (and the shared engine in /game).
*/
const engine = require('./engine');
const { dailyPool, weeklyPool } = require('./pools');
const E = () => engine.load();

class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const bad = (code, msg, status) => new ApiError(status || 400, code, msg);

const START_COINS = 300;
const SHAPES = 25, FIRST_PREMIUM = 15, CREST_PRICE = 10000;
const FIELD_MAX_LEVEL = 10;
const FIELD_BUILDINGS = [
  { id: 'pitch', per: .0004, base: 50 }, { id: 'lights', per: .0004, base: 55 }, { id: 'stands', per: .0003, base: 50 },
  { id: 'training', per: .0001, base: 65 }, { id: 'medical', per: .0004, base: 55 }, { id: 'shop', per: .01, base: 62 }
];
const FIELD_COST_STEPS = [1, 2, 4, 8, 16, 30, 55, 95, 160];
const UPGRADE_REQ = [3, 5, 10], UPGRADE_COST = [500, 1000, 5000];
const SQUAD_COOLDOWN_MS = 10000, CAREER_COOLDOWN_MS = 60000;
const CAREER_DIVISIONS = ['Bronze III','Bronze II','Bronze I','Silver III','Silver II','Silver I','Gold III','Gold II','Gold I','Platinum III','Platinum II','Platinum I','Diamond III','Diamond II','Diamond I','Elite III','Elite II','Elite I','Champion II','Champion I','Legend'];
const LEAGUE_MILESTONES = [[3, 100], [5, 200], [10, 450], [15, 700], [20, 1000]];

// Exclusive-card quests. Progress is computed from server-held data only. codeOnly cards come from promo codes.
const EXCLUSIVE_QUESTS = {
  medojed: [['trophies', 2, (s) => s.stats.trophies], ['leagueBest', 5, (s) => s.league.best], ['collection', 40, (s) => distinctNonExclusive(s)]],
  jegulja: [['bestStreak', 8, (s) => s.stats.bestStreak], ['played', 100, (s) => s.stats.played]],
  dugong: [['days', 3, (s) => s.playDays.length], ['saves', 100, (s) => s.stats.saves]],
  kitoglav: [['chem', 68, (s) => s.best.chem], ['ovr', 88, (s) => s.best.ovr]],
  cibetka: [['wins', 25, (s) => s.stats.wins]]
};
function distinctNonExclusive(s) { const e = E(); return Object.keys(s.owned).filter((id) => s.owned[id] > 0 && e.PLAYER_BY_ID[id] && !e.PLAYER_BY_ID[id].exclusive).length; }

/* ---------------- state ---------------- */
function newPlayer() {
  const e = E();
  const owned = {};
  e.GAME_DATA.STARTER_IDS.forEach((id) => { owned[id] = 1; });
  const facilities = {}; FIELD_BUILDINGS.forEach((b) => { facilities[b.id] = 1; });
  return {
    coins: START_COINS,
    state: {
      v: 1, owned, upgrades: {}, facilities, exclusiveClaims: [], redeemedCodes: [],
      stats: { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, saves: 0, tournaments: 0, trophies: 0, finals: 0, packs: 0, coinsEarned: 0, streak: 0, bestStreak: 0 },
      best: { chem: 0, ovr: 0 }, history: [], playDays: [], managerName: 'Wild XI', settings: { speed: 'normal', tacticsCollapsed: false, positionWarningsCollapsed: true },
      squad: null, savedSquads: [null, null, null], draftSquad: null, draft: null, tournament: null,
      crest: { shape: 0, primary: '#d9a441', secondary: '#203a30', symbol: '', unlocked: [] },
      daily: { key: '', missions: [], bonusClaimed: false }, weekly: { key: '', missions: [] }, metrics: {},
      league: { active: false, run: 0, streak: 0, best: 0, matches: 0, wins: 0, losses: 0, runCoins: 0, runMilestones: [], lastResult: '' },
      career: { division: 0, seasonNo: 1, season: null, history: [], nextPlayAt: 0 },
      cooldowns: { squadAt: 0 }
    }
  };
}

function addCoins(ctx, n, reason) {
  n = Math.floor(n);
  if (!Number.isFinite(n) || n < 0) throw bad('BAD_AMOUNT', 'Invalid amount.', 500);
  if (!n) return;
  ctx.coins += n; ctx.ledger.push({ delta: n, reason, balance: ctx.coins });
}
function earn(ctx, n, reason) { addCoins(ctx, n, reason); ctx.state.stats.coinsEarned += Math.floor(n); }
function spend(ctx, n, reason) {
  n = Math.floor(n);
  if (ctx.coins < n) throw bad('NOT_ENOUGH_COINS', `Not enough coins! You need ${n}, you have ${ctx.coins}.`, 409);
  ctx.coins -= n; ctx.ledger.push({ delta: -n, reason, balance: ctx.coins });
}
const fanShop = (s) => Math.round(1e9 * ((Number(s.facilities.shop) || 0) * .01)) / 1e9;
const withFanShop = (s, c) => Math.round(c * (1 + fanShop(s)));

/* ---------------- missions ---------------- */
const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);
function weekKey(ms) { const d = new Date(ms); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day); return d.toISOString().slice(0, 10); }
function sample(pool, n, seed) {
  const arr = pool.slice(); let x = 0;
  for (let i = 0; i < seed.length; i++) x = (Math.imul(x, 31) + seed.charCodeAt(i)) >>> 0;
  for (let i = arr.length - 1; i > 0; i--) { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; const j = x % (i + 1); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr.slice(0, n).map((m) => ({ id: m[0], title: m[1], desc: m[2], target: m[3], metric: m[4], reward: m[5], progress: 0, claimed: false }));
}
function ensureTime(s, now) {
  const dk = dayKey(now), wk = weekKey(now);
  if (s.daily.key !== dk) s.daily = { key: dk, missions: sample(dailyPool, 3, 'd:' + dk), bonusClaimed: false };
  if (s.weekly.key !== wk) s.weekly = { key: wk, missions: sample(weeklyPool, 4, 'w:' + wk) };
}
function event(s, name, amount) {
  amount = amount === undefined ? 1 : amount;
  s.metrics[name] = (Number(s.metrics[name]) || 0) + amount;
  [...s.daily.missions, ...s.weekly.missions].forEach((m) => { if (m.metric === name) m.progress = Math.min(m.target, (Number(m.progress) || 0) + amount); });
}
function progressValue(s, name, value) {
  [...s.daily.missions, ...s.weekly.missions].forEach((m) => { if (m.metric === name) m.progress = Math.min(m.target, Math.max(Number(m.progress) || 0, Number(value) || 0)); });
}
function claimMission(ctx, type, id) {
  const s = ctx.state; ensureTime(s, ctx.now);
  if (type !== 'daily' && type !== 'weekly') throw bad('BAD_REQUEST', 'Unknown mission type.');
  const m = (type === 'daily' ? s.daily : s.weekly).missions.find((x) => x.id === id);
  if (!m) throw bad('NO_SUCH_MISSION', 'That mission is not active.', 404);
  if (m.claimed) throw bad('ALREADY_CLAIMED', 'Reward already claimed.', 409);
  if (m.progress < m.target) throw bad('NOT_COMPLETE', 'Mission is not complete.', 409);
  m.claimed = true; earn(ctx, m.reward, 'mission:' + type + ':' + id);
  return { reward: m.reward };
}
function claimBonus(ctx) {
  const s = ctx.state; ensureTime(s, ctx.now);
  if (s.daily.bonusClaimed) throw bad('ALREADY_CLAIMED', 'Daily bonus already claimed.', 409);
  if (!s.daily.missions.every((m) => m.progress >= m.target && m.claimed)) throw bad('NOT_COMPLETE', 'Claim all 3 daily missions first.', 409);
  s.daily.bonusClaimed = true; earn(ctx, 200, 'daily-bonus');
  return { reward: 200 };
}

/* ---------------- collection / shop ---------------- */
function rarityOf(id) { return E().PLAYER_BY_ID[id].rarity; }
function packRoll(pk, rnd) {
  const e = E(); const tot = Object.values(pk.odds).reduce((a, b) => a + b, 0);
  let r = rnd() * tot;
  for (const k of e.GAME_DATA.RARITIES) { if (k === 'Dinosaur') continue; r -= (pk.odds[k] || 0); if (r < 0) return k; }
  return 'Common';
}
function buyPack(ctx, packId, rnd) {
  const e = E(), s = ctx.state;
  const pk = e.GAME_DATA.PACKS.find((p) => p.id === packId);
  if (typeof packId !== 'string' || !pk) throw bad('UNKNOWN_PACK', 'Unknown pack.', 404);
  spend(ctx, pk.price, 'pack:' + pk.id);
  s.stats.packs++;
  const slots = pk.guarantee ? e.shuffled(pk.guarantee.slice(), rnd) : [null, null, null];
  const cards = [];
  for (let i = 0; i < 3; i++) {
    const rar = slots[i] || packRoll(pk, rnd);
    const pool = e.PLAYER_DATABASE.filter((p) => p.rarity === rar && !p.exclusive && (rar !== 'Dinosaur' || !!slots[i]));
    const p = pool[Math.floor(rnd() * pool.length)];
    const had = s.owned[p.id] || 0;
    s.owned[p.id] = had + 1;
    let dup = 0;
    if (had > 0) { dup = e.GAME_DATA.DUP_COINS[p.rarity]; earn(ctx, dup, 'pack-duplicate:' + p.id); }
    cards.push({ id: p.id, isNew: had === 0, dup, copies: had + 1 });
  }
  ensureTime(s, ctx.now); event(s, 'packs', 1);
  return { cards, pack: { id: pk.id, price: pk.price } };
}
function upgradeCard(ctx, rawId) {
  const e = E(), s = ctx.state;
  const id = typeof rawId === 'string' ? e.canonicalPlayerId(rawId) : null;
  const p = id && e.PLAYER_BY_ID[id];
  if (!p) throw bad('UNKNOWN_CARD', 'Unknown card.', 404);
  if (!(s.owned[id] > 0)) throw bad('NOT_OWNED', 'You do not own that card.', 403);
  if (p.exclusive) throw bad('NOT_UPGRADABLE', 'Exclusive cards cannot be upgraded.', 409);
  const lv = s.upgrades[id] || 0;
  if (lv >= 3) throw bad('MAX_LEVEL', 'This card is already at max level.', 409);
  if (s.owned[id] < UPGRADE_REQ[lv]) throw bad('NOT_ENOUGH_COPIES', `Required: ${UPGRADE_REQ[lv]} copies of this card.`, 409);
  spend(ctx, UPGRADE_COST[lv], 'upgrade:' + id + ':' + (lv + 1));
  s.upgrades[id] = lv + 1;
  return { id, level: lv + 1 };
}
function fieldCost(b, next) {
  const step = FIELD_COST_STEPS[next - 2]; if (!step) return 0;
  const raw = b.base * step, unit = raw < 1000 ? 5 : 10;
  return Math.round(raw / unit) * unit;
}
function upgradeFacility(ctx, id) {
  const b = FIELD_BUILDINGS.find((x) => x.id === id);
  if (!b) throw bad('UNKNOWN_BUILDING', 'Unknown building.', 404);
  const lv = ctx.state.facilities[b.id] || 1;
  if (lv >= FIELD_MAX_LEVEL) throw bad('MAX_LEVEL', 'This building is already at max level.', 409);
  spend(ctx, fieldCost(b, lv + 1), 'facility:' + b.id + ':' + (lv + 1));
  ctx.state.facilities[b.id] = lv + 1;
  return { id: b.id, level: lv + 1 };
}
function crestUnlocked(s, i) { return i < FIRST_PREMIUM || s.crest.unlocked.includes(i); }
function buyCrest(ctx, i) {
  i = Number(i);
  if (!Number.isInteger(i) || i < FIRST_PREMIUM || i >= SHAPES) throw bad('BAD_CREST', 'That crest cannot be purchased.');
  const s = ctx.state;
  if (!crestUnlocked(s, i)) { spend(ctx, CREST_PRICE, 'crest:' + i); s.crest.unlocked = [...s.crest.unlocked, i].sort((a, b) => a - b); }
  s.crest.shape = i;
  return { shape: i };
}
const hex = (v, d) => (/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(v || '')) ? String(v) : d);
const cleanSymbol = (v) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>&"']/g, '').slice(0, 12);
function saveCrest(ctx, c) {
  const s = ctx.state;
  if (!c || typeof c !== 'object') throw bad('BAD_REQUEST', 'Crest data missing.');
  if (c.shape !== undefined) {
    const i = Number(c.shape);
    if (!Number.isInteger(i) || i < 0 || i >= SHAPES) throw bad('BAD_CREST', 'Unknown crest.');
    if (!crestUnlocked(s, i)) throw bad('CREST_LOCKED', 'That premium crest is not unlocked.', 403);
    s.crest.shape = i;
  }
  s.crest.primary = hex(c.primary, s.crest.primary); s.crest.secondary = hex(c.secondary, s.crest.secondary);
  if (c.symbol !== undefined) s.crest.symbol = cleanSymbol(c.symbol);
  return { crest: s.crest };
}
function exclusiveProgress(s, id) {
  return (EXCLUSIVE_QUESTS[id] || []).map(([rid, need, get]) => ({ id: rid, need, have: Math.min(need, Math.max(0, Math.floor(Number(get(s)) || 0))) }));
}
function claimExclusive(ctx, id) {
  const e = E(), s = ctx.state;
  if (typeof id !== 'string' || !EXCLUSIVE_QUESTS[id] || !e.PLAYER_BY_ID[id]) throw bad('UNKNOWN_REWARD', 'Unknown reward.', 404);
  if (s.exclusiveClaims.includes(id) || s.owned[id]) throw bad('ALREADY_CLAIMED', 'This reward has already been claimed.', 409);
  if (!exclusiveProgress(s, id).every((r) => r.have >= r.need)) throw bad('NOT_COMPLETE', 'Complete all requirements first.', 409);
  s.owned[id] = 1; s.exclusiveClaims.push(id);
  return { id };
}
function grantCard(ctx, id) {
  const e = E(), s = ctx.state;
  const p = e.PLAYER_BY_ID[id]; if (!p) throw bad('UNKNOWN_CARD', 'Reward card does not exist.', 500);
  if (p.exclusive) { s.owned[id] = 1; if (!s.exclusiveClaims.includes(id)) s.exclusiveClaims.push(id); }
  else s.owned[id] = (s.owned[id] || 0) + 1;
}
function applyPromoReward(ctx, row) {
  if (row.reward_type === 'coins') { earn(ctx, Number(row.reward_value), 'promo:' + row.code); return { type: 'coins', amount: Number(row.reward_value) }; }
  grantCard(ctx, row.reward_value); return { type: 'card', id: row.reward_value };
}

/* ---------------- squads ---------------- */
function cleanSquad(s, x, requireOwned) {
  const e = E();
  if (!x || typeof x !== 'object' || !e.GAME_DATA.FORMATIONS[x.formation] || !Array.isArray(x.slots) || x.slots.length !== 11) return null;
  const seen = new Set(), slots = [];
  for (const raw of x.slots) {
    if (raw === null) { slots.push(null); continue; }
    const id = typeof raw === 'string' ? e.canonicalPlayerId(raw) : null;
    if (!id || seen.has(id)) return null;
    if (requireOwned && !(s.owned[id] > 0)) return null; // ownership is checked against the SERVER collection
    seen.add(id); slots.push(id);
  }
  return { formation: x.formation, slots, style: e.GAME_DATA.STYLES[x.style] ? x.style : 'balanced' };
}
const isComplete = (sq) => !!(sq && sq.slots.length === 11 && sq.slots.every(Boolean));
function userTeam(s, name, sqOverride) {
  const sq = sqOverride || s.squad;
  return engine.buildTeam({ formation: sq.formation, ids: sq.slots, style: sq.style, upg: s.upgrades, facilities: s.facilities }, { name: name || s.managerName, icon: '🐾', c1: s.crest.primary, c2: s.crest.secondary });
}
function recordBest(s, sq) {
  sq = sq || s.squad;
  if (!isComplete(sq)) return;
  const t = userTeam(s, null, sq);
  if (t.chem.pct > s.best.chem) s.best.chem = t.chem.pct;
  if (t.ovr > s.best.ovr) s.best.ovr = t.ovr;
}
function saveSquad(ctx, p) {
  const s = ctx.state;
  if (!p || typeof p !== 'object') throw bad('BAD_REQUEST', 'Squad data missing.');
  if (p.squad !== undefined) {
    if (p.squad === null) s.squad = null;
    else { const q = cleanSquad(s, p.squad, true); if (!q) throw bad('INVALID_SQUAD', 'Squad contains a card you do not own, a duplicate, or an invalid formation.', 403); s.squad = q; }
  }
  if (p.savedSquads !== undefined) {
    if (!Array.isArray(p.savedSquads) || p.savedSquads.length > 3) throw bad('BAD_REQUEST', 'Invalid saved squads.');
    const out = [null, null, null];
    for (let i = 0; i < 3; i++) {
      const raw = p.savedSquads[i]; if (!raw) continue;
      const q = cleanSquad(s, raw, true); if (!q) throw bad('INVALID_SQUAD', 'Saved squad contains a card you do not own.', 403);
      out[i] = Object.assign(q, { name: String(raw.name || `Team ${i + 1}`).replace(/[\u0000-\u001f\u007f<>]/g, '').slice(0, 24) });
    }
    s.savedSquads = out;
  }
  if (p.draftStyle !== undefined && s.draftSquad && E().GAME_DATA.STYLES[p.draftStyle]) s.draftSquad.style = p.draftStyle;
  if (p.managerName !== undefined) { const n = String(p.managerName).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 18); if (n) s.managerName = n; }
  if (p.settings && typeof p.settings === 'object') {
    if (['normal', 'fast'].includes(p.settings.speed)) s.settings.speed = p.settings.speed;
    ['tacticsCollapsed', 'positionWarningsCollapsed'].forEach((k) => { if (typeof p.settings[k] === 'boolean') s.settings[k] = p.settings[k]; });
  }
  recordBest(s);
  return {};
}

/* ---------------- matches (simulated on the server, result is final) ---------------- */
function genAISquad(club, rnd, fid) {
  const e = E(); const F = e.GAME_DATA.FORMATIONS[fid]; const used = new Set(); const ids = [];
  F.slots.forEach(([pos]) => {
    let best = null, bs = -1e9;
    e.PLAYER_DATABASE.forEach((p) => {
      if (p.rarity === 'Legendary' || p.rarity === 'Dinosaur' || p.exclusive || used.has(p.id)) return;
      const fit = e.SQUAD_SYSTEM.fitInfo(p, pos);
      let bias = 0;
      if (club.fam && club.fam.includes(p.family)) bias += 6;
      if (club.diet && club.diet.includes(p.diet)) bias += 3;
      if (club.cls && club.cls.includes(p.cls)) bias += 4;
      const sc = (e.BASE_PLAYER_STATS[p.id] ? e.BASE_PLAYER_STATS[p.id].ovr : p.ovr) - fit.pen * 1.3 + bias + rnd() * (pos === 'GK' ? 34 : 16);
      if (sc > bs) { bs = sc; best = p; }
    });
    used.add(best.id); ids.push(best.id);
  });
  return ids;
}
function aiTeam(club, rnd, boost) {
  const e = E();
  const fid = club.fm[Math.floor(rnd() * club.fm.length)];
  const ids = genAISquad(club, rnd, fid);
  return e.SQUAD_SYSTEM.buildTeam({ name: club.name, icon: club.icon, c1: club.c1, c2: club.c2, stadium: club.stadium, formation: fid, ids, style: club.style, boost, clubId: club.id });
}
function trackPlayDay(s, now) {
  const day = dayKey(now); if (!s.playDays.includes(day)) s.playDays.push(day);
  if (s.playDays.length > 400) s.playDays = s.playDays.slice(-400);
}
function logMatch(s, entry) { s.history.unshift(entry); s.history = s.history.slice(0, 30); }
function requireSquad(s) {
  if (!isComplete(s.squad)) throw bad('SQUAD_INCOMPLETE', 'Fill all 11 slots in Squad first.', 409);
  // Re-check ownership at match time: a server squad can never contain a card that is not owned.
  if (!s.squad.slots.every((id) => s.owned[id] > 0)) throw bad('NOT_OWNED', 'Your squad contains a card you do not own.', 403);
}
function seedFrom(rndInt) { return (Math.floor(rndInt() * 2147483000) + 1) >>> 0; }
function recordResultStats(s, gf, ga, saves) {
  const S = s.stats; S.played++; S.gf += gf; S.ga += ga; S.saves += saves || 0;
  if (gf > ga) { S.wins++; S.streak++; S.bestStreak = Math.max(S.bestStreak, S.streak); }
  else if (gf === ga) { S.draws++; S.streak = 0; } else { S.losses++; S.streak = 0; }
}
function winEvents(s, U) {
  const rs = U.players.map((p) => p && p.rarity), style = U.styleId;
  if (rs.filter((x) => x === 'Common').length >= 3) event(s, 'commonWins');
  if (rs.filter((x) => x === 'Rare').length >= 3) event(s, 'rareWins');
  if (rs.filter((x) => x === 'Epic').length >= 2) event(s, 'epicWins');
  if (rs.includes('Legendary') || rs.includes('Dinosaur')) event(s, 'legendWins');
  if (['direct', 'press'].includes(style)) event(s, 'attackWins');
  if (style === 'counter') event(s, 'defendWins');
  if ((U.chem.pct || 0) >= 20) event(s, 'chemWins');
}

function playSquadGame(ctx, rnd) {
  const e = E(), s = ctx.state; requireSquad(s); ensureTime(s, ctx.now);
  const left = SQUAD_COOLDOWN_MS - (ctx.now - s.cooldowns.squadAt);
  if (left > 0) throw bad('COOLDOWN', `You can play again in ${Math.ceil(left / 1000)}s`, 429);
  const seed = seedFrom(rnd), r = e.mulberry32(seed);
  const club = e.GAME_DATA.CLUBS[Math.floor(r() * e.GAME_DATA.CLUBS.length)];
  const U = userTeam(s), O = aiTeam(club, r, -1);
  const res = engine.simulate([U, O], seed);
  const [gf, ga] = res.score;
  const reward = withFanShop(s, gf > ga ? 55 : gf === ga ? 25 : 10);
  earn(ctx, reward, 'squad-game');
  recordResultStats(s, gf, ga, res.stats.saves[0]);
  logMatch(s, { opp: O.name, icon: O.icon, gf, ga, round: 'Squad Game', r: gf > ga ? 'W' : gf === ga ? 'D' : 'L', draw: gf === ga });
  s.cooldowns.squadAt = ctx.now; trackPlayDay(s, ctx.now);
  const brief = (t) => ({ name: t.name, icon: t.icon, ovr: t.ovr, formation: t.formation, formationName: t.fm.name, styleName: t.style.name, atk: Math.round(t.atk), ctrl: Math.round(t.ctrl), def: Math.round(t.def) });
  return { score: [gf, ga], reward, opponent: brief(O), user: brief(U), res };
}

function leagueStart(ctx) {
  const s = ctx.state, l = s.league; requireSquad(s);
  l.active = true; l.run++; l.streak = 0; l.runCoins = 0; l.runMilestones = []; l.lastResult = '';
  return {};
}
function leaguePlay(ctx, rnd) {
  const e = E(), s = ctx.state, l = s.league; ensureTime(s, ctx.now);
  if (!l.active) throw bad('NO_ACTIVE_RUN', 'Start a streak first.', 409);
  requireSquad(s);
  const seed = seedFrom(rnd), r = e.mulberry32(seed);
  const club = e.GAME_DATA.CLUBS[Math.floor(r() * e.GAME_DATA.CLUBS.length)];
  const U = userTeam(s), O = aiTeam(club, r, Math.min(9, Math.floor(l.streak / 3)));
  const res = engine.simulate([U, O], seed);
  const won = res.winner === 0, [gf, ga] = res.score;
  l.matches++; let pay = 0, hit = null;
  s.stats.played++; s.stats.gf += gf; s.stats.ga += ga; s.stats.saves += res.stats.saves[0] || 0;
  if (won) {
    l.wins++; l.streak++; l.best = Math.max(l.best, l.streak);
    pay = withFanShop(s, Math.round(100 * Math.min(1 + (l.streak - 1) * .1, 2)));
    s.stats.wins++; s.stats.streak++; s.stats.bestStreak = Math.max(s.stats.bestStreak, s.stats.streak);
    event(s, 'leagueWins'); event(s, 'wins'); if (gf) event(s, 'leagueGoals', gf); if (ga === 0) event(s, 'cleanWins');
    winEvents(s, U);
    earn(ctx, pay, 'league-win'); l.runCoins += pay; event(s, 'earned', pay);
    hit = LEAGUE_MILESTONES.find((x) => x[0] === l.streak && !l.runMilestones.includes(x[0]));
    if (hit) { earn(ctx, hit[1], 'league-milestone:' + hit[0]); l.runCoins += hit[1]; l.runMilestones.push(hit[0]); event(s, 'earned', hit[1]); }
    l.lastResult = `Victory ${gf}:${ga} · +${pay} coins${hit ? ` · milestone bonus +${hit[1]}` : ''}`;
  } else {
    l.losses++; l.active = false; s.stats.losses++; s.stats.streak = 0;
    l.lastResult = `Defeat ${gf}:${ga} · Streak ended after ${l.streak} wins.`; l.streak = 0;
  }
  event(s, 'played'); if (gf) event(s, 'goals', gf); progressValue(s, 'streak', s.stats.streak);
  if (s.squad.formation === '433') event(s, 'form433'); if (s.squad.formation === '442') event(s, 'form442');
  trackPlayDay(s, ctx.now);
  return { won, score: [gf, ga], pay, milestone: hit ? hit[1] : 0, over: !won, opponent: { name: O.name, icon: O.icon, stadium: O.stadium }, user: { name: U.name, ovr: U.ovr }, res };
}

/* ---- Career mode (port of the client's league-table logic; cooldown and rewards are server side) ---- */
const careerReward = (div) => 150 + div * 180;
const careerStrengthForDivision = (div) => 58 + div * 1.85;
function careerBuildSeason(s) {
  const e = E(), c = s.career, div = c.division, used = new Set();
  const clubs = e.GAME_DATA.CLUBS.slice().sort((a, b) => a.name.localeCompare(b.name));
  const F = Object.keys(e.GAME_DATA.FORMATIONS), ST = Object.keys(e.GAME_DATA.STYLES);
  const uf = (s.squad && s.squad.formation) || '433', us = (s.squad && s.squad.style) || 'balanced';
  const teams = [{ id: 'user', name: s.managerName, icon: '🐾', user: true, formation: uf, style: us, strength: 0, played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }];
  const fp = F.filter((x) => x !== uf), sp = ST.filter((x) => x !== us);
  for (let i = 0; i < 7; i++) {
    let club = clubs[(div * 3 + i) % clubs.length]; if (used.has(club.id)) club = clubs.find((cc) => !used.has(cc.id)); used.add(club.id);
    teams.push({ id: club.id, name: club.name, icon: club.icon, user: false, formation: fp[((div * 3) % fp.length + i) % fp.length], style: sp[((div * 2) % sp.length + i) % sp.length],
      strength: Math.round(careerStrengthForDivision(div) + (i % 3 - 1) * 2 + (i % 2)), played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 });
  }
  const ring = [0, 1, 2, 3, 4, 5, 6, 7], rounds = [];
  for (let r = 0; r < 7; r++) { const g = []; for (let i = 0; i < 4; i++) g.push({ a: ring[i], b: ring[7 - i], played: false, score: null }); rounds.push(g); ring.splice(1, 0, ring.pop()); }
  c.season = { division: div, seasonNo: c.seasonNo, round: 0, teams, rounds, finished: false, transition: null, seasonReward: 0, matchLog: [] };
}
function careerScore(h, a, seed, userOvr, c) {
  const e = E(), rnd = e.mulberry32(seed >>> 0);
  const str = (t) => (t.user ? userOvr : (Number(t.strength) || careerStrengthForDivision(c.division)));
  const hs = str(h), as = str(a);
  const atk = (id) => ({ direct: 2, wingplay: 1.5, longball: 1.3, press: 1.1, gegenpress: 1.4, total: 1.2, counter: .8, defensive: -.7, possession: .4, balanced: 0 }[id] || 0);
  const def = (id) => ({ defensive: 1.8, counter: 1.2, press: .3, gegenpress: .5, total: -.1, direct: -.3, longball: -.4, wingplay: -.3, possession: .2, balanced: 0 }[id] || 0);
  const hx = Math.max(.18, Math.min(3.6, (hs - as) / 18 + 1.1 + atk(h.style) * .08 - def(a.style) * .07));
  const ax = Math.max(.18, Math.min(3.3, (as - hs) / 20 + .95 + atk(a.style) * .08 - def(h.style) * .07));
  const goals = (x) => Math.max(0, Math.min(6, Math.floor(x * .85 + rnd() * 1.65)));
  return [goals(hx), goals(ax)];
}
function careerApply(season, game, score) {
  game.played = true; game.score = score;
  const a = season.teams[game.a], b = season.teams[game.b], [ga, gb] = score;
  a.played++; b.played++; a.gf += ga; a.ga += gb; b.gf += gb; b.ga += ga;
  if (ga > gb) { a.w++; a.pts += 3; b.l++; } else if (ga < gb) { b.w++; b.pts += 3; a.l++; } else { a.d++; b.d++; a.pts++; b.pts++; }
  season.matchLog.push({ round: season.round + 1, a: a.name, b: b.name, score: `${ga}:${gb}` });
}
const careerTable = (season) => season.teams.slice().sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || a.name.localeCompare(b.name));
function careerPlay(ctx) {
  const s = ctx.state, c = s.career; ensureTime(s, ctx.now);
  if (!c.season) careerBuildSeason(s);
  const season = c.season;
  if (season.finished) throw bad('SEASON_FINISHED', 'Season is finished. Start the next season to continue.', 409);
  const wait = (Number(c.nextPlayAt) || 0) - ctx.now;
  if (wait > 0) throw bad('COOLDOWN', `Next matchday available in ${Math.ceil(wait / 1000)} seconds.`, 429);
  requireSquad(s);
  const userOvr = userTeam(s).ovr;
  const uteam = season.teams[0]; uteam.name = s.managerName; uteam.formation = s.squad.formation; uteam.style = s.squad.style;
  const games = season.rounds[season.round];
  games.forEach((g, i) => { if (g.played) return; careerApply(season, g, careerScore(season.teams[g.a], season.teams[g.b], (season.seasonNo * 100003 + season.round * 997 + i * 73 + season.division * 7919) >>> 0, userOvr, c)); });
  const ug = games.find((g) => g.a === 0 || g.b === 0);
  const ugoals = ug.a === 0 ? ug.score[0] : ug.score[1], ogoals = ug.a === 0 ? ug.score[1] : ug.score[0];
  const opp = season.teams[ug.a === 0 ? ug.b : ug.a], won = ugoals > ogoals, drawn = ugoals === ogoals;
  s.stats.played++; s.stats.gf += ugoals; s.stats.ga += ogoals;
  if (won) { s.stats.wins++; s.stats.streak++; s.stats.bestStreak = Math.max(s.stats.bestStreak, s.stats.streak); event(s, 'wins'); }
  else if (drawn) { s.stats.draws++; s.stats.streak = 0; } else { s.stats.losses++; s.stats.streak = 0; }
  logMatch(s, { opp: opp.name, icon: opp.icon, gf: ugoals, ga: ogoals, round: `Career · ${CAREER_DIVISIONS[season.division]} MD${season.round + 1}`, r: won ? 'W' : drawn ? 'D' : 'L', draw: drawn });
  event(s, 'played'); if (ugoals) event(s, 'goals', ugoals); progressValue(s, 'streak', s.stats.streak);
  c.nextPlayAt = ctx.now + CAREER_COOLDOWN_MS;
  const matchPay = withFanShop(s, 35 + season.division * 12); earn(ctx, matchPay, 'career-match');
  season.round++;
  let seasonReward = 0;
  if (season.round >= season.rounds.length) {
    const table = careerTable(season), place = table.findIndex((t) => t.id === 'user') + 1, div = season.division;
    const bonus = [1, 0.72, 0.52, 0.36, 0.24, 0.16, 0.1, 0.06][place - 1] || 0.05;
    seasonReward = Math.round(careerReward(div) * (1 + bonus * 2.5));
    season.finished = true; season.place = place; season.seasonReward = seasonReward;
    let next = div; if (place <= 2 && div < CAREER_DIVISIONS.length - 1) next = div + 1; else if (place >= 7 && div > 0) next = div - 1;
    season.transition = next;
    earn(ctx, seasonReward, 'career-season');
    c.history.unshift({ division: CAREER_DIVISIONS[div], season: season.seasonNo, place, reward: seasonReward, points: table.find((t) => t.id === 'user').pts }); c.history = c.history.slice(0, 12);
  }
  trackPlayDay(s, ctx.now);
  return { score: [ugoals, ogoals], won, drawn, matchPay, seasonReward, finished: season.finished };
}
function careerNext(ctx) {
  const s = ctx.state, c = s.career;
  if (!c.season || !c.season.finished) throw bad('SEASON_NOT_FINISHED', 'Finish all 7 matchdays first.', 409);
  c.division = Math.max(0, Math.min(CAREER_DIVISIONS.length - 1, Number(c.season.transition) || 0)); c.seasonNo++; c.season = null; careerBuildSeason(s);
  return { division: c.division };
}


/* ---------------- Draft + Cup (tournament) ---------------- */
const DRAFT_BONUS = 75;
const CUP_MODES = ['draft', 'squad', 'commonrare', 'herbivore', 'carnivore'];
function draftPool(s) { const e = E(); return e.PLAYER_DATABASE.filter((p) => ((p.rarity !== 'Legendary' && p.rarity !== 'Dinosaur') || s.owned[p.id]) && (!p.exclusive || s.owned[p.id])); }
function draftWeight(s, p) { const e = E(); return e.GAME_DATA.DRAFT_WEIGHT[p.rarity] * (s.owned[p.id] ? e.GAME_DATA.DRAFT_OWNED_MULT : 1); }
const openSlots = (d) => { const r = []; d.slots.forEach((x, i) => { if (!x) r.push(i); }); return r; };
function draftFits(p, d) { const F = E().GAME_DATA.FORMATIONS[d.formation]; return openSlots(d).some((i) => { const pos = F.slots[i][0]; return p.pos === pos || p.sec === pos; }); }
function makeOffers(s, d, rnd) {
  const e = E(); const taken = new Set(d.picked);
  let rest = draftPool(s).filter((p) => !taken.has(p.id));
  if (rest.length < 5) rest = e.PLAYER_DATABASE.filter((p) => !taken.has(p.id) && (!p.exclusive || s.owned[p.id]) && (p.rarity !== 'Dinosaur' || s.owned[p.id]));
  const chosen = []; const n = Math.min(5, rest.length);
  for (let i = 0; i < n; i++) { const p = e.weightedPick(rest, (x) => draftWeight(s, x), rnd); chosen.push(p); rest = rest.filter((x) => x !== p); }
  let fitCount = chosen.filter((p) => draftFits(p, d)).length;
  const fitRest = rest.filter((p) => draftFits(p, d));
  while (openSlots(d).length && fitCount < 2 && fitRest.length) {
    const idx = chosen.findIndex((p) => !draftFits(p, d)); if (idx < 0) break;
    const np = e.weightedPick(fitRest, (x) => draftWeight(s, x), rnd); chosen[idx] = np; fitRest.splice(fitRest.indexOf(np), 1); fitCount++;
  }
  return chosen.map((p) => p.id);
}
function draftStart(ctx, formation, rnd) {
  ctx.rnd = rnd;
  const e = E(), s = ctx.state;
  if (typeof formation !== 'string' || !e.GAME_DATA.FORMATIONS[formation]) throw bad('BAD_FORMATION', 'Unknown formation.');
  s.draftSquad = null;
  const d = { formation, slots: Array(11).fill(null), offers: [], picked: [], done: false };
  d.offers = makeOffers(s, d, rnd); s.draft = d;
  if (s.tournament && !s.tournament.over && s.tournament.mode === 'draft') s.tournament = null;
  return {};
}
function draftPick(ctx, playerId, slotIndex) {
  const s = ctx.state, d = s.draft;
  if (!d || d.done) throw bad('NO_DRAFT', 'Draft is not active.', 409);
  if (typeof playerId !== 'string' || !d.offers.includes(playerId)) throw bad('NOT_OFFERED', 'Player is not in the offer pool.', 403);
  const i = Number(slotIndex);
  if (!Number.isInteger(i) || i < 0 || i > 10 || d.slots[i]) throw bad('BAD_SLOT', 'That slot is already occupied.', 409);
  d.slots[i] = playerId; d.picked.push(playerId);
  if (d.slots.every(Boolean)) {
    d.done = true; d.offers = [];
    earn(ctx, DRAFT_BONUS, 'draft-complete');
    s.draftSquad = { formation: d.formation, slots: d.slots.slice(), style: (s.draftSquad && s.draftSquad.style) || 'balanced' };
    if (s.tournament && s.tournament.mode === 'draft') s.tournament = null;
    recordBest(s, s.draftSquad);
  } else d.offers = makeOffers(s, d, ctx.rnd);
  return { done: d.done };
}
function draftClear(ctx) { ctx.state.draft = null; return {}; }

function cupTeam(s, t, idx) {
  const e = E(), d = t.teams[idx];
  if (d.type === 'user') return engine.buildTeam({ formation: d.formation, ids: d.ids, style: d.style, upg: s.upgrades, facilities: s.facilities }, { name: s.managerName, icon: '🐾', c1: s.crest.primary, c2: s.crest.secondary });
  const c = e.GAME_DATA.CLUBS.find((x) => x.id === d.clubId);
  return e.SQUAD_SYSTEM.buildTeam({ name: c.name, icon: c.icon, c1: c.c1, c2: c.c2, stadium: c.stadium, formation: d.formation, ids: d.ids, style: d.style, boost: d.boost, clubId: c.id });
}
const CUP = { baseBoost: -3, spread: [-4, -2, -1, 0, 1, 2, 4], firstDiscount: 6, rampPerTournament: 0.3, rampMax: 3 };
function cupCreate(ctx, mode, seedRnd) {
  const e = E(), s = ctx.state;
  mode = CUP_MODES.includes(mode) ? mode : 'draft';
  if (s.tournament && !s.tournament.over) throw bad('CUP_ACTIVE', 'You have a tournament in progress - continue it.', 409);
  s.tournament = null;
  const sq = mode === 'draft' ? s.draftSquad : s.squad;
  if (!isComplete(sq)) throw bad('SQUAD_INCOMPLETE', mode === 'draft' ? 'Complete the draft first (11 players)!' : 'Fill all 11 slots in Squad first!', 409);
  if (mode !== 'draft') {
    if (!sq.slots.every((id) => s.owned[id] > 0)) throw bad('NOT_OWNED', 'Your squad contains a card you do not own.', 403);
    const bad2 = sq.slots.map((id) => e.PLAYER_BY_ID[id]).filter((p) => !p || (mode === 'commonrare' && !['Common', 'Rare'].includes(p.rarity)) || (mode === 'herbivore' && p.diet !== 'H') || (mode === 'carnivore' && p.diet !== 'C'));
    if (bad2.length) throw bad('MODE_RESTRICTION', 'Your Squad does not meet the restrictions of this Cup.', 409);
  } else if (!sq.slots.every((id) => e.PLAYER_BY_ID[id])) throw bad('INVALID_SQUAD', 'Invalid draft squad.');
  const seed = seedFrom(seedRnd), rnd = e.mulberry32(seed);
  const played = s.stats.tournaments, ramp = Math.min(CUP.rampMax, played * CUP.rampPerTournament);
  const base = CUP.baseBoost + ramp - (played === 0 ? CUP.firstDiscount : 0);
  const clubs = e.shuffled(e.GAME_DATA.CLUBS, rnd).slice(0, 7), spread = e.shuffled(CUP.spread, rnd);
  const teams = [{ type: 'user', name: s.managerName, formation: sq.formation, ids: sq.slots.slice(), style: sq.style, boost: 0 }];
  clubs.forEach((c, i) => { const fid = c.fm[Math.floor(rnd() * c.fm.length)]; teams.push({ type: 'ai', clubId: c.id, name: c.name, formation: fid, ids: genAISquad(c, rnd, fid), style: c.style, boost: Math.round(base + spread[i]) }); });
  const order = e.shuffled([0, 1, 2, 3, 4, 5, 6, 7], rnd);
  const mk = (a, b) => ({ a, b, done: false, score: null, pens: null, winner: null });
  s.tournament = { id: 't' + seed, mode, seed, teams, round: 0, paid: 0, over: false, result: null, champion: null,
    bracket: [[mk(order[0], order[1]), mk(order[2], order[3]), mk(order[4], order[5]), mk(order[6], order[7])], [mk(null, null), mk(null, null)], [mk(null, null)]] };
  if (mode === 'draft') { s.draftSquad = null; s.draft = null; }
  return {};
}
const cupMatchSeed = (t, r, i) => (t.seed + r * 1000 + i * 17 + 5) >>> 0;
function cupSimAI(s, t, r, i) {
  const m = t.bracket[r][i]; if (m.done) return;
  const res = engine.simulate([cupTeam(s, t, m.a), cupTeam(s, t, m.b)], cupMatchSeed(t, r, i));
  m.done = true; m.score = res.score; m.pens = res.pens; m.winner = res.winner === 0 ? m.a : m.b;
}
function cupAdvance(t, r) {
  if (r >= 2) return;
  t.bracket[r + 1].forEach((nm, k) => { const a = t.bracket[r][2 * k], b = t.bracket[r][2 * k + 1]; if (a.done && b.done && nm.a === null) { nm.a = a.winner; nm.b = b.winner; } });
}
function cupPlay(ctx) {
  const e = E(), s = ctx.state, t = s.tournament; ensureTime(s, ctx.now);
  if (!t || t.over) throw bad('NO_CUP', 'There is no match to play right now.', 409);
  const r = t.round, mi = t.bracket[r].findIndex((m) => !m.done && (m.a === 0 || m.b === 0));
  if (mi < 0) throw bad('NO_MATCH', 'No match available.', 409);
  if (t.mode !== 'draft') { if (!t.teams[0].ids.every((id) => s.owned[id] > 0)) throw bad('NOT_OWNED', 'Your squad contains a card you do not own.', 403); }
  const m = t.bracket[r][mi], oppIdx = m.a === 0 ? m.b : m.a;
  const U = cupTeam(s, t, 0), O = cupTeam(s, t, oppIdx);
  const res = engine.simulate([U, O], cupMatchSeed(t, r, mi));
  const userIsA = m.a === 0;
  m.done = true; m.score = userIsA ? res.score.slice() : res.score.slice().reverse();
  m.pens = res.pens ? (userIsA ? res.pens.slice() : res.pens.slice().reverse()) : null;
  const won = res.winner === 0; m.winner = won ? 0 : oppIdx;
  t.bracket[r].forEach((mm, i) => { if (i !== mi) cupSimAI(s, t, r, i); });
  const S = s.stats, [gf, ga] = res.score;
  S.played++; S.gf += gf; S.ga += ga; S.saves += res.stats.saves[0] || 0;
  if (gf > ga) S.wins++; else if (gf < ga) S.losses++; else S.draws++;
  if (won) { S.streak++; S.bestStreak = Math.max(S.bestStreak, S.streak); } else S.streak = 0;
  logMatch(s, { opp: O.name, icon: O.icon, gf, ga, pens: res.pens, round: e.GAME_DATA.ROUND_NAMES[r], r: won ? 'W' : 'L', draw: gf === ga });
  const R = e.GAME_DATA.REWARDS;
  const total = won ? [R.sf, R.final, R.win][r] : [R.qf, R.sf, R.final][r];
  const pay = Math.max(0, total - t.paid); t.paid = Math.max(t.paid, total);
  const payBonus = withFanShop(s, pay); earn(ctx, payBonus, 'cup:' + t.mode + ':r' + r);
  if (r === 2) S.finals++;
  if (won && r < 2) { cupAdvance(t, r); t.round = r + 1; }
  else {
    t.over = true; S.tournaments++; t.result = won ? 'win' : ['qf', 'sf', 'final'][r];
    if (won) { S.trophies++; t.champion = 0; }
    else { for (let rr = r; rr <= 2; rr++) { t.bracket[rr].forEach((mm, i) => { if (mm.a !== null && !mm.done) cupSimAI(s, t, rr, i); }); if (rr < 2) cupAdvance(t, rr); } t.champion = t.bracket[2][0].winner; }
  }
  // mission events (same rules as the client used to apply)
  event(s, 'played'); if (won) event(s, 'wins'); if (gf) event(s, 'goals', gf); if (won && ga === 0) event(s, 'cleanWins');
  if (U.formation === '433') event(s, 'form433'); if (U.formation === '442') event(s, 'form442');
  if (won && r === 2) event(s, 'tournaments'); if (won && t.mode === 'draft') event(s, 'draftWins');
  if (won) winEvents(s, U);
  progressValue(s, 'streak', S.streak); if (payBonus) event(s, 'earned', payBonus);
  trackPlayDay(s, ctx.now);
  return { won, pay: payBonus, total: t.paid, over: t.over, result: t.result, round: r, mi, oppIdx, score: [gf, ga], res };
}
function cupClear(ctx) {
  const t = ctx.state.tournament;
  if (t && !t.over) throw bad('CUP_ACTIVE', 'Finish the current Cup before choosing another.', 409);
  ctx.state.tournament = null; return {};
}

/* ---------------- backup: only non-authoritative preferences are accepted ---------------- */
function importBackup(ctx, data) {
  const s = ctx.state;
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw bad('BAD_BACKUP', 'Invalid backup.');
  const keep = { managerName: data.managerName, settings: data.settings };
  if (data.squad) { const q = cleanSquad(s, data.squad, true); if (q) keep.squad = q; }
  if (Array.isArray(data.savedSquads)) keep.savedSquads = data.savedSquads.map((x) => (x && cleanSquad(s, x, true) ? x : null));
  saveSquad(ctx, keep);
  if (data.crest && typeof data.crest === 'object') {
    const c = { primary: data.crest.primary, secondary: data.crest.secondary, symbol: data.crest.symbol };
    if (Number.isInteger(Number(data.crest.shape)) && crestUnlocked(s, Number(data.crest.shape)) && Number(data.crest.shape) < SHAPES) c.shape = Number(data.crest.shape);
    saveCrest(ctx, c);
  }
  return { applied: ['managerName', 'settings', 'squad', 'savedSquads', 'crest(colors/symbol/unlocked shape)'] };
}

function publicState(ctx) {
  const s = ctx.state; ensureTime(s, ctx.now);
  const exclusives = {}; Object.keys(EXCLUSIVE_QUESTS).forEach((id) => { exclusives[id] = exclusiveProgress(s, id); });
  return Object.assign({}, s, { coins: ctx.coins, exclusives, serverTime: ctx.now, prices: { crest: CREST_PRICE } });
}

module.exports = { draftStart, draftPick, draftClear, cupCreate, cupPlay, cupClear, ApiError, bad, newPlayer, ensureTime, buyPack, upgradeCard, upgradeFacility, buyCrest, saveCrest, claimExclusive, claimMission, claimBonus, applyPromoReward, saveSquad, playSquadGame, leagueStart, leaguePlay, careerPlay, careerNext, importBackup, publicState, EXCLUSIVE_QUESTS, exclusiveProgress, CREST_PRICE, SHAPES, START_COINS };
