'use strict';
const assert = require('assert');
const { FakeIO } = require('./fake-io');
const { createService } = require('../lib/rooms');
const engine = require('../lib/engine');

const E = engine.load();
const ids = Object.keys(E.PLAYER_BY_ID).filter((k, i, a) => E.PLAYER_BY_ID[k].id === k).slice(0, 40);
const team = (f, off, style) => ({ formation: f || '433', ids: ids.slice(off || 0, (off || 0) + 11), style: style || 'balanced', upg: { [ids[off || 0]]: 2 } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 8000) => { const t = Date.now(); while (!fn()) { if (Date.now() - t > ms) throw new Error('timeout waiting for condition'); await sleep(5); } };

let passed = 0, failed = 0;
async function test(name, fn, cfg) {
  const io = new FakeIO();
  const svc = createService(io, Object.assign({ COUNTDOWN_MS: 30, EVENT_MS: 1, RESUME_DELAY_MS: 20, PAUSE_GRACE_MS: 400, DROP_GRACE_MS: 300, RATE_MAX: 1000 }, cfg || {}));
  io.onConn = (s) => svc.attach(s);
  try { await fn(io, svc); passed++; console.log('  ✓', name); }
  catch (e) { failed++; console.log('  ✗', name, '\n     ', e.stack.split('\n').slice(0, 4).join('\n      ')); }
  svc.shutdown();
}
// helper: two players in a lobby, both with teams + ready
async function lobby(io, svc) {
  const A = io.connect(), B = io.connect();
  const ca = A.call('room:create', { name: 'Alice' });
  const cb = B.call('room:join', { code: ca.code, name: 'Bob' });
  assert(ca.ok && cb.ok, 'create/join');
  assert(A.call('team:submit', { team: team('433', 0) }).ok);
  assert(B.call('team:submit', { team: team('442', 11, 'press') }).ok);
  return { A, B, code: ca.code, ta: ca.token, tb: cb.token };
}
const ready = (A, B) => { A.call('ready:set', { ready: true }); B.call('ready:set', { ready: true }); };

(async () => {
  console.log('Server tests');

  await test('engine on server is deterministic and matches repeated runs', async () => {
    const mk = (n) => engine.buildTeam({ formation: '433', ids: ids.slice(0, 11), style: 'balanced', upg: {} }, { name: n, icon: 'x', c1: '#fff', c2: '#000' });
    const a = engine.simulate([mk('A'), mk('B')], 777), b = engine.simulate([mk('A'), mk('B')], 777);
    assert.deepStrictEqual(a, b);
    assert(a.events.length > 80);
  });

  await test('create room -> code format, host in lobby', async (io) => {
    const A = io.connect(); const r = A.call('room:create', { name: 'Alice' });
    assert(r.ok && /^[A-HJ-NP-Z2-9]{5}$/.test(r.code)); assert.strictEqual(r.state.phase, 'lobby'); assert.strictEqual(r.state.players.length, 1);
    assert(!JSON.stringify(r.state).includes(r.token), 'token must not leak in state');
  });

  await test('second player joins with correct code (lowercase/spaces tolerated); host is notified', async (io) => {
    const A = io.connect(), B = io.connect(); const c = A.call('room:create', { name: 'Alice' });
    const j = B.call('room:join', { code: ' ' + c.code.toLowerCase() + ' ', name: 'Bob' });
    assert(j.ok && j.state.players.length === 2 && j.state.youIndex === 1);
    assert.strictEqual(A.events('room:state').pop().players.length, 2);
  });

  await test('incorrect room code, malformed code', async (io) => {
    const B = io.connect();
    assert.strictEqual(B.call('room:join', { code: 'ZZZZZ' }).code, 'ROOM_NOT_FOUND');
    assert.strictEqual(B.call('room:join', { code: 'AB' }).code, 'INVALID_CODE');
    assert.strictEqual(B.call('room:join', {}).code, 'INVALID_CODE');
  });

  await test('brute-force joins are throttled', async (io) => {
    const B = io.connect(); let last;
    for (let i = 0; i < 12; i++) last = B.call('room:join', { code: 'ZZZZ' + (i % 9 + 2) });
    assert.strictEqual(last.code, 'RATE_LIMITED');
  });

  await test('third player cannot join a full room', async (io) => {
    const { code } = await lobby(io); const C = io.connect();
    assert.strictEqual(C.call('room:join', { code, name: 'Eve' }).code, 'ROOM_FULL');
  });

  await test('cannot create/join multiple rooms with one connection', async (io) => {
    const A = io.connect(); const c = A.call('room:create', { name: 'A' });
    const again = A.call('room:create', { name: 'A' });
    assert.strictEqual(again.code, 'ALREADY_IN_ROOM'); assert.strictEqual(again.state.code, c.code);
    const B = io.connect(); const b = B.call('room:create', { name: 'B' });
    assert.strictEqual(B.call('room:join', { code: c.code }).code, 'ALREADY_IN_ROOM');
  });

  await test('host leaves in lobby -> guest becomes host, room stays', async (io, svc) => {
    const { A, B, code } = await lobby(io);
    A.call('room:leave', {});
    const st = B.events('room:state').pop();
    assert.strictEqual(st.players.length, 1); assert.strictEqual(st.youIndex, 0); assert(st.players[0].isHost);
    assert(svc.rooms.has(code));
    const C = io.connect(); assert(C.call('room:join', { code, name: 'Cara' }).ok);
  });

  await test('last player leaving destroys the room', async (io, svc) => {
    const A = io.connect(); const c = A.call('room:create', { name: 'A' });
    A.call('room:leave', {}); assert(!svc.rooms.has(c.code));
    const B = io.connect(); assert.strictEqual(B.call('room:join', { code: c.code }).code, 'ROOM_NOT_FOUND');
  });

  await test('leave then create/join another room', async (io) => {
    const A = io.connect(); const c1 = A.call('room:create', { name: 'A' });
    A.call('room:leave', {});
    const c2 = A.call('room:create', { name: 'A' }); assert(c2.ok && c2.code !== undefined);
    const B = io.connect(), C = io.connect(); const cb = B.call('room:create', { name: 'B' });
    A.call('room:leave', {}); assert(A.call('room:join', { code: cb.code }).ok);
  }, { });

  await test('validation: start needs host, opponent, teams and ready', async (io) => {
    const A = io.connect(), B = io.connect(); const c = A.call('room:create', { name: 'A' });
    assert.strictEqual(A.call('match:start', {}).code, 'NEED_OPPONENT');
    B.call('room:join', { code: c.code });
    assert.strictEqual(A.call('match:start', {}).code, 'NOT_READY');
    assert.strictEqual(A.call('ready:set', { ready: true }).code, 'NO_TEAM');
    A.call('team:submit', { team: team('433', 0) }); B.call('team:submit', { team: team('433', 11) });
    A.call('ready:set', { ready: true });
    assert.strictEqual(A.call('match:start', {}).code, 'NOT_READY');
    B.call('ready:set', { ready: true });
    assert.strictEqual(B.call('match:start', {}).code, 'NOT_HOST');
  });

  await test('invalid teams rejected (unknown animal, duplicates, wrong size, bad formation)', async (io) => {
    const A = io.connect(); A.call('room:create', { name: 'A' });
    const t = team();
    assert.strictEqual(A.call('team:submit', { team: { ...t, ids: [...t.ids.slice(0, 10), 'dragon'] } }).code, 'INVALID_TEAM');
    assert.strictEqual(A.call('team:submit', { team: { ...t, ids: [...t.ids.slice(0, 10), t.ids[0]] } }).code, 'INVALID_TEAM');
    assert.strictEqual(A.call('team:submit', { team: { ...t, ids: t.ids.slice(0, 10) } }).code, 'INVALID_TEAM');
    assert.strictEqual(A.call('team:submit', { team: { ...t, formation: '999' } }).code, 'INVALID_TEAM');
    assert.strictEqual(A.call('team:submit', {}).code, 'INVALID_TEAM');
  });

  await test('full synchronized match: both clients get identical ordered events, score and result', async (io) => {
    const { A, B } = await lobby(io); ready(A, B);
    // both press start simultaneously: exactly one match is created
    const r1 = A.call('match:start', {}), r2 = A.call('match:start', {});
    assert(r1.ok); assert.strictEqual(r2.code, 'ALREADY_STARTED');
    assert.strictEqual(A.events('match:begin').length, 1);
    await until(() => A.events('match:end').length && B.events('match:end').length);
    const ea = A.events('match:event'), eb = B.events('match:event');
    assert.deepStrictEqual(ea, eb, 'both clients receive identical streams');
    ea.forEach((x, i) => assert.strictEqual(x.seq, i));
    const endA = A.events('match:end')[0].result, endB = B.events('match:end')[0].result;
    assert.deepStrictEqual(endA, endB);
    assert.strictEqual(endA.eventCount, ea.length);
    const last = ea[ea.length - 1].event.score;
    assert.deepStrictEqual(endA.score, last, 'final score equals last event score');
    const goalsFromEvents = ea.filter((x) => x.event.kind === 'goal' && !x.event.penShootout).length;
    assert.strictEqual(goalsFromEvents, endA.score[0] + endA.score[1], 'each goal counted exactly once');
    assert(endA.winner === 0 || endA.winner === 1);
    // each side's team is the right player's team
    const bg = A.events('match:begin')[0], bg2 = B.events('match:begin')[0];
    assert.strictEqual(bg.teams[0].name, 'Alice'); assert.strictEqual(bg.teams[1].name, 'Bob');
    assert.strictEqual(bg.mySide, 0); assert.strictEqual(bg2.mySide, 1);
    assert.deepStrictEqual(bg.teams[0].ids, team('433', 0).ids); assert.deepStrictEqual(bg.teams[1].ids, team('442', 11).ids);
    assert.strictEqual(bg.teams[1].formation, '442'); assert.strictEqual(bg.teams[1].styleId, 'press');
    assert.strictEqual(bg.teams[0].upg[ids[0]], 2);
  });

  await test('team changes / ready changes rejected during a match; start before ready rejected', async (io) => {
    const { A, B } = await lobby(io);
    assert.strictEqual(A.call('match:start', {}).code, 'NOT_READY');
    ready(A, B); A.call('match:start', {});
    assert.strictEqual(A.call('team:submit', { team: team() }).code, 'WRONG_PHASE');
    assert.strictEqual(B.call('ready:set', { ready: false }).code, 'WRONG_PHASE');
  }, { EVENT_MS: 20 });

  await test('impersonation: payload identity/side/score fields are ignored', async (io, svc) => {
    const { A, B, code, ta } = await lobby(io); ready(A, B);
    const evil = B.call('team:submit', { team: team('433', 22), token: ta, side: 0, seat: 0, score: [9, 0] });
    assert(evil.ok);
    const st = svc.rooms.get(code);
    assert.strictEqual(st.players[0].team.ids[0], ids[0], 'host team untouched');
    assert.strictEqual(st.players[1].team.ids[0], ids[22]);
    // outsider with a stolen-looking payload cannot act
    const X = io.connect();
    assert.strictEqual(X.call('match:start', { code, token: ta }).code, 'NOT_IN_ROOM');
    assert.strictEqual(X.call('ready:set', { ready: true, code }).code, 'NOT_IN_ROOM');
    assert.strictEqual(X.call('match:sync', { code }).code, 'NOT_IN_ROOM');
    // clients cannot inject a result or events
    X.emit('match:end', { result: { winner: 0 } }); X.emit('match:event', { seq: 0 });
    assert.strictEqual(A.events('match:end').length, 0);
  });

  await test('guest cannot hijack host seat with a join payload token of the wrong value', async (io) => {
    const { code } = await lobby(io); const X = io.connect();
    assert.strictEqual(X.call('room:join', { code, token: 'deadbeef' }).code, 'ROOM_FULL');
    assert.strictEqual(X.call('room:resume', { code, token: 'deadbeef' }).code, 'NOT_IN_ROOM');
  });

  await test('refresh in lobby: resume with token on a new socket replaces the old one', async (io, svc) => {
    const { A, B, code, ta } = await lobby(io);
    const A2 = io.connect(); const r = A2.call('room:resume', { code, token: ta });
    assert(r.ok && r.resumed && r.state.youIndex === 0 && r.state.players[0].team);
    assert.strictEqual(A.events('session:replaced').length, 1);
    assert.strictEqual(svc.rooms.get(code).players.length, 2, 'no duplicate player');
    A.disconnect(); // old tab closing must not mark the player offline
    assert.strictEqual(svc.rooms.get(code).players[0].connected, true);
  });

  await test('refresh mid-match: pause, resume gets snapshot, match completes once, no duplicates', async (io, svc) => {
    const { A, B, code, ta } = await lobby(io); ready(A, B);
    A.call('match:start', {});
    await until(() => B.events('match:event').length > 12);
    A.disconnect();
    await until(() => B.events('match:paused').length === 1);
    const n = B.events('match:event').length; await sleep(60);
    assert(B.events('match:event').length <= n + 1, 'match is paused while a player is away');
    const A2 = io.connect(); const r = A2.call('room:resume', { code, token: ta });
    assert(r.ok && r.snapshot && r.snapshot.events.length >= n);
    r.snapshot.events.forEach((e, i) => assert.strictEqual(e.score.length, 2) || assert(i >= 0));
    await until(() => B.events('match:end').length === 1 && A2.events('match:end').length === 1);
    assert.strictEqual(B.events('match:resumed').length, 1);
    const all = [...r.snapshot.events.map((e, i) => ({ seq: i, event: e })), ...A2.events('match:event')];
    const bySeq = new Map(); all.forEach((x) => bySeq.set(x.seq, x));
    const merged = Array.from(bySeq.keys()).sort((a, b) => a - b).map((k) => bySeq.get(k).event);
    assert.deepStrictEqual(merged, B.events('match:event').map((x) => x.event), 'reconnected client reconstructs the same event list');
    assert.strictEqual(svc.rooms.get(code).players.length, 2);
  }, { EVENT_MS: 6 });

  await test('disconnected player who never returns: match resumes after grace and still finishes; state shows offline', async (io, svc) => {
    const { A, B, code } = await lobby(io); ready(A, B); A.call('match:start', {});
    await until(() => B.events('match:event').length > 5);
    A.disconnect();
    await until(() => B.events('match:end').length === 1, 4000);
    const st = B.events('room:state').pop();
    assert.strictEqual(st.players[0].connected, false); assert.strictEqual(st.phase, 'finished');
    assert.strictEqual(svc.rooms.get(code).match.status, 'finished');
  }, { EVENT_MS: 4, PAUSE_GRACE_MS: 120 });

  await test('leaving mid-match = forfeit for the leaver; opponent gets match:end once', async (io) => {
    const { A, B } = await lobby(io); ready(A, B); A.call('match:start', {});
    await until(() => B.events('match:event').length > 3);
    A.call('room:leave', {});
    const ends = B.events('match:end'); assert.strictEqual(ends.length, 1);
    assert(ends[0].result.forfeit); assert.strictEqual(ends[0].result.winner, 1);
    const n = B.events('match:event').length; await sleep(80);
    assert.strictEqual(B.events('match:event').length, n, 'no further events after forfeit');
    assert.strictEqual(B.events('room:state').pop().players.length, 1);
  }, { EVENT_MS: 15 });

  await test('rematch: needs both, swaps sides, new match id; duplicate rematch requests harmless', async (io) => {
    const { A, B } = await lobby(io); ready(A, B); A.call('match:start', {});
    await until(() => A.events('match:end').length === 1);
    assert.strictEqual(A.call('match:start', {}).code, 'WRONG_PHASE');
    assert(A.call('match:rematch', {}).ok); assert(A.call('match:rematch', {}).ok);
    assert.strictEqual(A.events('match:begin').length, 1, 'one request is not enough');
    assert(B.call('match:rematch', {}).ok);
    assert.strictEqual(A.events('match:begin').length, 2);
    const b1 = A.events('match:begin')[0], b2 = A.events('match:begin')[1];
    assert.notStrictEqual(b1.matchId, b2.matchId); assert.strictEqual(b2.mySide, 1);
    assert.strictEqual(b2.teams[0].name, 'Bob');
    assert.strictEqual(B.call('match:rematch', {}).code, 'ALREADY_STARTED');
    await until(() => A.events('match:end').length === 2 && B.events('match:end').length === 2);
    assert.strictEqual(A.events('match:event').filter((e) => e.matchId === b2.matchId).length, A.events('match:end')[1].result.eventCount);
  });

  await test('back to lobby after match lets players change teams and ready up again', async (io) => {
    const { A, B } = await lobby(io); ready(A, B); A.call('match:start', {});
    await until(() => B.events('match:end').length === 1);
    assert(B.call('room:toLobby', {}).ok);
    const st = A.events('room:state').pop(); assert.strictEqual(st.phase, 'lobby'); assert(st.players.every((p) => !p.ready));
    assert(A.call('team:submit', { team: team('352', 5) }).ok);
  });

  await test('opponent leaves after the match: remaining player keeps result, can wait for new opponent', async (io) => {
    const { A, B, code } = await lobby(io); ready(A, B); A.call('match:start', {});
    await until(() => B.events('match:end').length === 1);
    A.call('room:leave', {});
    const st = B.events('room:state').pop(); assert.strictEqual(st.phase, 'finished'); assert(st.match.result);
    assert.strictEqual(B.call('match:rematch', {}).code, 'NEED_OPPONENT');
    B.call('room:toLobby', {});
    const C = io.connect(); assert(C.call('room:join', { code, name: 'Cara' }).ok);
  });

  await test('lobby disconnect: seat kept during grace, freed afterwards', async (io, svc) => {
    const { A, B, code, tb } = await lobby(io);
    B.disconnect();
    assert.strictEqual(svc.rooms.get(code).players[1].connected, false);
    const B2 = io.connect(); assert(B2.call('room:resume', { code, token: tb }).ok);
    A.disconnect(); await sleep(450);
    const room = svc.rooms.get(code);
    assert(room && room.players.length === 1 && room.players[0].name === 'Bob', 'timed-out host removed, guest promoted');
  });

  await test('abandoned rooms are cleaned up by the sweeper', async (io, svc) => {
    const A = io.connect(); const c = A.call('room:create', { name: 'A' });
    A.disconnect(); await sleep(450); // drop grace removes the only player -> room destroyed
    assert(!svc.rooms.has(c.code));
    const B = io.connect(); const c2 = B.call('room:create', { name: 'B' }); const b = B.call('room:leave', {});
    assert(!svc.rooms.has(c2.code));
  });

  await test('sweep removes idle/expired rooms and clears timers', async (io, svc) => {
    const { A, B, code } = await lobby(io);
    svc.rooms.get(code).lastActive = Date.now() - svc.config.LOBBY_IDLE_MS - 1000;
    svc.sweep(); assert(!svc.rooms.has(code));
    assert.strictEqual(A.events('room:closed').length, 1);
  });

  await test('resume of a non-existent room (server restarted) is reported cleanly', async (io) => {
    const A = io.connect(); assert.strictEqual(A.call('room:resume', { code: 'ABCDE', token: 'x' }).code, 'ROOM_NOT_FOUND');
  });

  await test('same name for both players is disambiguated in match text', async (io) => {
    const A = io.connect(), B = io.connect(); const c = A.call('room:create', { name: 'Sam' }); B.call('room:join', { code: c.code, name: 'sam' });
    A.call('team:submit', { team: team('433', 0) }); B.call('team:submit', { team: team('433', 11) }); ready(A, B); A.call('match:start', {});
    const bg = A.events('match:begin')[0]; assert.notStrictEqual(bg.teams[0].name.toLowerCase(), bg.teams[1].name.toLowerCase());
  });

  await test('garbage payloads never crash the server', async (io) => {
    const A = io.connect();
    for (const ev of ['room:create', 'room:join', 'room:resume', 'team:submit', 'ready:set', 'match:start', 'match:rematch', 'match:sync', 'room:toLobby', 'room:leave'])
      for (const p of [null, 5, 'x', [], { team: 5 }, { code: {} }, { name: { a: 1 } }]) { A.emit(ev, p, () => {}); }
    assert(true);
  });

  await test('rate limiter blocks floods', async (io) => {
    const A = io.connect(); let limited = false;
    for (let i = 0; i < 20; i++) if (A.call('ready:set', {}).code === 'RATE_LIMITED') limited = true;
    assert(limited);
  }, { RATE_MAX: 10 });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
