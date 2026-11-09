const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');

let dbInstance = null;

async function initDb() {
    if (dbInstance) return dbInstance;

    dbInstance = await open({
        filename: path.join(__dirname, 'data', 'data.db'),
        driver: sqlite3.Database
    });

    await dbInstance.exec('PRAGMA journal_mode = WAL;');

    await dbInstance.exec(`
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

        CREATE TABLE IF NOT EXISTS cache (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    `);

    return dbInstance;
}

async function getDb() {
    if (!dbInstance) {
        return await initDb();
    }
    return dbInstance;
}

async function getLessonsByUserId(userId) {
    const db = await getDb();
    return await db.all('SELECT * FROM lessons WHERE userid = ?', [userId]);
}

async function insertLesson(lessonData) {
    const db = await getDb();
  
    const result = await db.run(
        `INSERT INTO lessons (
            userid,
            date,
            lesson_number,
            disciplineShortName,
            typeStr,
            type,
            classroom,
            time_start,
            time_end,
            teachersName,
            teachersNameFull,
            google_event_id,
            raw_hash
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            lessonData.userId,
            lessonData.date,
            lessonData.number,
            lessonData.disciplineShortName,
            lessonData.typeStr,
            lessonData.type,
            lessonData.classroom,
            lessonData.timeStart,
            lessonData.timeEnd,
            lessonData.teachersName,
            lessonData.teachersNameFull,
            lessonData.googleEventId,
            lessonData.rawHash
        ]
    );

    return result;
}

async function updateLessonByGoogleEventId(googleEventId, lessonData) {
    const db = await getDb();

    return await db.run(
        `UPDATE lessons SET 
            disciplineShortName = ?,
            typeStr = ?,
            type = ?,
            classroom = ?,
            time_start = ?,
            time_end = ?,
            teachersName = ?,
            teachersNameFull = ?,
            raw_hash = ?
        WHERE google_event_id = ?`,
        [
            lessonData.disciplineShortName,
            lessonData.typeStr,
            lessonData.type,
            lessonData.classroom,
            lessonData.timeStart,
            lessonData.timeEnd,
            lessonData.teachersName,
            lessonData.teachersNameFull,
            lessonData.rawHash,
            googleEventId
        ]
    );
}

async function deleteLessonById(id) {
    const db = await getDb();
    return await db.run('DELETE FROM lessons WHERE id = ?', [id]);
}

async function getCached(key) {
    const db = await getDb();
    const row = await db.get('SELECT value FROM cache WHERE key = ?', [key]);
    return row ? row.value : null;
}

async function setCached(key, value) {
    const db = await getDb();
    await db.run(
        `INSERT INTO cache (key, value) 
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [key, value]
    );
}

module.exports = { 
    initDb, 
    getDb,
    getLessonsByUserId,
    insertLesson,
    updateLessonByGoogleEventId,
    deleteLessonById,
    getCached, 
    setCached 
};