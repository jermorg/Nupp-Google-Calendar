require('dotenv').config();
const { getUserSchedule, getUserCredentials } = require('./auth.js');
const { createGoogleCalendarEvent, updateGoogleCalendarEvent, deleteGoogleCalendarEvent } = require('./google.js');
const { db } = require('./db.js')
const fs = require('fs');
const path = require('path');

const INTERVAL_ENV = parseInt(process.env.INTERVAL || '60', 10);
const INTERVAL = INTERVAL_ENV * 60 * 1000;

async function syncSchedule() {
    const { accountId } = await getUserCredentials();
    const userId = Number(accountId);
    const rawSchedule = await getUserSchedule();

    const existingRows = db.prepare('SELECT * FROM lessons WHERE userid = ?').all(userId);
    const existingMap = new Map(existingRows.map(r => [`${r.date}_${r.lesson_number}`, r]));

    const processedKeys = new Set();
    const blockHidden = process.env.BLOCK_HIDDEN_LESSONS === 'true';

    const changes = [];

    for (const day of rawSchedule) {
        for (const lesson of day.lessons) {
            for (const period of lesson.periods) {

              if (blockHidden && (!period.disciplineShortName || period.disciplineShortName.includes('Приховано'))) {
                continue;
              }

              const key = `${day.date}_${lesson.number}`;
              processedKeys.add(key);

              const currentHash = `${period.disciplineShortName}|${period.classroom}|${period.timeStart}|${period.timeEnd}|${period.teachersName}`;
              const existing = existingMap.get(key);

              // console.log(period)
              // process.exit();

              const lessonData = {
                  date: day.date,
                  number: lesson.number,
                  disciplineFullName: period.disciplineFullName,
                  disciplineShortName: period.disciplineShortName,
                  typeStr: period.typeStr,
                  type: period.type,
                  classroom: period.classroom,
                  timeStart: period.timeStart,
                  timeEnd: period.timeEnd,
                  teachersName: period.teachersName,
                  teachersNameFull: period.teachersNameFull,
                  hash: currentHash
              };

              if (!existing) {
                // ----------------------------------------------------
                // 1. ДОДАНО НОВУ ПАРУ
                // ----------------------------------------------------
                console.log(`[+] Додано нову пару: ${day.date} - ${period.disciplineShortName}`);
                changes.push(`[+] <b>Додано:</b> ${day.date} [${lesson.number}]\n<b>Предмет:</b> ${period.disciplineShortName} (${period.typeStr})\n<b>Аудиторія:</b> ${period.classroom || '—'}\n<b>Викладач:</b> ${period.teachersName || '—'}`);
                
                const googleEvent = await createGoogleCalendarEvent(lessonData);
                const googleEventId = googleEvent.id;

                db.prepare(`
                  INSERT INTO lessons (
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
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    userId,
                    day.date,
                    lesson.number,
                    period.disciplineShortName,
                    period.typeStr,
                    period.type,
                    period.classroom,
                    period.timeStart,
                    period.timeEnd,
                    period.teachersName,
                    period.teachersNameFull, 
                    googleEventId,
                    currentHash
                );

              } else if (existing.raw_hash !== currentHash) {
                // ----------------------------------------------------
                // 2. ОНОВЛЕННЯ ІСНУЮЧОЇ ПАРИ
                // ----------------------------------------------------

                const wasText = `${existing.disciplineShortName} (${existing.typeStr || '—'}) | ${existing.classroom || '—'} | ${existing.teachersName || '—'}`;
                const isText = `${period.disciplineShortName} (${period.typeStr || '—'}) | ${period.classroom || '—'} | ${period.teachersName || '—'}`;

                changes.push(`<b>[*] Змінено:</b> ${day.date} [${lesson.number}]\n<b>Було:</b> ${wasText}\n<b>Стало:</b> ${isText}`);

                console.log(`[*] Оновлено пару: ${day.date} - ${period.disciplineShortName} (Знайдено зміни)`);
                
                await updateGoogleCalendarEvent(existing.google_event_id, lessonData);

                db.prepare(`
                  UPDATE lessons 
                  SET 
                    disciplineShortName = ?,
                    typeStr = ?,
                    type = ?,
                    classroom = ?,
                    time_start = ?,
                    time_end = ?,
                    teachersName = ?,
                    teachersNameFull = ?,
                    raw_hash = ?
                  WHERE google_event_id = ?
                `).run(
                    period.disciplineShortName,
                    period.typeStr,
                    period.type,
                    period.classroom,
                    period.timeStart,
                    period.timeEnd,
                    period.teachersName,
                    period.teachersNameFull,
                    currentHash,
                    existing.google_event_id
                );
              }
            }
        }
    }

    // ----------------------------------------------------
    // 3. ПАРУ ВИДАЛЕНО З РОЗКЛАДУ
    // ----------------------------------------------------
    for (const [key, oldLesson] of existingMap.entries()) {
        if (!processedKeys.has(key)) {
            console.log(`[-] Видалено пару: ${oldLesson.date} (Пара №${oldLesson.lesson_number} - ${oldLesson.disciplineShortName})`);

            changes.push(`[-] <b>Видалено:</b> ${oldLesson.date} [${oldLesson.lesson_number}]\n<b>Предмет:</b> ${oldLesson.disciplineShortName}`);

            if (oldLesson.google_event_id) {
                await deleteGoogleCalendarEvent(oldLesson.google_event_id);
            }
            db.prepare('DELETE FROM lessons WHERE id = ?').run(oldLesson.id);
        }
    }

    if (changes.length > 0) {
        const messageText = `<b>Зміни в розкладі:</b>\n\n` + changes.join('\n\n---\n\n');
        await sendTelegramNotification(messageText);
    }
}

async function sendTelegramNotification(text) {
    if (process.env.TELEGRAM_NOTIFY !== 'true') return;

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const threadId = process.env.TELEGRAM_THREAD_ID;

    if (!token || !chatId) {
        console.error('[Telegram Error] Відсутній TELEGRAM_BOT_TOKEN або TELEGRAM_CHAT у .env');
        return;
    }

    const payload = {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
    };

    if (threadId) {
        payload.message_thread_id = Number(threadId);
    }

    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.error('[Telegram Error] Помилка надсилання повідомлення:', error);
    }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
    while (true) {
        console.log(`[${new Date().toLocaleTimeString()}] Запуск перевірки розкладу...`);
        
        try {
            await syncSchedule();
        } catch (error) {
            console.error('[!] Помилка під час синхронізації:', error.message);
        }

        console.log(`[${new Date().toLocaleTimeString()}] Перевірка завершена. Очікування наступної перевірки...`);
        await sleep(INTERVAL);
    }
})();