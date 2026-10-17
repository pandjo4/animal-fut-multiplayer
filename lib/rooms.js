'use strict';
/*
  Room + match service. Transport-agnostic: it only needs socket-like objects
  ({ id, data, on, emit, join, leave }) and an io-like object ({ to(room).emit }),
  so it runs on Socket.IO in production and on fakes in test/run.js.

  Client -> server events (all take an optional ack callback):
    room:create {name}            room:join {code,name,token?}     room:resume {code,token}
    room:leave                    room:toLobby
    team:submit {team}            ready:set {ready}
    match:start                   match:rematch                    match:sync
  Server -> client events:
    room:state  room:closed  session:replaced
    match:begin  match:event  match:end  match:paused  match:resumed  match:snapshot

  Identity: every player gets a random secret token when they create/join. All actions are
  attributed from the socket's bound seat, never from anything in the payload.
*/
const crypto = require('crypto');
const engine = require('./engine');

const DEFAULTS = {
  CODE_LEN: 5,
  CODE_ALPHABET: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
  MAX_ROOMS: 300,
  COUNTDOWN_MS: 4000,
  EVENT_MS: 620,           // same pace as the offline "Normal" speed
  GOAL_MULT: 2.4,
  RESUME_DELAY_MS: 3000,
  PAUSE_GRACE_MS: 45000,   // match waits this long for a disconnected player
  DROP_GRACE_MS: 60000,    // a disconnected player keeps their seat this long
  LOBBY_IDLE_MS: 30 * 60e3,
  FINISHED_IDLE_MS: 20 * 60e3,
  ABANDONED_MS: 2 * 60e3,  // nobody connected
  MAX_AGE_MS: 6 * 3600e3,
  SWEEP_MS: 30000,
  RATE_MAX: 40, RATE_WINDOW_MS: 10000,
  JOIN_FAIL_MAX: 8, JOIN_FAIL_WINDOW_MS: 60000
};

const rid = (n) => crypto.randomBytes(n).toString('hex');
const cleanName = (s, fb) => {
  const n = String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 18);
  return n || fb;
};

const cleanCrest = (c) => {
  if (!c || typeof c !== 'object') return null;
  const hex = (v, d) => (/^#[0-9a-fA-F]{3,8}$/.test(String(v || '')) ? String(v) : d);
  return {
    shape: Math.max(0, Math.min(14, Math.floor(Number(c.shape)) || 0)),
    primary: hex(c.primary, '#d9a441'), secondary: hex(c.secondary, '#203a30'),
    symbol: String(c.symbol == null ? '' : c.symbol).replace(/[\u0000-\u001f\u007f<>&"']/g, '').slice(0, 12)
  };
};

function createService(io, options) {
  const C = Object.assign({}, DEFAULTS, options || {});
  const rooms = new Map();
  const sockets = new Map();
  let sweepTimer = null;

  /* ---------- helpers ---------- */
  function newCode() {
    for (let tries = 0; tries < 50; tries++) {
      let c = '';
      for (let i = 0; i < C.CODE_LEN; i++) c += C.CODE_ALPHABET[crypto.randomInt(C.CODE_ALPHABET.length)];
      if (!rooms.has(c)) return c;
    }
    return null;
  }
  const normCode = (s) => String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const touch = (room) => { room.lastActive = Date.now(); };
  const seatOf = (room, token) => room.players.find((p) => p.token === token) || null;
  const idxOf = (room, seat) => room.players.indexOf(seat);
  const bothConnected = (room) => room.players.length === 2 && room.players.every((p) => p.connected);

  function stateFor(room, seat) {
    const m = room.match;
    const you = idxOf(room, seat);
    return {
      code: room.code, phase: room.phase, youIndex: you,
      players: room.players.map((p, i) => ({
        index: i, name: p.name, isHost: i === 0, you: i === you, connected: p.connected,
        ready: p.ready, rematch: p.rematch, team: p.summary
      })),
      match: m ? {
        matchId: m.id, status: m.status, mySide: m.sideTokens.indexOf(seat.token), teams: m.views,
        eventCount: m.idx, result: m.result, paused: m.status === 'paused'
      } : null,
      serverTime: Date.now()
    };
  }
  function broadcastState(room) {
    for (const p of room.players) if (p.socketId) io.to(p.socketId).emit('room:state', stateFor(room, p));
  }
  function snapshotFor(room, seat) {
    const m = room.match;
    if (!m) return null;
    return { matchId: m.id, mySide: m.sideTokens.indexOf(seat.token), teams: m.views, status: m.status, events: m.events.slice(0, m.idx), result: m.result };
  }
  function bind(socket, room, seat) {
    seat.socketId = socket.id; seat.connected = true; seat.disconnectedAt = null;
    if (seat.dropTimer) { clearTimeout(seat.dropTimer); seat.dropTimer = null; }
    socket.data.roomCode = room.code; socket.data.token = seat.token;
    socket.join(room.code);
  }
  function unbind(socket, code) {
    if (!socket) return;
    socket.data.roomCode = null; socket.data.token = null;
    try { socket.leave(code); } catch (_) { /* ignore */ }
  }

  /* ---------- match engine driving ---------- */
  const delayAfter = (ev) => Math.round(C.EVENT_MS * (ev && ev.kind === 'goal' ? C.GOAL_MULT : 1));

  function startMatch(room) {
    const [a, b] = room.flip ? [room.players[1], room.players[0]] : [room.players[0], room.players[1]];
    let nameB = b.name;
    if (nameB.toLowerCase() === a.name.toLowerCase()) nameB = cleanName(nameB.slice(0, 16) + ' 2', 'Player 2');
    const sides = [
      { seat: a, name: a.name, icon: '🦁', c1: '#f4c542', c2: '#7a5606' },
      { seat: b, name: nameB, icon: '🐺', c1: '#5aa6ff', c2: '#1f4f8f' }
    ];
    const built = sides.map((s) => engine.buildTeam(s.seat.team, s));
    const views = sides.map((s, i) => engine.viewOf(built[i], s.seat.team));
    views.forEach((v, i) => { v.crest = sides[i].seat.crest || null; });
    const seed = crypto.randomInt(1, 2147483000);
    const res = engine.simulate(built, seed);
    const m = room.match = {
      id: rid(8), seed, sideTokens: [a.token, b.token], views, events: res.events, resultFull: res, idx: 0,
      status: 'countdown', timer: null, graceTimer: null, result: null, resumeAt: null
    };
    room.phase = 'playing';
    room.players.forEach((p) => { p.ready = false; p.rematch = false; });
    touch(room);
    for (const p of room.players) {
      if (!p.socketId) continue;
      io.to(p.socketId).emit('match:begin', { matchId: m.id, mySide: m.sideTokens.indexOf(p.token), teams: views, countdownMs: C.COUNTDOWN_MS, eventMs: C.EVENT_MS });
    }
    broadcastState(room);
    m.timer = setTimeout(() => tick(room, m.id), C.COUNTDOWN_MS);
  }
  function tick(room, matchId) {
    const m = room.match;
    if (!m || m.id !== matchId || m.status === 'finished' || m.status === 'paused') return;
    m.status = 'running';
    const ev = m.events[m.idx];
    io.to(room.code).emit('match:event', { matchId: m.id, seq: m.idx, event: ev });
    m.idx++; touch(room);
    if (m.idx >= m.events.length) m.timer = setTimeout(() => finishMatch(room, null), delayAfter(ev));
    else m.timer = setTimeout(() => tick(room, matchId), delayAfter(ev));
  }
  function finishMatch(room, forfeitSeat) {
    const m = room.match;
    if (!m || m.status === 'finished') return;
    clearTimeout(m.timer); clearTimeout(m.graceTimer);
    m.status = 'finished';
    if (forfeitSeat) {
      const loser = m.sideTokens.indexOf(forfeitSeat.token);
      const last = m.idx ? m.events[m.idx - 1] : null;
      m.result = { winner: 1 - loser, score: last ? last.score : [0, 0], pens: null, goals: [], forfeit: true, forfeitSide: loser, eventCount: m.idx };
    } else {
      const r = m.resultFull;
      m.result = { winner: r.winner, score: r.score, pens: r.pens, goals: r.goals, stats: r.stats, forfeit: false, eventCount: m.events.length };
    }
    room.phase = 'finished'; touch(room);
    io.to(room.code).emit('match:end', { matchId: m.id, result: m.result });
    broadcastState(room);
  }
  function pauseMatch(room) {
    const m = room.match;
    if (!m || (m.status !== 'running' && m.status !== 'countdown')) return;
    clearTimeout(m.timer); m.timer = null; m.status = 'paused';
    io.to(room.code).emit('match:paused', { matchId: m.id, graceMs: C.PAUSE_GRACE_MS });
    clearTimeout(m.graceTimer);
    m.graceTimer = setTimeout(() => resumeMatch(room, true), C.PAUSE_GRACE_MS);
  }
  function resumeMatch(room) {
    const m = room.match;
    if (!m || m.status !== 'paused') return;
    clearTimeout(m.graceTimer); m.graceTimer = null;
    m.status = 'running';
    io.to(room.code).emit('match:resumed', { matchId: m.id, inMs: C.RESUME_DELAY_MS });
    m.timer = setTimeout(() => tick(room, m.id), C.RESUME_DELAY_MS);
  }

  /* ---------- membership ---------- */
  function destroyRoom(room, reason) {
    if (!rooms.has(room.code)) return;
    if (room.match) { clearTimeout(room.match.timer); clearTimeout(room.match.graceTimer); }
    io.to(room.code).emit('room:closed', { reason });
    for (const p of room.players) {
      if (p.dropTimer) clearTimeout(p.dropTimer);
      const s = p.socketId && sockets.get(p.socketId);
      if (s) unbind(s, room.code);
    }
    rooms.delete(room.code);
  }
  function removeSeat(room, seat, reason) {
    const socket = seat.socketId && sockets.get(seat.socketId);
    if (seat.dropTimer) { clearTimeout(seat.dropTimer); seat.dropTimer = null; }
    if (room.phase === 'playing') finishMatch(room, seat); // leaving mid-match = forfeit
    room.players = room.players.filter((p) => p !== seat);
    if (socket) { socket.data.roomCode = null; socket.data.token = null; try { socket.leave(room.code); } catch (_) { /* ignore */ } }
    if (!room.players.length) { destroyRoom(room, reason); return; }
    room.players.forEach((p) => { p.ready = false; p.rematch = false; });
    if (room.phase !== 'finished') { room.phase = 'lobby'; room.match = null; }
    touch(room);
    broadcastState(room);
  }
  function armDrop(room, seat) {
    if (seat.dropTimer) clearTimeout(seat.dropTimer);
    seat.dropTimer = setTimeout(() => {
      seat.dropTimer = null;
      if (seat.connected || !rooms.has(room.code) || !room.players.includes(seat)) return;
      if (room.phase === 'playing') { armDrop(room, seat); return; } // never remove a seat mid-match
      removeSeat(room, seat, 'timeout');
    }, C.DROP_GRACE_MS);
  }

  /* ---------- socket wiring ---------- */
  function attach(socket) {
    socket.data = socket.data || {};
    sockets.set(socket.id, socket);
    const hits = [];
    let lastCreate = 0, joinFails = [];
    const allowed = () => {
      const now = Date.now();
      while (hits.length && hits[0] < now - C.RATE_WINDOW_MS) hits.shift();
      if (hits.length >= C.RATE_MAX) return false;
      hits.push(now); return true;
    };
    const ctx = () => {
      const room = rooms.get(socket.data.roomCode);
      if (!room) return null;
      const seat = seatOf(room, socket.data.token);
      if (!seat || seat.socketId !== socket.id) return null;
      return { room, seat };
    };
    const on = (ev, fn) => socket.on(ev, (payload, ack) => {
      if (typeof payload === 'function') { ack = payload; payload = {}; }
      const reply = typeof ack === 'function' ? ack : () => {};
      if (!allowed()) return reply({ ok: false, code: 'RATE_LIMITED', message: 'Too many requests. Slow down.' });
      if (payload == null || typeof payload !== 'object') payload = {};
      try { fn(payload, reply); }
      catch (e) { console.error('[handler error]', ev, e); reply({ ok: false, code: 'SERVER_ERROR', message: 'Something went wrong on the server.' }); }
    });
    const err = (reply, code, message, extra) => reply(Object.assign({ ok: false, code, message }, extra || {}));

    function resumeInto(room, seat, reply) {
      const old = seat.socketId && seat.socketId !== socket.id ? sockets.get(seat.socketId) : null;
      if (old) { unbind(old, room.code); old.emit('session:replaced', {}); }
      bind(socket, room, seat);
      touch(room);
      reply({ ok: true, resumed: true, code: room.code, token: seat.token, state: stateFor(room, seat), snapshot: snapshotFor(room, seat) });
      broadcastState(room);
      if (room.match && room.match.status === 'paused' && bothConnected(room)) resumeMatch(room);
    }

    on('room:create', (p, reply) => {
      if (socket.data.roomCode) {
        const c = ctx();
        return err(reply, 'ALREADY_IN_ROOM', 'You are already in a room. Leave it first.', c ? { state: stateFor(c.room, c.seat) } : {});
      }
      const now = Date.now();
      if (now - lastCreate < 2000) return err(reply, 'RATE_LIMITED', 'Please wait a moment before creating another room.');
      if (rooms.size >= C.MAX_ROOMS) return err(reply, 'SERVER_FULL', 'The server is busy. Try again in a few minutes.');
      const code = newCode();
      if (!code) return err(reply, 'SERVER_FULL', 'Could not create a room. Try again.');
      lastCreate = now;
      const seat = { token: rid(16), name: cleanName(p.name, 'Player 1'), crest: cleanCrest(p.crest), socketId: null, connected: true, disconnectedAt: null, team: null, summary: null, ready: false, rematch: false, dropTimer: null };
      const room = { code, createdAt: now, lastActive: now, phase: 'lobby', players: [seat], match: null, flip: false };
      rooms.set(code, room);
      bind(socket, room, seat);
      reply({ ok: true, code, token: seat.token, state: stateFor(room, seat) });
    });

    on('room:join', (p, reply) => {
      const now = Date.now();
      joinFails = joinFails.filter((t) => t > now - C.JOIN_FAIL_WINDOW_MS);
      if (joinFails.length >= C.JOIN_FAIL_MAX) return err(reply, 'RATE_LIMITED', 'Too many wrong codes. Wait a minute and try again.');
      const code = normCode(p.code);
      if (code.length !== C.CODE_LEN) return err(reply, 'INVALID_CODE', 'Room codes have ' + C.CODE_LEN + ' characters.');
      const room = rooms.get(code);
      if (!room) { joinFails.push(now); return err(reply, 'ROOM_NOT_FOUND', 'No room with that code. Check it and try again.'); }
      // same player coming back with their token = resume
      if (typeof p.token === 'string') {
        const s = seatOf(room, p.token);
        if (s) {
          if (socket.data.roomCode && socket.data.roomCode !== code) return err(reply, 'ALREADY_IN_ROOM', 'You are already in another room.');
          return resumeInto(room, s, reply);
        }
      }
      if (socket.data.roomCode) {
        const c = ctx();
        return err(reply, 'ALREADY_IN_ROOM', socket.data.roomCode === code ? 'You are already in this room.' : 'You are already in a room. Leave it first.', c ? { state: stateFor(c.room, c.seat) } : {});
      }
      if (room.players.length >= 2) return err(reply, 'ROOM_FULL', 'That room is already full.');
      const seat = { token: rid(16), name: cleanName(p.name, 'Player 2'), crest: cleanCrest(p.crest), socketId: null, connected: true, disconnectedAt: null, team: null, summary: null, ready: false, rematch: false, dropTimer: null };
      room.players.push(seat);
      // a new opponent always starts from a fresh lobby
      room.phase = 'lobby'; room.match = null; room.flip = false;
      room.players.forEach((q) => { q.ready = false; q.rematch = false; });
      bind(socket, room, seat); touch(room);
      reply({ ok: true, code, token: seat.token, state: stateFor(room, seat) });
      broadcastState(room);
    });

    on('room:resume', (p, reply) => {
      const code = normCode(p.code);
      const room = rooms.get(code);
      if (!room || typeof p.token !== 'string') return err(reply, 'ROOM_NOT_FOUND', 'That room no longer exists.');
      const seat = seatOf(room, p.token);
      if (!seat) return err(reply, 'NOT_IN_ROOM', 'You are not a member of that room.');
      if (socket.data.roomCode && socket.data.roomCode !== code) return err(reply, 'ALREADY_IN_ROOM', 'You are already in another room.');
      resumeInto(room, seat, reply);
    });

    on('room:leave', (p, reply) => {
      lastCreate = 0; // leaving frees the player to create/join again immediately
      const c = ctx();
      if (!c) { socket.data.roomCode = null; socket.data.token = null; return reply({ ok: true }); }
      removeSeat(c.room, c.seat, 'left');
      reply({ ok: true });
    });

    on('team:submit', (p, reply) => {
      const c = ctx(); if (!c) return err(reply, 'NOT_IN_ROOM', 'You are not in a room.');
      if (c.room.phase !== 'lobby') return err(reply, 'WRONG_PHASE', 'Teams can only be changed in the lobby.');
      const v = engine.validateTeam(p.team);
      if (!v.ok) return err(reply, 'INVALID_TEAM', v.message);
      c.seat.team = v.team;
      c.seat.summary = engine.summaryOf(v.team, c.seat.name);
      c.seat.ready = false; touch(c.room);
      reply({ ok: true });
      broadcastState(c.room);
    });

    on('ready:set', (p, reply) => {
      const c = ctx(); if (!c) return err(reply, 'NOT_IN_ROOM', 'You are not in a room.');
      if (c.room.phase !== 'lobby') return err(reply, 'WRONG_PHASE', 'The match has already started.');
      if (!c.seat.team) return err(reply, 'NO_TEAM', 'Choose a team first.');
      c.seat.ready = !!p.ready; touch(c.room);
      reply({ ok: true });
      broadcastState(c.room);
    });

    on('match:start', (p, reply) => {
      const c = ctx(); if (!c) return err(reply, 'NOT_IN_ROOM', 'You are not in a room.');
      const { room, seat } = c;
      if (room.phase === 'playing') return err(reply, 'ALREADY_STARTED', 'The match has already started.');
      if (room.phase !== 'lobby') return err(reply, 'WRONG_PHASE', 'Cannot start a match now.');
      if (room.players[0] !== seat) return err(reply, 'NOT_HOST', 'Only the host can start the match.');
      if (room.players.length < 2) return err(reply, 'NEED_OPPONENT', 'Waiting for an opponent to join.');
      if (!bothConnected(room)) return err(reply, 'OPPONENT_OFFLINE', 'Your opponent is disconnected.');
      if (!room.players.every((q) => q.team && q.ready)) return err(reply, 'NOT_READY', 'Both players must be ready.');
      startMatch(room);
      reply({ ok: true });
    });

    on('match:rematch', (p, reply) => {
      const c = ctx(); if (!c) return err(reply, 'NOT_IN_ROOM', 'You are not in a room.');
      const { room, seat } = c;
      if (room.phase === 'playing') return err(reply, 'ALREADY_STARTED', 'The match has already started.');
      if (room.phase !== 'finished') return err(reply, 'WRONG_PHASE', 'There is no finished match.');
      if (room.players.length < 2) return err(reply, 'NEED_OPPONENT', 'Your opponent has left.');
      if (!bothConnected(room)) return err(reply, 'OPPONENT_OFFLINE', 'Your opponent is disconnected.');
      seat.rematch = true; touch(room);
      reply({ ok: true });
      if (room.players.every((q) => q.rematch)) { room.flip = !room.flip; startMatch(room); }
      else broadcastState(room);
    });

    on('room:toLobby', (p, reply) => {
      const c = ctx(); if (!c) return err(reply, 'NOT_IN_ROOM', 'You are not in a room.');
      if (c.room.phase !== 'finished') return err(reply, 'WRONG_PHASE', 'Nothing to reset.');
      c.room.phase = 'lobby'; c.room.match = null;
      c.room.players.forEach((q) => { q.ready = false; q.rematch = false; });
      touch(c.room);
      reply({ ok: true });
      broadcastState(c.room);
    });

    on('match:sync', (p, reply) => {
      const c = ctx(); if (!c) return err(reply, 'NOT_IN_ROOM', 'You are not in a room.');
      const snap = snapshotFor(c.room, c.seat);
      reply({ ok: true, snapshot: snap });
    });

    socket.on('disconnect', () => {
      sockets.delete(socket.id);
      const room = rooms.get(socket.data.roomCode);
      if (!room) return;
      const seat = seatOf(room, socket.data.token);
      if (!seat || seat.socketId !== socket.id) return; // already replaced by a newer connection
      seat.connected = false; seat.socketId = null; seat.disconnectedAt = Date.now();
      socket.data.roomCode = null; socket.data.token = null;
      touch(room);
      if (room.phase === 'playing') pauseMatch(room);
      armDrop(room, seat);
      broadcastState(room);
    });
  }

  /* ---------- housekeeping ---------- */
  function sweep() {
    const now = Date.now();
    for (const room of Array.from(rooms.values())) {
      const idle = now - room.lastActive;
      const anyOnline = room.players.some((p) => p.connected);
      if (now - room.createdAt > C.MAX_AGE_MS) destroyRoom(room, 'expired');
      else if (!anyOnline && idle > C.ABANDONED_MS) destroyRoom(room, 'abandoned');
      else if (room.phase === 'lobby' && idle > C.LOBBY_IDLE_MS) destroyRoom(room, 'idle');
      else if (room.phase === 'finished' && idle > C.FINISHED_IDLE_MS) destroyRoom(room, 'idle');
    }
  }
  function start() { if (!sweepTimer) { sweepTimer = setInterval(sweep, C.SWEEP_MS); if (sweepTimer.unref) sweepTimer.unref(); } }
  function shutdown() {
    clearInterval(sweepTimer); sweepTimer = null;
    for (const room of Array.from(rooms.values())) destroyRoom(room, 'server-restart');
  }
  const stats = () => ({ rooms: rooms.size, sockets: sockets.size });
  return { attach, sweep, start, shutdown, stats, rooms, config: C };
}
module.exports = { createService, DEFAULTS };
