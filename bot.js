require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const fs = require('fs');
const express = require('express');

// ==== EXPRESS SERVER (RENDER NI "TIRIK" SAQLASH UCHUN) ====
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is running...'));
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));

// ==== SOZLAMALAR (ENV DAN OLINADI) ====
const token = process.env.BOT_TOKEN;
const secretToken = process.env.BILLZ_SECRET_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const BOT_PASSWORD = process.env.BOT_PASSWORD || 'sauna2024';

if (!token || !secretToken) {
    console.error('Xatolik: BOT_TOKEN yoki BILLZ_SECRET_TOKEN topilmadi! .env faylini tekshiring.');
    process.exit(1);
}

const bot = new TelegramBot(token, {polling: true});

const SUBSCRIBERS_FILE = './subscribers.json';
const AUTHORIZED_FILE = './authorized_users.json';

let subscribers = [];
if (fs.existsSync(SUBSCRIBERS_FILE)) {
    subscribers = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8'));
}

let authorizedUsers = [];
if (fs.existsSync(AUTHORIZED_FILE)) {
    authorizedUsers = JSON.parse(fs.readFileSync(AUTHORIZED_FILE, 'utf8'));
}

function saveSubscribers() {
    fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(subscribers, null, 2));
}

function saveAuthorized() {
    fs.writeFileSync(AUTHORIZED_FILE, JSON.stringify(authorizedUsers, null, 2));
}

// Xabarni qismlarga bo'lib yuborish funksiyasi
async function sendLongMessage(chatId, text) {
    const MAX_LENGTH = 3800;
    if (text.length <= MAX_LENGTH) {
        await bot.sendMessage(chatId, text, {parse_mode: 'HTML'});
        return;
    }
    
    const parts = text.split('\n\n');
    let currentPart = '';
    
    for (const part of parts) {
        if ((currentPart + part + '\n\n').length > MAX_LENGTH) {
            await bot.sendMessage(chatId, currentPart, {parse_mode: 'HTML'});
            currentPart = part + '\n\n';
        } else {
            currentPart += part + '\n\n';
        }
    }
    
    if (currentPart.trim().length > 0) {
        await bot.sendMessage(chatId, currentPart, {parse_mode: 'HTML'});
    }
}

// ==== API DAN MA'LUMOT OLISH FUNKSIYASI ====
async function getOstatokMessage(brandFilter = 'all', catFilter = 'all') {
    const loginUrl = 'https://api-admin.billz.ai/v1/auth/login';
    
    try {
        const loginRes = await fetch(loginUrl, {
            method: 'POST',
            headers: { 'accept': 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ secret_token: secretToken })
        });
        
        const loginData = await loginRes.json();
        
        if (loginRes.ok && loginData.code === 200) {
            const accessToken = loginData.data.access_token;
            
            const productsUrl = 'https://api-admin.billz.ai/v2/products?limit=1000';
            const productsRes = await fetch(productsUrl, {
                method: 'GET',
                headers: { 'accept': 'application/json', 'Authorization': `Bearer ${accessToken}` }
            });
            
            if (productsRes.ok) {
                const productsData = await productsRes.json();
                
                const targetProducts = productsData.products.filter(product => {
                    const brandName = (product.brand_name || '').toLowerCase();
                    const productName = (product.name || '').toLowerCase();
                    const categoryNames = product.categories ? product.categories.map(c => c.name.toLowerCase()).join(' ') : '';
                    
                    const isLipa = brandName.includes('липа') || brandName.includes('lipa') || productName.includes('липа') || productName.includes('lipa');
                    const isOlxa = brandName.includes('ольха') || brandName.includes('olxa') || productName.includes('ольха') || productName.includes('olxa');
                    
                    if (!isLipa && !isOlxa) return false;
                    if (brandFilter === 'lipa' && !isLipa) return false;
                    if (brandFilter === 'olxa' && !isOlxa) return false;

                    const isSaunaTaxta = categoryNames.includes('сауна тахта') || categoryNames.includes('жомий сауна');
                    const isPlankType = productName.includes('вагонка') || productName.includes('vagonka') || 
                                       productName.includes('полок') || productName.includes('polok') ||
                                       productName.includes('термо') || productName.includes('termo');

                    if (!isSaunaTaxta && !isPlankType) return false;
                    return true;
                });

                const availableProducts = [];
                targetProducts.forEach(product => {
                    let totalStock = 0;
                    if (product.shop_measurement_values && product.shop_measurement_values.length > 0) {
                        product.shop_measurement_values.forEach(shop => {
                            totalStock += shop.active_measurement_value || 0;
                        });
                    }
                    
                    if (totalStock > 0) {
                        availableProducts.push({
                            name: product.name,
                            stock: totalStock,
                            brand: product.brand_name || '-'
                        });
                    }
                });

                if (availableProducts.length === 0) {
                    return `😔 Hozircha "${brandFilter === 'all' ? 'Taxtalar' : brandFilter.toUpperCase()}" nalichiyada qolmagan.`;
                }

                const grouped = {};
                availableProducts.forEach(prod => {
                    const name = prod.name;
                    const sizeMatch = name.match(/(\d+[\.,]?\d*)\s*(?:м|m)?$/i);
                    prod.size = sizeMatch ? parseFloat(sizeMatch[1].replace(',', '.')) : 0;

                    let categoryName = name.replace(/(\/\s*)?\d+[\.,]?\d*\s*(?:м|m)?$/i, '').trim();
                    categoryName = categoryName.replace(/[\/\-\\]$/, '').trim();
                    if (!categoryName) categoryName = 'Boshqa';

                    if (!grouped[categoryName]) {
                        grouped[categoryName] = [];
                    }
                    grouped[categoryName].push(prod);
                });

                const sortedCategories = Object.keys(grouped).sort((a, b) => {
                    const aLow = a.toLowerCase();
                    const bLow = b.toLowerCase();
                    const aIsVag = aLow.includes('вагонка') || aLow.includes('vagonka');
                    const bIsVag = bLow.includes('вагонка') || bLow.includes('vagonka');
                    if (aIsVag && !bIsVag) return -1;
                    if (!aIsVag && bIsVag) return 1;
                    const aIsPol = aLow.includes('полок') || aLow.includes('polok');
                    const bIsPol = bLow.includes('полок') || bLow.includes('polok');
                    if (aIsPol && !bIsPol) return -1;
                    if (!aIsPol && bIsPol) return 1;
                    return a.localeCompare(b);
                });

                let typeName = 'LIPA VA OLXA (SAUNA TAXTA)';
                if (brandFilter === 'lipa') typeName = 'LIPA (SAUNA TAXTA)';
                if (brandFilter === 'olxa') typeName = 'OLXA (SAUNA TAXTA)';
                
                let message = `🌲 <b>Nalichiyadagi ${typeName} qoldig'i</b> 🪵\n\n`;
                
                sortedCategories.forEach(key => {
                    grouped[key].sort((a, b) => a.size - b.size);
                    message += `🔸 <b>${key.toUpperCase()}</b>\n`;
                    message += `➖➖➖➖➖➖➖➖➖➖\n`;
                    grouped[key].forEach(prod => {
                        if (prod.size > 0) {
                            message += `🔹 ${prod.size} m — <b>${prod.stock} m</b>\n`;
                        } else {
                            message += `🔹 ${prod.name} — <b>${prod.stock} m</b>\n`;
                        }
                    });
                    message += `\n\n`;
                });
                return message;
            } else {
                return "❌ Tovarlarni tortib olishda xatolik yuz berdi.";
            }
        } else {
            return "❌ API avtorizatsiyadan o'ta olmadi.";
        }
    } catch(e) {
        return `❌ Xatolik yuz berdi: ${e.message}`;
    }
}

// ==== ASOSIY MENYU FUNKSIYASI ====
function getMainMenu() {
    return {
        reply_markup: {
            keyboard: [
                [{ text: '🌳 Lipa' }, { text: '🌲 Olxa' }],
                [{ text: '📊 Hammasi (Lipa+Olxa)' }],
                [{ text: '📨 Kanalga yuborish' }]
            ],
            resize_keyboard: true
        }
    };
}

// ==== TELEGRAM BOT KOMANDALARI ====
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    
    if (!authorizedUsers.includes(chatId)) {
        bot.sendMessage(chatId, "🔐 <b>Xush kelibsiz!</b>\n\nBotdan foydalanish uchun parolni kiriting:", {parse_mode: 'HTML'});
        return;
    }

    const welcomeText = `<b>Assalomu alaykum!</b>\n\nMen Billz tizimidan faqat <b>Lipa</b> va <b>Olxa</b> taxtalari qoldiqlarini ko'rsatuvchi botman.\n\nQaysi turdagi daraxt qoldig'ini ko'rmoqchisiz?`;
    bot.sendMessage(chatId, welcomeText, {parse_mode: 'HTML', ...getMainMenu()});
});

// ==== XABARLARNI QABUL QILISH ====
bot.on('message', async (msg) => {
    const text = msg.text;
    const chatId = msg.chat.id;
    
    if (!text) return;

    // Parol tekshiruvi
    if (!authorizedUsers.includes(chatId)) {
        if (text === BOT_PASSWORD) {
            authorizedUsers.push(chatId);
            saveAuthorized();
            bot.sendMessage(chatId, "✅ Parol to'g'ri! Botdan foydalanishingiz mumkin.", getMainMenu());
        } else if (text !== '/start') {
            bot.sendMessage(chatId, "❌ Parol noto'g'ri. Qaytadan urinib ko'ring:");
        }
        return;
    }

    if (text.startsWith('/')) return;
    
    if (text === '🌳 Lipa' || text === '🌲 Olxa' || text === '📊 Hammasi (Lipa+Olxa)') {
        let brand = 'all';
        if (text === '🌳 Lipa') brand = 'lipa';
        if (text === '🌲 Olxa') brand = 'olxa';

        await bot.sendMessage(chatId, `⏳ ${text} qoldiqlari yuklanmoqda...`);
        const report = await getOstatokMessage(brand);
        await sendLongMessage(chatId, report);
    }
    
    if (text === '📨 Kanalga yuborish') {
        await bot.sendMessage(chatId, "⏳ Kanalga xabar tayyorlanmoqda...");
        const report = await getOstatokMessage('all');
        try {
            await bot.sendMessage(CHANNEL_ID, "🌅 <b>Bugungi qoldiqlar:</b>", {parse_mode: 'HTML'});
            await sendLongMessage(CHANNEL_ID, report);
            await bot.sendMessage(chatId, "✅ Kanalga muvaffaqiyatli yuborildi!");
        } catch (err) {
            await bot.sendMessage(chatId, `❌ Kanalga yuborishda xatolik: ${err.message}`);
        }
    }
});

// ==== OBUNA BO'LISH (AVTOMATIK HISOBOT) ====
bot.onText(/\/subscribe/, (msg) => {
    const chatId = msg.chat.id;
    if (!authorizedUsers.includes(chatId)) return;

    if (!subscribers.includes(chatId)) {
        subscribers.push(chatId);
        saveSubscribers();
        bot.sendMessage(chatId, "✅ Siz har kungi (09:00) avtomatik hisobotga muvaffaqiyatli obuna bo'ldingiz!");
    } else {
        bot.sendMessage(chatId, "ℹ️ Siz allaqachon obuna bo'lgansiz.");
    }
});

bot.onText(/\/unsubscribe/, (msg) => {
    const chatId = msg.chat.id;
    const index = subscribers.indexOf(chatId);
    if (index > -1) {
        subscribers.splice(index, 1);
        saveSubscribers();
        bot.sendMessage(chatId, "❌ Siz avtomatik hisobotdan o'chirildingiz.");
    } else {
        bot.sendMessage(chatId, "ℹ️ Siz obunalar ro'yxatida yo'qsiz.");
    }
});

// ==== HAR KUNGI AVTOMATIK KANALGA JO'NATISH (CRON) ====
// Toshkent vaqti bilan har kuni soat 09:00 da
cron.schedule('0 9 * * *', async () => {
    console.log("Kanalga va obunachilarga avtomatik hisobot yuborilmoqda...");
    
    const report = await getOstatokMessage('all');
    
    // 1. Kanalga yuborish
    if (CHANNEL_ID) {
        try {
            await bot.sendMessage(CHANNEL_ID, "🌅 <b>Xayrli tong! Bugun nalichida quyidagi taxtalar bor:</b>", {parse_mode: 'HTML'});
            await sendLongMessage(CHANNEL_ID, report);
            console.log("Kanalga muvaffaqiyatli yuborildi.");
        } catch (err) {
            console.error(`Xatolik (Kanal):`, err.message);
        }
    }

    // 2. Obunachilarga yuborish
    for (const subId of subscribers) {
        try {
            await bot.sendMessage(subId, "🌅 <b>Bugungi avtomatik hisobot:</b>", {parse_mode: 'HTML'});
            await sendLongMessage(subId, report);
        } catch (err) {
            console.error(`Xatolik (Subscriber ${subId}):`, err.message);
        }
    }
}, {
    scheduled: true,
    timezone: "Asia/Tashkent"
});

console.log('Bot ishga tushdi...');
