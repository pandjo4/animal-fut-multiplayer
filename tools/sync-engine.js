'use strict';
/*
  Copies the game data + match engine from the frontend into server/game/.
  Run this whenever you change animals.js or the match engine / team logic in script.js:

      node tools/sync-engine.js ../frontend

  It extracts everything in script.js from the top up to (not including) DRAFT_SYSTEM:
  GAME_DATA, formations, player database, chemistry, SQUAD_SYSTEM (buildTeam) and MATCH_ENGINE.
*/
const fs = require('fs');
const path = require('path');
const src = path.resolve(process.argv[2] || path.join(__dirname, '..', '..', 'frontend'));
const dst = path.join(__dirname, '..', 'game');
const script = fs.readFileSync(path.join(src, 'script.js'), 'utf8');
const idx = script.indexOf('const DRAFT_SYSTEM');
if (idx < 0) throw new Error('Could not find DRAFT_SYSTEM in script.js');
const cut = script.lastIndexOf('/* ====', idx);
let engine = script.slice(0, cut);
engine = engine.replace(/^.*\bio\(.*$/gm, '// (socket line removed)');
fs.mkdirSync(dst, { recursive: true });
fs.writeFileSync(path.join(dst, 'engine-src.js'), engine);
fs.copyFileSync(path.join(src, 'animals.js'), path.join(dst, 'animals.js'));
console.log('Synced engine (' + engine.length + ' chars) and animals.js into', dst);
