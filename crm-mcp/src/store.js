// SQLite history store. Every search result set is saved as a "snapshot" so we
// can compute price dynamics over time and diff against previous runs
// (monitoring). Keyed by a stable hash of the normalized search criteria.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { config } from './config.js';

let _db = null;

export function db() {
  if (_db) return _db;
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  _db = new Database(config.dbPath);
  _db.pragma('journal_mode = WAL');
  _db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      criteria_hash TEXT NOT NULL,
      criteria_json TEXT NOT NULL,
      created_at    TEXT NOT NULL,
      offer_count   INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS offers (
      snapshot_id    INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
      operator       TEXT,
      country        TEXT,
      hotel          TEXT,
      stars          INTEGER,
      departure_date TEXT,
      nights         INTEGER,
      price          REAL,
      currency       TEXT,
      board          TEXT,
      link           TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_snap_hash ON snapshots(criteria_hash, created_at);
    CREATE INDEX IF NOT EXISTS idx_offers_snap ON offers(snapshot_id);
  `);
  return _db;
}

export function criteriaHash(criteria) {
  const norm = JSON.stringify(criteria, Object.keys(criteria).sort());
  return crypto.createHash('sha1').update(norm).digest('hex').slice(0, 16);
}

/** Persist a result set. `nowIso` injected for testability/determinism. */
export function saveSnapshot(criteria, offers, nowIso = new Date().toISOString()) {
  const d = db();
  const hash = criteriaHash(criteria);
  const insertSnap = d.prepare(
    `INSERT INTO snapshots (criteria_hash, criteria_json, created_at, offer_count)
     VALUES (?, ?, ?, ?)`,
  );
  const insertOffer = d.prepare(
    `INSERT INTO offers (snapshot_id, operator, country, hotel, stars,
       departure_date, nights, price, currency, board, link)
     VALUES (@snapshot_id, @operator, @country, @hotel, @stars,
       @departure_date, @nights, @price, @currency, @board, @link)`,
  );
  const tx = d.transaction(() => {
    const { lastInsertRowid } = insertSnap.run(hash, JSON.stringify(criteria), nowIso, offers.length);
    for (const o of offers) {
      insertOffer.run({
        snapshot_id: lastInsertRowid,
        operator: o.operator, country: o.country, hotel: o.hotel,
        stars: o.stars, departure_date: o.departureDate, nights: o.nights,
        price: o.price, currency: o.currency, board: o.board, link: o.link,
      });
    }
    return lastInsertRowid;
  });
  return tx();
}

/** Snapshots for a criteria set, newest first. */
export function listSnapshots(criteria, limit = 50) {
  return db()
    .prepare(
      `SELECT id, created_at, offer_count FROM snapshots
       WHERE criteria_hash = ? ORDER BY created_at DESC LIMIT ?`,
    )
    .all(criteriaHash(criteria), limit);
}

export function getOffers(snapshotId) {
  return db()
    .prepare(
      `SELECT operator, country, hotel, stars, departure_date AS departureDate,
              nights, price, currency, board, link
       FROM offers WHERE snapshot_id = ?`,
    )
    .all(snapshotId);
}

/** The two most recent snapshots for a criteria set, for diffing. */
export function lastTwoSnapshots(criteria) {
  const snaps = listSnapshots(criteria, 2);
  return snaps.map((s) => ({ ...s, offers: getOffers(s.id) }));
}

export function close() {
  if (_db) { _db.close(); _db = null; }
}
