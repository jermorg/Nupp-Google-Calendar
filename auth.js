const { setCached, getCached, db } = require('./db.js');

async function getUserAccessToken() {
    const res = await fetch(process.env.LOGIN_URL, {
        method: 'POST',
        headers: {
            'accept-encoding': 'gzip',
            'accept-language': 'uk',
            'content-type': 'application/json',
            'user-agent': 'Dart/3.10 (dart:io)'
        },
        body: JSON.stringify({
            username: process.env.USER_NAME,
            password: process.env.USER_PASSWORD,
            app_key: process.env.APP_KEY
        })
    });

    if (!res.ok) throw new Error(`Login failed with status ${res.status}`);
    const data = await res.json();
    return data.access_token;
}

async function getUserAccauntId(token) {
    const res = await fetch(process.env.INFO_URL, {
        method: 'GET',
        headers: {
            'accept-encoding': 'gzip',
            'accept-language': 'uk',
            'authorization': `Bearer ${token}`,
            'content-type': 'application/json',
            'user-agent': 'Dart/3.10 (dart:io)'
        }
    });

    if (!res.ok) throw new Error(`Get info failed with status ${res.status}`);
    const data = await res.json();

    const selectedAccount = data.accounts.find(a => a.isSelected) || data.accounts[0];
    if (!selectedAccount) throw new Error('Account ID not found in response');

    return selectedAccount.id;
}

async function getUserCredentials(forceRefresh = false) {
    let token = getCached('access_token');
    let accountId = getCached('account_id');

    if (token && accountId && !forceRefresh) {
        return { token, accountId };
    }

    if (forceRefresh);

    token = await getUserAccessToken();
    accountId = await getUserAccauntId(token);

    setCached('access_token', token);
    setCached('account_id', String(accountId));

    return { token, accountId };
}

async function getUserSchedule(retryCount = 0) {
    const { token, accountId } = await getUserCredentials();
    const { dateStart, dateEnd } = getDates();

    try {
        const response = await fetch(process.env.SCHEDULE_URL, {
            method: 'POST',
            headers: {
                'authorization': `Bearer ${token}`,
                'content-type': 'application/json',
                'user-agent': 'Dart/3.10 (dart:io)',
                'accept-language': 'uk'
            },
            body: JSON.stringify({
                dateStart,
                dateEnd,
                studentId: Number(accountId)
            })
        });

        if (response.status === 401 && retryCount < 1) {
            console.warn('[WARN] 401 Unauthorized. Try update token...');

            await getUserCredentials(true);
            return await getUserSchedule(retryCount + 1);
        }

        if (!response.ok) {
            throw new Error(`[ERROR] Schedule status: ${response.status}`);
        }

        return await response.json();

    } catch (error) {
        console.error('[ERROR] GET Schedule:', error.message);
        throw error;
    }
}

function getDates() {
    const now = new Date();
    const end = new Date();
    end.setDate(now.getDate() + 14);

    const formatDate = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    return {
        dateStart: process.env.DATE_START || formatDate(now),
        dateEnd: process.env.DATE_END || formatDate(end)
    };
}

module.exports = { getUserSchedule, getUserCredentials };