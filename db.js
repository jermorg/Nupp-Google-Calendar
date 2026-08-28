const Database = require('better-sqlite3');
const db = new Database('./data/data.db');

db.exec(`
    CREATE TABLE IF NOT EXISTS lessons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userid INTEGER NOT NULL,
        date TEXT NOT NULL,
        lesson_number INTEGER NOT NULL,
        disciplineShortName TEXT,
        typeStr TEXT,
        type INTEGER,
        classroom TEXT,
        time_start TEXT,
        time_end TEXT,
        teachersName TEXT,
        teachersNameFull TEXT,
        google_event_id TEXT,
        raw_hash TEXT NOT NULL
    );
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
`);


function getCached(key) {
    const row = db.prepare('SELECT value FROM cache WHERE key = ?').get(key);
    return row ? row.value : null;
}

function setCached(key, value) {
    db.prepare(`
        INSERT INTO cache (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value);
}

module.exports = { getCached, setCached, db };