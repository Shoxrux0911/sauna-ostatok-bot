require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const fetch = require('node-fetch');
const cron = require('node-cron');
const fs = require('fs');
const express = require('express');

// ==== MUHIT O'ZGARUVCHILARI ====
const BOT_TOKEN     = process.env.BOT_TOKEN;
const SECRET_TOKEN  = process.env.BILLZ_SECRET_TOKEN;
const CHANNEL_ID    = process.env.CHANNEL_ID;
const BOT_PASSWORD  = process.env.BOT_PASSWORD || 'sauna2024';
const RENDER_URL    = (process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
const PORT          = process.env.PORT || 3000;

if (!BOT_TOKEN || !SECRET_TOKEN) {
    console.error('[FATAL] BOT_TOKEN yoki BILLZ_SECRET_TOKEN topilmadi! .env faylini tekshiring.');
    process.exit(1);
}

// ==== EXPRESS SERVER ====
const app = express();
app.use(express.json());

app.get('/', (_req, res) => res.send('Bot is running...'));
app.get('/health', (_req, res) => res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    mode: RENDER_URL ? 'webhook' : 'polling',
    time: new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })
}));

// ==== BOT YARATISH ====
const useWebhook = Boolean(RENDER_URL);
let bot;

if (useWebhook) {
    // Webhook rejimi — Render uchun eng ishonchli
    bot = new TelegramBot(BOT_TOKEN, { webHook: false });

    // Telegram webhook so'rovlarini qabul qilish
    app.post(`/webhook/${BOT_TOKEN}`, (req, res) => {
        bot.processUpdate(req.body);
        res.sendStatus(200);
    });

    app.listen(PORT, () => {
        const webhookUrl = `${RENDER_URL}/webhook/${BOT_TOKEN}`;
        console.log(`[SERVER] Port ${PORT} da ishga tushdi (webhook rejimi)`);
        bot.setWebHook(webhookUrl)
            .then(() => console.log(`[WEBHOOK] Muvaffaqiyatli o'rnatildi: ${webhookUrl}`))
            .catch(err => console.error('[WEBHOOK] O\'rnatishda xatolik:', err.message));
    });
} else {
    // Polling rejimi — mahalliy test uchun
    bot = new TelegramBot(BOT_TOKEN, { polling: true });
    app.listen(PORT, () => console.log(`[SERVER] Port ${PORT} da ishga tushdi (polling rejimi)`));
    console.log('[BOT] Polling rejimi ishga tushdi');
}

// ==== XATOLIKLARNI USHLASH ====
bot.on('polling_error', (err) => {
    if (err.code === 'ETELEGRAM' && err.message.includes('409')) {
        console.warn('[POLLING] 409 Conflict — boshqa instansiya ishlamoqda, 10 soniyadan keyin qayta ulanamiz...');
        setTimeout(() => bot.startPolling(), 10000);
    } else {
        console.error(`[POLLING ERROR] ${err.code}: ${err.message}`);
    }
});

bot.on('error', (err) => console.error(`[BOT ERROR] ${err.message}`));

process.on('unhandledRejection', (reason) => {
    console.error('[UNHANDLED REJECTION]', reason);
});

process.on('uncaughtException', (err) => {
    console.error('[UNCAUGHT EXCEPTION]', err.message);
    // Kritik xato bo'lsa Render o'zi qayta ishga tushiradi
    process.exit(1);
});

process.on('SIGTERM', async () => {
    console.log('[SHUTDOWN] SIGTERM qabul qilindi, to\'xtatilmoqda...');
    if (useWebhook) {
        await bot.deleteWebHook().catch(() => {});
    } else {
        await bot.stopPolling().catch(() => {});
    }
    process.exit(0);
});

// ==== FAYLLAR ====
const SUBSCRIBERS_FILE  = './subscribers.json';
const AUTHORIZED_FILE   = './authorized_users.json';

function loadJson(filePath, fallback) {
    try {
        if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        console.error(`[FILE] ${filePath} o'qishda xatolik:`, e.message);
    }
    return fallback;
}

let subscribers    = loadJson(SUBSCRIBERS_FILE, []);
let authorizedUsers = loadJson(AUTHORIZED_FILE, []);

function saveJson(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(`[FILE] ${filePath} saqlashda xatolik:`, e.message);
    }
}

// ==== UZUN XABAR YUBORISH ====
async function sendLongMessage(chatId, text) {
    const MAX = 3800;
    if (text.length <= MAX) {
        return bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
    }

    const parts = text.split('\n\n');
    let chunk = '';

    for (const part of parts) {
        if ((chunk + part + '\n\n').length > MAX) {
            if (chunk.trim()) await bot.sendMessage(chatId, chunk.trim(), { parse_mode: 'HTML' });
            chunk = part + '\n\n';
        } else {
            chunk += part + '\n\n';
        }
    }
    if (chunk.trim()) await bot.sendMessage(chatId, chunk.trim(), { parse_mode: 'HTML' });
}

// ==== BILLZ API — QOLDIQLARNI OLISH ====
async function getOstatokMessage(brandFilter = 'all') {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 sek timeout

    try {
        // 1. Login
        const loginRes = await fetch('https://api-admin.billz.ai/v1/auth/login', {
            method: 'POST',
            headers: { 'accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ secret_token: SECRET_TOKEN }),
            signal: controller.signal
        });

        if (!loginRes.ok) {
            return `❌ Billz login xatosi: ${loginRes.status} ${loginRes.statusText}`;
        }

        const loginData = await loginRes.json();
        if (loginData.code !== 200 || !loginData.data?.access_token) {
            return `❌ Billz avtorizatsiyadan o'ta olmadi. Javob: ${JSON.stringify(loginData).slice(0, 200)}`;
        }

        const accessToken = loginData.data.access_token;
        clearTimeout(timeout);

        // 2. Barcha mahsulotlarni sahifalab olish
        let allProducts = [];
        let page = 1;

        while (true) {
            const res = await fetch(`https://api-admin.billz.ai/v2/products?limit=1000&page=${page}`, {
                headers: { 'accept': 'application/json', 'Authorization': `Bearer ${accessToken}` }
            });

            if (!res.ok) {
                console.error(`[BILLZ] Mahsulotlar olishda xatolik: ${res.status}`);
                break;
            }

            const data = await res.json();
            const products = data.products || [];
            if (products.length === 0) break;

            allProducts = allProducts.concat(products);
            const total = data.count || 0;
            console.log(`[BILLZ] Sahifa ${page}: ${products.length} ta, jami: ${allProducts.length}/${total}`);

            if (allProducts.length >= total) break;
            page++;
        }

        if (allProducts.length === 0) {
            return '❌ Billz dan mahsulotlar kelmadi. Keyinroq urinib ko\'ring.';
        }

        // 3. Lipa / Olxa sauna taxtalarini filtrlash
        const targetProducts = allProducts.filter(p => {
            const name      = (p.name || '').toLowerCase();
            const brand     = (p.brand_name || '').toLowerCase();
            const cats      = p.categories ? p.categories.map(c => c.name.toLowerCase()).join(' ') : '';

            const isLipa = brand.includes('липа') || brand.includes('lipa') || name.includes('липа') || name.includes('lipa');
            const isOlxa = brand.includes('ольха') || brand.includes('olxa') || name.includes('ольха') || name.includes('olxa');

            if (!isLipa && !isOlxa) return false;
            if (brandFilter === 'lipa' && !isLipa) return false;
            if (brandFilter === 'olxa' && !isOlxa) return false;

            const isSaunaCat  = cats.includes('сауна тахта') || cats.includes('жомий сауна');
            const isPlankName = name.includes('вагонка') || name.includes('vagonka') ||
                                name.includes('полок')   || name.includes('polok')   ||
                                name.includes('термо')   || name.includes('termo');

            return isSaunaCat || isPlankName;
        });

        // 4. Faqat mavjud (stock > 0) mahsulotlar
        const available = [];
        targetProducts.forEach(p => {
            const stock = (p.shop_measurement_values || [])
                .reduce((sum, s) => sum + (s.active_measurement_value || 0), 0);
            if (stock > 0) available.push({ name: p.name, stock, brand: p.brand_name || '' });
        });

        const label = brandFilter === 'lipa' ? 'LIPA' : brandFilter === 'olxa' ? 'OLXA' : 'LIPA VA OLXA';
        if (available.length === 0) {
            return `😔 Hozircha <b>${label}</b> sauna taxtalaridan nalichiyada qolmagan.`;
        }

        // 5. Guruhlash va saralash
        const grouped = {};
        available.forEach(prod => {
            const sizeMatch = prod.name.match(/(\d+[\.,]?\d*)\s*(?:м|m)?$/i);
            prod.size = sizeMatch ? parseFloat(sizeMatch[1].replace(',', '.')) : 0;

            let cat = prod.name.replace(/(\/\s*)?\d+[\.,]?\d*\s*(?:м|m)?$/i, '').trim().replace(/[\/\-\\]$/, '').trim() || 'Boshqa';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(prod);
        });

        const sortedCats = Object.keys(grouped).sort((a, b) => {
            const aL = a.toLowerCase(), bL = b.toLowerCase();
            const aVag = aL.includes('вагонка') || aL.includes('vagonka');
            const bVag = bL.includes('вагонка') || bL.includes('vagonka');
            if (aVag && !bVag) return -1;
            if (!aVag && bVag) return 1;
            const aPol = aL.includes('полок') || aL.includes('polok');
            const bPol = bL.includes('полок') || bL.includes('polok');
            if (aPol && !bPol) return -1;
            if (!aPol && bPol) return 1;
            return a.localeCompare(b);
        });

        let msg = `🌲 <b>Nalichiyadagi ${label} (SAUNA TAXTA) qoldig'i</b> 🪵\n`;
        msg += `📅 <i>${new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}</i>\n\n`;

        sortedCats.forEach(key => {
            grouped[key].sort((a, b) => a.size - b.size);
            msg += `🔸 <b>${key.toUpperCase()}</b>\n➖➖➖➖➖➖➖➖➖➖\n`;
            grouped[key].forEach(prod => {
                const label = prod.size > 0 ? `${prod.size} m` : prod.name;
                msg += `🔹 ${label} — <b>${prod.stock} m</b>\n`;
            });
            msg += '\n\n';
        });

        return msg;

    } catch (err) {
        clearTimeout(timeout);
        if (err.name === 'AbortError') return '❌ Billz API javob bermadi (timeout). Keyinroq urinib ko\'ring.';
        return `❌ Kutilmagan xatolik: ${err.message}`;
    }
}

// ==== MENYU ====
const MAIN_MENU = {
    reply_markup: {
        keyboard: [
            [{ text: '🌳 Lipa' }, { text: '🌲 Olxa' }],
            [{ text: '📊 Hammasi (Lipa + Olxa)' }],
            [{ text: '📨 Kanalga yuborish' }, { text: '📋 Yordam' }]
        ],
        resize_keyboard: true
    }
};

// ==== BUYRUQLAR ====
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    if (!authorizedUsers.includes(chatId)) {
        return bot.sendMessage(chatId,
            '🔐 <b>Xush kelibsiz!</b>\n\nBotdan foydalanish uchun parolni kiriting:',
            { parse_mode: 'HTML' }
        );
    }
    bot.sendMessage(chatId,
        '👋 <b>Assalomu alaykum!</b>\n\nBillz tizimidan <b>Lipa</b> va <b>Olxa</b> sauna taxtalari qoldiqlarini ko\'rsatuvchi bot.\n\nQaysi turni ko\'rmoqchisiz?',
        { parse_mode: 'HTML', ...MAIN_MENU }
    );
});

bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    if (!authorizedUsers.includes(chatId)) return;
    bot.sendMessage(chatId,
        `✅ <b>Bot faol</b>\n🕒 Vaqt: ${new Date().toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}\n🔌 Rejim: ${useWebhook ? 'Webhook' : 'Polling'}\n⏱ Ishlash vaqti: ${Math.floor(process.uptime() / 60)} daqiqa`,
        { parse_mode: 'HTML' }
    );
});

bot.onText(/\/subscribe/, (msg) => {
    const chatId = msg.chat.id;
    if (!authorizedUsers.includes(chatId)) return;
    if (subscribers.includes(chatId)) {
        return bot.sendMessage(chatId, 'ℹ️ Siz allaqachon obuna bo\'lgansiz.');
    }
    subscribers.push(chatId);
    saveJson(SUBSCRIBERS_FILE, subscribers);
    bot.sendMessage(chatId, '✅ Har kuni soat <b>09:00</b> da avtomatik hisobot olasiz!', { parse_mode: 'HTML' });
});

bot.onText(/\/unsubscribe/, (msg) => {
    const chatId = msg.chat.id;
    const idx = subscribers.indexOf(chatId);
    if (idx === -1) return bot.sendMessage(chatId, 'ℹ️ Siz obunalar ro\'yxatida yo\'qsiz.');
    subscribers.splice(idx, 1);
    saveJson(SUBSCRIBERS_FILE, subscribers);
    bot.sendMessage(chatId, '❌ Avtomatik hisobotdan o\'chirildingiz.');
});

// ==== XABARLARNI QABUL QILISH ====
bot.on('message', async (msg) => {
    const { text, chat: { id: chatId } } = msg;
    if (!text || text.startsWith('/')) return;

    // Avtorizatsiya tekshiruvi
    if (!authorizedUsers.includes(chatId)) {
        if (text.trim() === BOT_PASSWORD) {
            authorizedUsers.push(chatId);
            saveJson(AUTHORIZED_FILE, authorizedUsers);
            return bot.sendMessage(chatId, '✅ Parol to\'g\'ri! Botdan foydalanishingiz mumkin.', { ...MAIN_MENU });
        }
        return bot.sendMessage(chatId, '❌ Parol noto\'g\'ri. Qaytadan kiriting:');
    }

    const actions = {
        '🌳 Lipa':                () => fetchAndSend(chatId, 'lipa', '🌳 Lipa'),
        '🌲 Olxa':                () => fetchAndSend(chatId, 'olxa', '🌲 Olxa'),
        '📊 Hammasi (Lipa + Olxa)': () => fetchAndSend(chatId, 'all', '📊 Hammasi'),
        '📨 Kanalga yuborish':    () => sendToChannel(chatId),
        '📋 Yordam':              () => sendHelp(chatId),
    };

    const action = actions[text];
    if (action) await action();
});

async function fetchAndSend(chatId, brand, label) {
    const loading = await bot.sendMessage(chatId, `⏳ ${label} qoldiqlari yuklanmoqda...`);
    const report = await getOstatokMessage(brand);
    try { await bot.deleteMessage(chatId, loading.message_id); } catch (_) {}
    await sendLongMessage(chatId, report);
}

async function sendToChannel(chatId) {
    if (!CHANNEL_ID) {
        return bot.sendMessage(chatId, '⚠️ CHANNEL_ID muhit o\'zgaruvchisi o\'rnatilmagan.');
    }
    const loading = await bot.sendMessage(chatId, '⏳ Kanalga xabar tayyorlanmoqda...');
    const report = await getOstatokMessage('all');
    try {
        await bot.sendMessage(CHANNEL_ID, '🌅 <b>Bugungi qoldiqlar:</b>', { parse_mode: 'HTML' });
        await sendLongMessage(CHANNEL_ID, report);
        try { await bot.deleteMessage(chatId, loading.message_id); } catch (_) {}
        await bot.sendMessage(chatId, '✅ Kanalga muvaffaqiyatli yuborildi!');
    } catch (err) {
        await bot.sendMessage(chatId, `❌ Kanalga yuborishda xatolik: ${err.message}`);
    }
}

function sendHelp(chatId) {
    return bot.sendMessage(chatId,
        '📋 <b>Bot buyruqlari:</b>\n\n' +
        '/start — Botni ishga tushirish\n' +
        '/status — Bot holati\n' +
        '/subscribe — Kunlik hisobotga obuna\n' +
        '/unsubscribe — Obunadan chiqish\n\n' +
        '🕒 Avtomatik hisobot har kuni <b>09:00</b> da (Toshkent vaqti)',
        { parse_mode: 'HTML' }
    );
}

// ==== HAR KUNGI AVTOMATIK HISOBOT (09:00 TOSHKENT) ====
cron.schedule('0 9 * * *', async () => {
    console.log('[CRON] Avtomatik hisobot yuborilmoqda...');
    const report = await getOstatokMessage('all');

    if (CHANNEL_ID) {
        try {
            await bot.sendMessage(CHANNEL_ID, '🌅 <b>Xayrli tong! Bugungi nalichiya:</b>', { parse_mode: 'HTML' });
            await sendLongMessage(CHANNEL_ID, report);
            console.log('[CRON] Kanalga yuborildi.');
        } catch (err) {
            console.error('[CRON] Kanal xatosi:', err.message);
        }
    }

    for (const subId of [...subscribers]) {
        try {
            await bot.sendMessage(subId, '🌅 <b>Bugungi avtomatik hisobot:</b>', { parse_mode: 'HTML' });
            await sendLongMessage(subId, report);
        } catch (err) {
            console.error(`[CRON] Subscriber ${subId} xatosi:`, err.message);
            // Botni bloklagan foydalanuvchini ro'yxatdan olib tashlash
            if (err.message.includes('bot was blocked') || err.message.includes('user is deactivated')) {
                const idx = subscribers.indexOf(subId);
                if (idx > -1) {
                    subscribers.splice(idx, 1);
                    saveJson(SUBSCRIBERS_FILE, subscribers);
                    console.log(`[CRON] Subscriber ${subId} ro'yxatdan o'chirildi (bot bloklangan).`);
                }
            }
        }
    }
}, { scheduled: true, timezone: 'Asia/Tashkent' });

console.log('[BOT] Ishga tushdi ✅');
