async function sendTelegramNotification(text) {
    if (process.env.TELEGRAM_NOTIFY !== 'true') return;

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const threadId = process.env.TELEGRAM_THREAD_ID;

    if (!token || !chatId) {
        console.error('[Telegram Error] Відсутній TELEGRAM_BOT_TOKEN або TELEGRAM_CHAT у .env');
        return;
    }

    const chunks = splitByBlocks(text);

    for (const chunk of chunks) {
        const payload = {
            chat_id: chatId,
            text: chunk,
            parse_mode: 'HTML',
            ...(threadId && { message_thread_id: Number(threadId) })
        };

        try {
            const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const err = await res.json();
                console.error('[Telegram Error]', err.description || err);
            }
        } catch (error) {
            console.error('[Telegram Error]', error.message);
        }
    }
}

function splitByBlocks(text, limit = 4000) {
    if (text.length <= limit) return [text];

    const blocks = text.split(/(?=\n---|\n\n)/);
    const chunks = [];
    let current = '';

    for (const block of blocks) {
        if ((current + block).length > limit) {
            if (current) chunks.push(current.trim());
            current = block;
        } else {
            current += block;
        }
    }

    if (current.trim()) chunks.push(current.trim());
    return chunks;
}

module.exports = {
    sendTelegramNotification
}