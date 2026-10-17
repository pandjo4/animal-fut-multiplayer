'use strict';
// Minimal in-process stand-in for Socket.IO used by the tests (no network needed).
class FakeIO {
  constructor() { this.members = new Map(); this.byId = new Map(); this.n = 0; this.onConn = null; }
  to(room) {
    return { emit: (ev, data) => {
      const ids = this.members.get(room) ? Array.from(this.members.get(room)) : (this.byId.has(room) ? [room] : []);
      for (const id of ids) { const c = this.byId.get(id); if (c) c._deliver(ev, data); }
    } };
  }
  connect() {
    const io = this, id = 'sock' + (++this.n);
    const server = { id, data: {}, handlers: {}, alive: true,
      on(ev, fn) { this.handlers[ev] = fn; },
      join(r) { if (!io.members.has(r)) io.members.set(r, new Set()); io.members.get(r).add(id); },
      leave(r) { if (io.members.has(r)) io.members.get(r).delete(id); },
      emit(ev, data) { client._deliver(ev, data); } };
    const client = { id, log: [], listeners: {},
      on(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); },
      _deliver(ev, data) { const d = JSON.parse(JSON.stringify(data === undefined ? null : data)); this.log.push([ev, d]); (this.listeners[ev] || []).forEach((f) => f(d)); },
      emit(ev, payload, cb) { const h = server.handlers[ev]; if (h && server.alive) h(JSON.parse(JSON.stringify(payload === undefined ? {} : payload)), cb ? (r) => cb(JSON.parse(JSON.stringify(r))) : undefined); },
      call(ev, payload) { let out; this.emit(ev, payload, (r) => { out = r; }); return out; },
      events(ev) { return this.log.filter((l) => l[0] === ev).map((l) => l[1]); },
      disconnect() { server.alive = false; (server.handlers.disconnect || (() => {}))(); io.byId.delete(id); io.members.forEach((s) => s.delete(id)); } };
    this.byId.set(id, client);
    this.onConn(server);
    return client;
  }
}
module.exports = { FakeIO };
