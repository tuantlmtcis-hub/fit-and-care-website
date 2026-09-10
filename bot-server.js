require('dotenv').config();

const express = require('express');

const zaloBot = require('./bot/zalo');
const zaloBotHandler = require('./bot/handler');

const app = express();
const PORT = process.env.PORT || 8080;

const ZALO_BOT_WEBHOOK_SECRET = process.env.ZALO_BOT_WEBHOOK_SECRET || '';

app.use(express.json());

// ---------- Webhook Zalo Bot (FIT AND CARE Assistant) ----------
app.post('/api/zalo-webhook', async (req, res) => {
  if (ZALO_BOT_WEBHOOK_SECRET) {
    const incomingSecret = req.get('X-Bot-Api-Secret-Token');
    if (incomingSecret !== ZALO_BOT_WEBHOOK_SECRET) return res.sendStatus(401);
  }
  res.sendStatus(200); // ack ngay, xử lý bất đồng bộ

  try {
    const eventName = req.body && req.body.event_name;
    const chatId = req.body && req.body.message && req.body.message.chat && req.body.message.chat.id;
    console.log('[zalo-bot] Nhận sự kiện:', eventName, chatId ? `chatId=${chatId}` : '');
    await zaloBotHandler.handleUpdate(req.body);
  } catch (err) {
    console.error('[zalo-bot] Lỗi xử lý webhook', err);
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    zaloBotConfigured: zaloBot.isConfigured(),
  });
});

app.listen(PORT, () => {
  console.log(`Fit and Care BOT server listening on port ${PORT}`);
});
