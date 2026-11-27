'use strict';
/*
  Minimal async SQL store with two drivers:
    - postgres (Supabase / any PostgreSQL) via the "pg" package: used in production when DATABASE_URL is set
    - sqlite   (node:sqlite, file or :memory:)                    : local development and the test-suite
  SQL uses $1,$2,... placeholders; the sqlite driver maps them to ?1,?2,...
  tx(fn) runs fn(db) inside one transaction. Player rows are read with db.lockSuffix (FOR UPDATE on Postgres).
*/
const fs = require('fs');
const path = require('path');

const MIGRATIONS = path.join(__dirname, '..', '..', 'migrations');

function sqliteStore(file) {
  const { DatabaseSync } = require('node:sqlite');
  const raw = new DatabaseSync(file || ':memory:');
  raw.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  const conv = (sql) => sql.replace(/\$(\d+)/g, '?$1');
  const norm = (r) => (r ? Object.assign({}, r) : null);
  let queue = Promise.resolve();
  const db = {
    lockSuffix: '',
    async get(sql, p) { return norm(raw.prepare(conv(sql)).get(...(p || []))); },
    async all(sql, p) { return raw.prepare(conv(sql)).all(...(p || [])).map(norm); },
    async run(sql, p) { const r = raw.prepare(conv(sql)).run(...(p || [])); return { changes: Number(r.changes) }; },
    async exec(sql) { raw.exec(sql); }
  };
  return {
    kind: 'sqlite',
    // One connection: transactions are serialised through a queue.
    tx(fn) {
      const run = queue.then(async () => {
        raw.exec('BEGIN IMMEDIATE');
        try { const out = await fn(db); raw.exec('COMMIT'); return out; }
        catch (e) { try { raw.exec('ROLLBACK'); } catch (_) { /* ignore */ } throw e; }
      });
      queue = run.catch(() => {});
      return run;
    },
    async migrate() { for (const f of fs.readdirSync(MIGRATIONS).filter((x) => x.endsWith('.sql')).sort()) raw.exec(fs.readFileSync(path.join(MIGRATIONS, f), 'utf8')); },
    async close() { raw.close(); }
  };
}

function pgStore(url) {
  const { Pool } = require('pg'); // listed in package.json; not installed in the offline build sandbox
  const pool = new Pool({ connectionString: url, max: Number(process.env.PG_POOL_MAX) || 8, ssl: process.env.PG_SSL === 'false' ? false : { rejectUnauthorized: false } });
  const wrap = (c) => ({
    lockSuffix: ' FOR UPDATE',
    async get(sql, p) { const r = await c.query(sql, p || []); return r.rows[0] || null; },
    async all(sql, p) { const r = await c.query(sql, p || []); return r.rows; },
    async run(sql, p) { const r = await c.query(sql, p || []); return { changes: r.rowCount }; },
    async exec(sql) { await c.query(sql); }
  });
  return {
    kind: 'postgres',
    async tx(fn) {
      const c = await pool.connect();
      try { await c.query('BEGIN'); const out = await fn(wrap(c)); await c.query('COMMIT'); return out; }
      catch (e) { try { await c.query('ROLLBACK'); } catch (_) { /* ignore */ } throw e; }
      finally { c.release(); }
    },
    async migrate() { for (const f of fs.readdirSync(MIGRATIONS).filter((x) => x.endsWith('.sql')).sort()) await pool.query(fs.readFileSync(path.join(MIGRATIONS, f), 'utf8')); },
    async close() { await pool.end(); }
  };
}

function openStore(opts) {
  const o = opts || {};
  if (o.databaseUrl) return pgStore(o.databaseUrl);
  return sqliteStore(o.sqliteFile);
}
module.exports = { openStore, sqliteStore, pgStore };
