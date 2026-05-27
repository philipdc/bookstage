const Database = require('better-sqlite3');
const path     = require('path');

function getDefaultDbPath() {
  if (process.versions.electron && process.defaultApp !== true) {
    return path.join(path.dirname(process.execPath), 'bookstage.sqlite');
  }

  return path.join(__dirname, '../../bookstage.sqlite');
}

// Store BookStage setup parameters beside the project during this prototype stage.
const DB_PATH = process.env.BOOKSTAGE_DB || getDefaultDbPath();

let _db = null;

function getDb() {
  if (!_db) {
    const fs = require('fs');
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

    _db = new Database(DB_PATH);

    // One-time schema setup
    _db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS recent_companies (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL,
        db_path    TEXT NOT NULL UNIQUE,
        opened_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }
  return _db;
}

function getSetting(key) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

function setSetting(key, value) {
  getDb()
    .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, String(value));
}

function addRecentCompany(name, dbPath) {
  getDb()
    .prepare(`INSERT INTO recent_companies (name, db_path) VALUES (?, ?)
              ON CONFLICT(db_path) DO UPDATE SET opened_at = datetime('now')`)
    .run(name, dbPath);
}

function getRecentCompanies() {
  return getDb()
    .prepare('SELECT * FROM recent_companies ORDER BY opened_at DESC LIMIT 10')
    .all();
}

module.exports = { getDb, getSetting, setSetting, addRecentCompany, getRecentCompanies };
