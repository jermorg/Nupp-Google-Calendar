require('dotenv').config();
const {
    getUserSchedule,
    getUserCredentials
} = require('./auth.js');

const {
    sendTelegramNotification
} = require('./telegram.js');

const {
    createGoogleCalendarEvent,
    updateGoogleCalendarEvent,
    deleteGoogleCalendarEvent
} = require('./google.js');

const {
    getLessonsByUserId,
    insertLesson,
    updateLessonByGoogleEventId,
    deleteLessonById
} = require('./db.js')


const INTERVAL_ENV = parseInt(process.env.INTERVAL || '60', 10);
const INTERVAL = INTERVAL_ENV * 60 * 1000;

async function syncSchedule() {
    const { accountId } = await getUserCredentials();
    const userId = Number(accountId);
    const rawSchedule = await getUserSchedule();
    
    const existingRows = await getLessonsByUserId(userId);
    const existingMap = new Map(existingRows.map(r => [`${r.date}_${r.lesson_number}_${r.disciplineShortName}_${r.typeStr}`, r]));

    const processedKeys = new Set();

    const blockHidden = process.env.BLOCK_HIDDEN_LESSONS === 'true';
    const changes = [];

    for (const day of rawSchedule) {
        for (const lesson of day.lessons) {
            for (const period of lesson.periods) {

                if (blockHidden && (!period.disciplineShortName || period.disciplineShortName.includes('Приховано'))) continue;

                const key = `${day.date}_${lesson.number}_${period.disciplineShortName}_${period.typeStr}`;
                processedKeys.add(key);

                const currentHash = `${period.disciplineShortName}|${period.classroom}|${period.timeStart}|${period.timeEnd}|${period.teachersName}`;
                const existing = existingMap.get(key);

                // console.log(period)
                // process.exit();

                const lessonData = {
                    userId: userId,
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
                    rawHash: currentHash
                };

                if (!existing) {
                    // ----------------------------------------------------
                    // 1. ДОДАНО НОВУ ПАРУ
                    // ----------------------------------------------------

                    console.log(`[+] Додано нову пару: ${day.date} - ${period.disciplineShortName}`);
                    changes.push(`[+] <b>Додано:</b> ${day.date} [${lesson.number}]\n<b>Предмет:</b> ${period.disciplineShortName} (${period.typeStr})\n<b>Аудиторія:</b> ${period.classroom || '—'}\n<b>Викладач:</b> ${period.teachersName || '—'}`);
                    
                    const googleEvent = await createGoogleCalendarEvent(lessonData);

                    lessonData.googleEventId = googleEvent.id;

                    await insertLesson(lessonData);

                } else if (existing.raw_hash !== currentHash) {
                    // ----------------------------------------------------
                    // 2. ОНОВЛЕННЯ ІСНУЮЧОЇ ПАРИ
                    // ----------------------------------------------------

                    const wasText = `${existing.disciplineShortName} (${existing.typeStr || '—'}) | ${existing.classroom || '—'} | ${existing.teachersName || '—'}`;
                    const isText = `${period.disciplineShortName} (${period.typeStr || '—'}) | ${period.classroom || '—'} | ${period.teachersName || '—'}`;

                    changes.push(`<b>[*] Змінено:</b> ${day.date} [${lesson.number}]\n<b>Було:</b> ${wasText}\n<b>Стало:</b> ${isText}`);

                    console.log(`[*] Оновлено пару: ${day.date} - ${period.disciplineShortName} (Знайдено зміни)`);
                    
                    await updateGoogleCalendarEvent(existing.google_event_id, lessonData);

                    lessonData.googleEventId = existing.google_event_id;

                    await updateLessonByGoogleEventId(existing.google_event_id, lessonData);

                }
            }
        }
    }

    // ----------------------------------------------------
    // 3. ПАРУ ВИДАЛЕНО З РОЗКЛАДУ
    // ----------------------------------------------------
    for (const [key, oldLesson] of existingMap.entries()) {
        if (!processedKeys.has(key)) {

            if (oldLesson.date < process.env.DATE_START || oldLesson.date > process.env.DATE_END) continue;

            console.log(`[-] Видалено пару: ${oldLesson.date} (Пара №${oldLesson.lesson_number} - ${oldLesson.disciplineShortName})`);
            changes.push(`[-] <b>Видалено:</b> ${oldLesson.date} [${oldLesson.lesson_number}]\n<b>Предмет:</b> ${oldLesson.disciplineShortName} (${oldLesson.typeStr})`);

            if (oldLesson.google_event_id) {
                await deleteGoogleCalendarEvent(oldLesson.google_event_id);
            }

            await deleteLessonById(oldLesson.id);
        }
    }

    if (changes.length > 0) {
        const messageText = `<b>Зміни в розкладі:</b>\n\n` + changes.join('\n\n---\n\n');
        await sendTelegramNotification(messageText);
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