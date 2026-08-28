const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
const KEY_FILE = process.env.KEY_FILE || path.join(DATA_DIR, 'service-account.json');

if (!fs.existsSync(KEY_FILE)) {
    console.error(`\n[CRITICAL ERROR] Файл ключів не знайдено: ${path.resolve(KEY_FILE)}`);
    console.error('Переконайтеся, що файл service-account.json існує в корінні проєкту або перевірте KEY_FILE у .env.\n');
    process.exit(1);
}

if (!process.env.CALENDAR_ID) {
    console.error('\n[CRITICAL ERROR] Не вказано CALENDAR_ID у змінних оточення (.env).\n');
    process.exit(1);
}

const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/calendar'],
});
const calendar = google.calendar({ version: 'v3', auth });

async function createGoogleCalendarEvent(lessonData) {
    const googleEventResource = {
        summary: `[${lessonData.number}] ${lessonData.disciplineShortName} [${lessonData.typeStr}]`,
        description: `${lessonData.disciplineFullName}\n${lessonData.teachersNameFull}`,
        location: lessonData.classroom,
        colorId: getColorForCalendar(lessonData.typeStr),
        start: { dateTime: `${lessonData.date}T${lessonData.timeStart}:00`, timeZone: 'Europe/Kyiv' },
        end: { dateTime: `${lessonData.date}T${lessonData.timeEnd}:00`, timeZone: 'Europe/Kyiv' }
    };
    const response = await calendar.events.insert({
        calendarId: process.env.CALENDAR_ID,
        requestBody: googleEventResource
    });

    await sleep(1000);

    return response.data;
}

async function updateGoogleCalendarEvent(eventId, lessonData) {
    const googleEventResource = {
        summary: `[${lessonData.number}] ${lessonData.disciplineShortName} [${lessonData.typeStr}]`,
        description: `${lessonData.disciplineFullName}\n${lessonData.teachersNameFull}`,
        location: lessonData.classroom,
        colorId: getColorForCalendar(lessonData.typeStr),
        start: { dateTime: `${lessonData.date}T${lessonData.timeStart}:00`, timeZone: 'Europe/Kyiv' },
        end: { dateTime: `${lessonData.date}T${lessonData.timeEnd}:00`, timeZone: 'Europe/Kyiv' }
    };

    const response = await calendar.events.update({
        calendarId: process.env.CALENDAR_ID,
        eventId: eventId,
        requestBody: googleEventResource
    });

    await sleep(1000);

    return response.data;
}

async function deleteGoogleCalendarEvent(eventId) {
    try {
        await calendar.events.delete({
            calendarId: process.env.CALENDAR_ID,
            eventId: eventId
        });
        await sleep(1000);
    } catch (error) {
        console.error(`[ERROR] Delete event [${eventId}]:`, error.message);
    }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getColorForCalendar(type){
    let colorId = '1'; 
    if (type.includes('Лб')) {
        colorId = '7';
    } else if (type.includes('Лк')) {
        colorId = '5';
    } else if (type.includes('Пз')) {
        colorId = '2';
    } else if (type.includes('Дод')) {
        colorId = '8';
    } else if (type.includes('Конс') || type.includes('Екз')) {
        colorId = '4';
    }

    return colorId;
}

module.exports = { createGoogleCalendarEvent, updateGoogleCalendarEvent, deleteGoogleCalendarEvent };