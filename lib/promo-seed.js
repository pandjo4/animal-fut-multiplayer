'use strict';
// Initial promo codes (inserted once, never overwritten). These mirror the codes that used to be hard-coded in the
// browser game. Since the old client shipped them in plain JavaScript they must be treated as PUBLIC:
// set max_uses / expires_at / active=0 in the database (see README) or rotate them.
const engine = require('./engine');
function defaults() {
  const e = engine.load();
  const list = [
    { code: 'WILDXI-ADMIN1', type: 'card', value: 'crni-marlin' },
    { code: 'WILDXI-ADMIN2', type: 'card', value: 'skakavac' },
    { code: 'WILDXI-COINS-10000', type: 'coins', value: 10000 },
    { code: 'WILDXI-COINS-25000', type: 'coins', value: 25000 },
    { code: 'WILDXI-COINS-50000', type: 'coins', value: 50000 },
    { code: 'WILDXI-COINS-500000', type: 'coins', value: 500000 }
  ];
  [['WILDXI-TREX', 't-rex'], ['WILDXI-STEGO', 'stegosaurus'], ['WILDXI-RAPTOR', 'velociraptor'], ['WILDXI-GALLI', 'gallimimus'], ['WILDXI-SPINO', 'spinosaurus'], ['WILDXI-BRACHIO', 'brachiosaurus'], ['WILDXI-PTERA', 'pteranodon']]
    .forEach(([code, id]) => list.push({ code, type: 'card', value: id }));
  return list.filter((p) => p.type !== 'card' || e.PLAYER_BY_ID[p.value]);
}
function load() {
  if (process.env.PROMO_SEED_JSON) { try { const j = JSON.parse(process.env.PROMO_SEED_JSON); if (Array.isArray(j)) return j; } catch (_) { console.error('[promo] PROMO_SEED_JSON is not valid JSON; using defaults'); } }
  return defaults();
}
module.exports = { load, defaults };
