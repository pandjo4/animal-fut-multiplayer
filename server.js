'use strict';
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { createService } = require('./lib/rooms');
const engine = require('./lib/engine');

const PORT = Number(process.env.PORT) || 3000;

/* ---- CORS / allowed origins ----
   ALLOWED_ORIGINS = comma separated list. "*" inside an entry is a wildcard, e.g.
   https://my-game.netlify.app,https://*--my-game.netlify.app   (the 2nd covers Netlify preview deploys)
   localhost is always allowed unless NODE_ENV=production and ALLOW_LOCALHOST is not "true". */
const patterns = String(process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
const toRegex = (p) => new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[a-z0-9-]+') + '$', 'i');
const regexes = patterns.map(toRegex);
const allowLocal = process.env.NODE_ENV !== 'production' || process.env.ALLOW_LOCALHOST === 'true';
function isAllowed(origin) {
  if (!origin) return true; // non-browser clients send no Origin
  if (!patterns.length) return true; // not configured yet -> open (see warning below)
  if (allowLocal && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return true;
  return regexes.some((r) => r.test(origin));
}
if (!patterns.length) console.warn('[WARN] ALLOWED_ORIGINS is not set: accepting connections from ANY website. Set it to your Netlify URL.');
else console.log('[cors] allowed origins:', patterns.join(', '));

engine.load(); // fail fast if game files are missing/broken
const app = express();
app.disable('x-powered-by');
const server = http.createServer(app);
const io = new Server(server, {
  serveClient: false,
  cors: { origin: (origin, cb) => cb(null, isAllowed(origin)), methods: ['GET', 'POST'] },
  allowRequest: (req, cb) => cb(null, isAllowed(req.headers.origin)),
  pingInterval: 10000,
  pingTimeout: 10000,
  maxHttpBufferSize: 100 * 1024
});
const service = createService(io);
service.start();
io.on('connection', (socket) => service.attach(socket));

app.get('/health', (req, res) => {
  const o = req.headers.origin;
  if (o && isAllowed(o)) { res.set('Access-Control-Allow-Origin', o); res.set('Vary', 'Origin'); }
  res.json({ ok: true, uptime: Math.round(process.uptime()), ...service.stats() });
});
app.get('/', (req, res) => res.type('text/plain').send('Animal FUT multiplayer server is running.'));

server.listen(PORT, () => console.log('Multiplayer server listening on port ' + PORT));

function stop() { service.shutdown(); io.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); }
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
process.on('unhandledRejection', (e) => console.error('[unhandledRejection]', e));
