const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const phoneRe = /^(0|\+84)[0-9]{9,10}$/;
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID env var');
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
    const chatIds = String(TELEGRAM_CHAT_ID).split(',').map(id => id.trim()).filter(Boolean);
    const results = await Promise.all(chatIds.map(chatId =>
      fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      }).then(r => r.json())
    ));

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

app.get('/api/health', (req, res) => {
  res.json({ ok: true, telegramConfigured: Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) });
});

app.listen(PORT, () => {
  console.log(`Fit and Care server listening on port ${PORT}`);
});
