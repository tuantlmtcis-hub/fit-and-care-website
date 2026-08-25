const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const INITIAL_CHAT_IDS = process.env.TELEGRAM_CHAT_ID || '';

// Danh sách chat_id được lưu bền vững trên Fly Volume (/data) để không mất khi máy nghỉ/khởi động lại.
const DATA_DIR = process.env.DATA_DIR || '/data';
const CHATIDS_FILE = path.join(DATA_DIR, 'chatids.json');

function loadChatIds() {
  try {
    const raw = fs.readFileSync(CHATIDS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.chatIds)) return parsed.chatIds.map(String);
  } catch (err) {
    // file chưa tồn tại lần đầu chạy — sẽ seed từ env var bên dưới
  }
  return String(INITIAL_CHAT_IDS).split(',').map(id => id.trim()).filter(Boolean);
}

function saveChatIds(chatIds) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CHATIDS_FILE, JSON.stringify({ chatIds }, null, 2));
  } catch (err) {
    console.error('Không lưu được chatids.json (kiểm tra Fly Volume đã mount /data chưa)', err);
  }
}

let chatIds = loadChatIds();
saveChatIds(chatIds); // ghi lại ngay để file tồn tại từ lần chạy đầu

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const phoneRe = /^(0|\+84)[0-9]{9,10}$/;
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const chatIdRe = /^-?\d{5,15}$/;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function sendTelegramMessage(chatId, text) {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  });
  return res.json();
}

app.post('/api/consult', async (req, res) => {
  const { name, phone, email, goal, message } = req.body || {};

  if (!name || String(name).trim().length < 2) {
    return res.status(400).json({ ok: false, error: 'Họ tên không hợp lệ' });
  }
  if (!phoneRe.test(String(phone || '').trim())) {
    return res.status(400).json({ ok: false, error: 'Số điện thoại không hợp lệ' });
  }
  if (!emailRe.test(String(email || '').trim())) {
    return res.status(400).json({ ok: false, error: 'Email không hợp lệ' });
  }

  if (!TELEGRAM_BOT_TOKEN || chatIds.length === 0) {
    console.error('Chưa có TELEGRAM_BOT_TOKEN hoặc danh sách chat_id đang rỗng');
    return res.status(500).json({ ok: false, error: 'Hệ thống chưa được cấu hình để nhận đăng ký. Vui lòng liên hệ trực tiếp qua hotline/email.' });
  }

  const text =
    `<b>📩 Đăng ký tư vấn mới - Fit and Care</b>\n\n` +
    `<b>Họ tên:</b> ${escapeHtml(name)}\n` +
    `<b>SĐT:</b> ${escapeHtml(phone)}\n` +
    `<b>Email:</b> ${escapeHtml(email)}\n` +
    `<b>Mục tiêu:</b> ${escapeHtml(goal || 'Chưa chọn')}\n` +
    `<b>Nội dung:</b> ${escapeHtml(message || 'Không có')}`;

  try {
    const results = await Promise.all(chatIds.map(chatId => sendTelegramMessage(chatId, text)));

    const failed = results.filter(r => !r.ok);
    if (failed.length === results.length) {
      console.error('Telegram sendMessage failed for all chat ids', failed);
      return res.status(502).json({ ok: false, error: 'Không gửi được thông báo. Vui lòng thử lại hoặc liên hệ trực tiếp.' });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('Telegram request error', err);
    return res.status(502).json({ ok: false, error: 'Không gửi được thông báo. Vui lòng thử lại hoặc liên hệ trực tiếp.' });
  }
});

// Nhận tin nhắn/lệnh Telegram gửi tới bot (cần đăng ký webhook 1 lần, xem .env.example)
app.post('/api/telegram-webhook', async (req, res) => {
  if (TELEGRAM_WEBHOOK_SECRET) {
    const incomingSecret = req.get('X-Telegram-Bot-Api-Secret-Token');
    if (incomingSecret !== TELEGRAM_WEBHOOK_SECRET) {
      return res.sendStatus(401);
    }
  }

  res.sendStatus(200); // ack ngay cho Telegram, xử lý bất đồng bộ bên dưới

  try {
    const msg = req.body && req.body.message;
    if (!msg || !msg.text || !TELEGRAM_BOT_TOKEN) return;

    const chatId = String(msg.chat.id);
    const text = msg.text.trim();
    const isAuthorized = chatIds.includes(chatId);

    if (text.startsWith('/start')) {
      await sendTelegramMessage(
        chatId,
        `👋 Xin chào! Đây là bot thông báo đăng ký tư vấn của <b>Fit and Care</b>.\n\n` +
        `Chat ID của bạn là:\n<code>${chatId}</code>\n\n` +
        (isAuthorized
          ? `✅ Bạn đang <b>được nhận</b> thông báo đăng ký tư vấn.`
          : `⛔ Bạn <b>chưa</b> được nhận thông báo. Gửi mã Chat ID này cho quản trị viên đã có quyền để họ chạy lệnh /add thêm bạn.`) +
        `\n\nGõ /help để xem các lệnh khác.`
      );
      return;
    }

    if (text.startsWith('/help')) {
      const adminCommands = isAuthorized
        ? `\n\n<b>Lệnh quản trị (bạn đã có quyền):</b>\n` +
          `/add &lt;chat_id&gt; - Thêm người nhận thông báo mới\n` +
          `/remove &lt;chat_id&gt; - Ngừng gửi thông báo cho 1 người\n` +
          `/list - Xem danh sách chat_id đang nhận thông báo`
        : '';
      await sendTelegramMessage(
        chatId,
        `<b>Các lệnh hỗ trợ:</b>\n` +
        `/start - Lấy Chat ID của bạn\n` +
        `/help - Xem danh sách lệnh này` +
        adminCommands
      );
      return;
    }

    if (text.startsWith('/list')) {
      if (!isAuthorized) {
        await sendTelegramMessage(chatId, `⛔ Bạn chưa có quyền dùng lệnh này. Gõ /start để lấy Chat ID rồi nhờ admin thêm bạn.`);
        return;
      }
      const list = chatIds.length ? chatIds.map(id => `• <code>${id}</code>`).join('\n') : '(danh sách rỗng)';
      await sendTelegramMessage(chatId, `<b>Danh sách đang nhận thông báo (${chatIds.length}):</b>\n${list}`);
      return;
    }

    if (text.startsWith('/add')) {
      if (!isAuthorized) {
        await sendTelegramMessage(chatId, `⛔ Bạn chưa có quyền dùng lệnh này. Gõ /start để lấy Chat ID rồi nhờ admin thêm bạn.`);
        return;
      }
      const target = text.split(/\s+/)[1];
      if (!target || !chatIdRe.test(target)) {
        await sendTelegramMessage(chatId, `Cú pháp: <code>/add 123456789</code> (chat_id lấy từ lệnh /start của người muốn thêm)`);
        return;
      }
      if (chatIds.includes(target)) {
        await sendTelegramMessage(chatId, `Chat ID <code>${target}</code> đã có trong danh sách rồi.`);
        return;
      }
      chatIds.push(target);
      saveChatIds(chatIds);
      await sendTelegramMessage(chatId, `✅ Đã thêm <code>${target}</code> vào danh sách nhận thông báo.`);
      await sendTelegramMessage(target, `🎉 Bạn vừa được thêm vào danh sách nhận thông báo đăng ký tư vấn của Fit and Care.`);
      return;
    }

    if (text.startsWith('/remove')) {
      if (!isAuthorized) {
        await sendTelegramMessage(chatId, `⛔ Bạn chưa có quyền dùng lệnh này.`);
        return;
      }
      const target = text.split(/\s+/)[1];
      if (!target || !chatIds.includes(target)) {
        await sendTelegramMessage(chatId, `Không tìm thấy chat_id đó trong danh sách. Cú pháp: <code>/remove 123456789</code>`);
        return;
      }
      chatIds = chatIds.filter(id => id !== target);
      saveChatIds(chatIds);
      await sendTelegramMessage(chatId, `✅ Đã xóa <code>${target}</code> khỏi danh sách nhận thông báo.`);
      return;
    }
  } catch (err) {
    console.error('Webhook handling error', err);
  }
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, telegramConfigured: Boolean(TELEGRAM_BOT_TOKEN && chatIds.length > 0), recipients: chatIds.length });
});

app.listen(PORT, () => {
  console.log(`Fit and Care server listening on port ${PORT}`);
});
