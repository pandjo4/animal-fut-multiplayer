'use strict';
// Loads the game's own data + match engine (copied from the frontend by tools/sync-engine.js)
// into an isolated vm context, so the server simulates with exactly the same code as the browser.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let E = null;
function load() {
  if (E) return E;
  const dir = path.join(__dirname, '..', 'game');
  const sb = { console, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(dir, 'animals.js'), 'utf8'), sb, { filename: 'animals.js' });
  E = vm.runInContext(
    fs.readFileSync(path.join(dir, 'engine-src.js'), 'utf8') +
      '\n;({ GAME_DATA, PLAYER_BY_ID, SQUAD_SYSTEM, MATCH_ENGINE, canonicalPlayerId })',
    sb, { filename: 'engine-src.js' });
  return E;
}
const plain = (o) => JSON.parse(JSON.stringify(o)); // strip vm-realm prototypes

const fail = (message) => ({ ok: false, message });

// Validates a client-supplied team. Nothing from the client is trusted beyond ids/formation/style/upgrade levels.
function validateTeam(raw) {
  const e = load();
  if (!raw || typeof raw !== 'object') return fail('Team data is missing.');
  const formation = String(raw.formation);
  if (!e.GAME_DATA.FORMATIONS[formation]) return fail('Unknown formation.');
  if (!Array.isArray(raw.ids) || raw.ids.length !== 11) return fail('A team needs exactly 11 players.');
  const ids = [], seen = new Set();
  for (const id of raw.ids) {
    if (typeof id !== 'string' || id.length > 64) return fail('Invalid player in team.');
    const c = e.canonicalPlayerId(id);
    if (!c || !e.PLAYER_BY_ID[c]) return fail('Unknown animal "' + id.slice(0, 30) + '". Make sure the game and server are the same version.');
    if (seen.has(c)) return fail('The same animal appears twice in the team.');
    seen.add(c); ids.push(c);
  }
  const style = e.GAME_DATA.STYLES[raw.style] ? raw.style : 'balanced';
  const upg = {};
  if (raw.upg && typeof raw.upg === 'object') {
    for (const id of ids) {
      const lv = Number(raw.upg[id]);
      if (Number.isInteger(lv) && lv >= 1 && lv <= 3 && !e.PLAYER_BY_ID[id].exclusive) upg[id] = lv;
    }
  }
  return { ok: true, team: { formation, ids, style, upg } };
}

function buildTeam(team, meta) {
  const e = load();
  return e.SQUAD_SYSTEM.buildTeam({
    name: meta.name, icon: meta.icon, c1: meta.c1, c2: meta.c2, stadium: 'Wild Arena',
    formation: team.formation, ids: team.ids, style: team.style, upg: team.upg
  });
}

// Small, serialisable description of a built team (what clients display).
function viewOf(t, team) {
  return {
    name: t.name, icon: t.icon, c1: t.c1, c2: t.c2, stadium: t.stadium,
    formation: team.formation, formationName: t.fm.name, styleId: t.styleId, styleName: t.style.name, styleIcon: t.style.icon,
    ovr: t.ovr, chem: t.chem.pct, atk: Math.round(t.atk), ctrl: Math.round(t.ctrl), def: Math.round(t.def),
    ids: team.ids.slice(), upg: Object.assign({}, team.upg)
  };
}
// Lobby summary (no line-up revealed before the match).
function summaryOf(team, name) {
  const t = buildTeam(team, { name, icon: '🐾', c1: '#f4c542', c2: '#7a5606' });
  const v = viewOf(t, team);
  return { formation: v.formation, formationName: v.formationName, styleName: v.styleName, styleIcon: v.styleIcon, ovr: v.ovr, chem: v.chem };
}
function simulate(teams, seed) {
  return plain(load().MATCH_ENGINE.simulate(teams, seed));
}
module.exports = { load, validateTeam, buildTeam, viewOf, summaryOf, simulate };
