const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || '';
const INITIAL_CHAT_IDS = process.env.TELEGRAM_CHAT_ID || '';

// Lưu bền vững trên Fly Volume (/data) để không mất khi máy nghỉ/khởi động lại.
const DATA_DIR = process.env.DATA_DIR || '/data';
const CHATIDS_FILE = path.join(DATA_DIR, 'chatids.json');
const CUSTOMERS_FILE = path.join(DATA_DIR, 'customers.json');

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
function saveChatIds(ids) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CHATIDS_FILE, JSON.stringify({ chatIds: ids }, null, 2));
  } catch (err) {
    console.error('Không lưu được chatids.json (kiểm tra Fly Volume đã mount /data chưa)', err);
  }
}

function loadCustomerDB() {
  try {
    const raw = fs.readFileSync(CUSTOMERS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.customers)) return parsed;
  } catch (err) {
    // chưa tồn tại lần đầu chạy
  }
  return { year: null, seq: 0, customers: [] };
}
function saveCustomerDB(db) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error('Không lưu được customers.json (kiểm tra Fly Volume đã mount /data chưa)', err);
  }
}

let chatIds = loadChatIds();
saveChatIds(chatIds);
let customerDB = loadCustomerDB();
saveCustomerDB(customerDB);

// Trạng thái tạm "đang chờ CTV nhập nội dung cập nhật" sau khi bấm nút — không cần lưu bền vững.
const pendingUpdate = new Map(); // chatId -> customerId

app.use(express.json());
app.use(express.static(path.join(__dirname)));

const phoneRe = /^(0|\+84)[0-9]{9,10}$/;
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const chatIdRe = /^-?\d{5,15}$/;
const customerIdRe = /^\d{2}-\d{4}$/;

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ---------- Múi giờ Việt Nam ----------
const vnFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
});
function vnParts(date) {
  const parts = vnFmt.formatToParts(date).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
  return { y: +parts.year, m: +parts.month, d: +parts.day, hh: parts.hour, mm: parts.minute };
}
function vnDateKey(date) {
  const p = vnParts(date);
  return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}
function vnDisplay(date) {
  const p = vnParts(date);
  return `${String(p.d).padStart(2, '0')}/${String(p.m).padStart(2, '0')}/${p.y} ${p.hh}:${p.mm}`;
}
// mốc 00:00 VN (UTC+7) của 1 ngày, trả về timestamp UTC ms
function vnMidnightMs(y, m, d) {
  return Date.UTC(y, m - 1, d) - 7 * 3600 * 1000;
}
function vnWeekday(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=CN...6=T7
}
function startOfVNDay(now) { const p = vnParts(now); return vnMidnightMs(p.y, p.m, p.d); }
function startOfVNWeek(now) {
  const p = vnParts(now);
  const wd = vnWeekday(p.y, p.m, p.d); // 0=CN
  const diffFromMonday = wd === 0 ? 6 : wd - 1;
  const mondayMs = vnMidnightMs(p.y, p.m, p.d) - diffFromMonday * 86400000;
  return mondayMs;
}
function startOfVNMonth(now) {
  const p = vnParts(now);
  return vnMidnightMs(p.y, p.m, 1);
}

// ---------- Mã khách hàng yy-xxxx ----------
function nextCustomerId() {
  const y = vnParts(new Date()).y % 100;
  if (customerDB.year !== y) {
    customerDB.year = y;
    customerDB.seq = 0;
  }
  customerDB.seq += 1;
  return `${String(y).padStart(2, '0')}-${String(customerDB.seq).padStart(4, '0')}`;
}

async function tgCall(method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}
function sendTelegramMessage(chatId, text, extra) {
  return tgCall('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML', ...extra });
}
async function sendLongMessage(chatId, text) {
  const CHUNK = 3800;
  if (text.length <= CHUNK) return sendTelegramMessage(chatId, text);
  let rest = text;
  while (rest.length) {
    await sendTelegramMessage(chatId, rest.slice(0, CHUNK));
    rest = rest.slice(CHUNK);
  }
}

// ---------- API: nhận đăng ký tư vấn từ website ----------
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

  const id = nextCustomerId();
  const record = {
    id,
    name: String(name).trim(),
    phone: String(phone).trim(),
    email: String(email).trim(),
    goal: goal || '',
    message: message || '',
    createdAt: new Date().toISOString(),
    updates: [],
  };
  customerDB.customers.push(record);
  saveCustomerDB(customerDB);

  const text =
    `<b>📩 Đăng ký tư vấn mới - Fit and Care</b>\n` +
    `Mã khách hàng: <code>${id}</code>\n\n` +
    `<b>Họ tên:</b> ${escapeHtml(record.name)}\n` +
    `<b>SĐT:</b> ${escapeHtml(record.phone)}\n` +
    `<b>Email:</b> ${escapeHtml(record.email)}\n` +
    `<b>Mục tiêu:</b> ${escapeHtml(record.goal || 'Chưa chọn')}\n` +
    `<b>Nội dung:</b> ${escapeHtml(record.message || 'Không có')}`;

  const keyboard = { inline_keyboard: [[{ text: '✏️ Cập nhật trạng thái', callback_data: `update:${id}` }]] };

  try {
    const results = await Promise.all(
      chatIds.map(chatId => sendTelegramMessage(chatId, text, { reply_markup: keyboard }))
    );
    const failed = results.filter(r => !r.ok);
    if (failed.length === results.length) {
      console.error('Telegram sendMessage failed for all chat ids', failed);
      return res.status(502).json({ ok: false, error: 'Không gửi được thông báo. Vui lòng thử lại hoặc liên hệ trực tiếp.' });
    }
    return res.json({ ok: true, id });
  } catch (err) {
    console.error('Telegram request error', err);
    return res.status(502).json({ ok: false, error: 'Không gửi được thông báo. Vui lòng thử lại hoặc liên hệ trực tiếp.' });
  }
});

// ---------- Report helpers ----------
function findCustomer(id) {
  return customerDB.customers.find(c => c.id === id);
}
function formatCustomerBlock(c) {
  const last = c.updates[c.updates.length - 1];
  const statusLine = last
    ? `Trạng thái mới nhất: ${escapeHtml(last.content)} <i>(bởi ${escapeHtml(last.byName || last.by)}, ${vnDisplay(new Date(last.at))})</i>`
    : `Trạng thái: <i>chưa liên hệ</i>`;
  return (
    `<code>${c.id}</code> - <b>${escapeHtml(c.name)}</b> - ${escapeHtml(c.phone)}\n` +
    `${statusLine}`
  );
}
function formatCustomerDetail(c) {
  const history = c.updates.length
    ? c.updates
        .map(u => `• ${vnDisplay(new Date(u.at))} <i>(${escapeHtml(u.byName || u.by)})</i>\n  ${escapeHtml(u.content)}`)
        .join('\n')
    : '<i>Chưa có cập nhật nào.</i>';
  return (
    `<b>Khách hàng <code>${c.id}</code></b>\n\n` +
    `<b>Họ tên:</b> ${escapeHtml(c.name)}\n` +
    `<b>SĐT:</b> ${escapeHtml(c.phone)}\n` +
    `<b>Email:</b> ${escapeHtml(c.email)}\n` +
    `<b>Mục tiêu:</b> ${escapeHtml(c.goal || 'Chưa chọn')}\n` +
    `<b>Nội dung đăng ký:</b> ${escapeHtml(c.message || 'Không có')}\n` +
    `<b>Đăng ký lúc:</b> ${vnDisplay(new Date(c.createdAt))}\n\n` +
    `<b>Lịch sử cập nhật (${c.updates.length}):</b>\n${history}`
  );
}
function customersInRange(fromMs, toMs) {
  return customerDB.customers.filter(c => {
    const t = new Date(c.createdAt).getTime();
    return t >= fromMs && t < toMs;
  });
}
function buildRangeReport(title, fromMs, toMs) {
  const list = customersInRange(fromMs, toMs);
  if (!list.length) return `<b>${title}</b>\nKhông có khách đăng ký nào trong khoảng thời gian này.`;
  const body = list.map(formatCustomerBlock).join('\n\n');
  return `<b>${title} (${list.length} khách)</b>\n\n${body}`;
}

// ---------- Webhook Telegram ----------
app.post('/api/telegram-webhook', async (req, res) => {
  if (TELEGRAM_WEBHOOK_SECRET) {
    const incomingSecret = req.get('X-Telegram-Bot-Api-Secret-Token');
    if (incomingSecret !== TELEGRAM_WEBHOOK_SECRET) return res.sendStatus(401);
  }
  res.sendStatus(200); // ack ngay, xử lý bất đồng bộ

  try {
    if (!TELEGRAM_BOT_TOKEN) return;

    // --- Người dùng bấm nút inline ---
    const cb = req.body && req.body.callback_query;
    if (cb) {
      await tgCall('answerCallbackQuery', { callback_query_id: cb.id });
      const chatId = String(cb.message.chat.id);
      const isAuthorized = chatIds.includes(chatId);
      if (cb.data && cb.data.startsWith('update:')) {
        const custId = cb.data.slice('update:'.length);
        if (!isAuthorized) {
          await sendTelegramMessage(chatId, `⛔ Bạn chưa có quyền cập nhật. Gõ <code>/start</code> để lấy Chat ID rồi nhờ admin thêm bạn.`);
          return;
        }
        if (!findCustomer(custId)) {
          await sendTelegramMessage(chatId, `Không tìm thấy khách hàng <code>${custId}</code>.`);
          return;
        }
        pendingUpdate.set(chatId, custId);
        await sendTelegramMessage(chatId, `Nhập nội dung cập nhật cho khách <code>${custId}</code>:`, {
          reply_markup: { force_reply: true },
        });
      }
      return;
    }

    // --- Tin nhắn thường / lệnh ---
    const msg = req.body && req.body.message;
    if (!msg || !msg.text) return;

    const chatId = String(msg.chat.id);
    const fromName = [msg.from && msg.from.first_name, msg.from && msg.from.last_name].filter(Boolean).join(' ') || msg.from.username || chatId;
    const text = msg.text.trim();
    const isAuthorized = chatIds.includes(chatId);

    // Nếu đang chờ nội dung cập nhật (sau khi bấm nút) và tin nhắn này không phải lệnh mới
    if (!text.startsWith('/') && pendingUpdate.has(chatId)) {
      const custId = pendingUpdate.get(chatId);
      pendingUpdate.delete(chatId);
      const customer = findCustomer(custId);
      if (!customer) {
        await sendTelegramMessage(chatId, `Không tìm thấy khách hàng <code>${custId}</code> (có thể dữ liệu đã thay đổi).`);
        return;
      }
      if (!isAuthorized) {
        await sendTelegramMessage(chatId, `⛔ Bạn chưa có quyền cập nhật.`);
        return;
      }
      customer.updates.push({ by: chatId, byName: fromName, at: new Date().toISOString(), content: text });
      saveCustomerDB(customerDB);
      await sendTelegramMessage(chatId, `✅ Đã ghi nhận cập nhật cho khách <code>${custId}</code>.`);
      return;
    }

    if (text.startsWith('/start')) {
      await sendTelegramMessage(
        chatId,
        `👋 Xin chào! Đây là bot thông báo đăng ký tư vấn của <b>Fit and Care</b>.\n\n` +
        `Chat ID của bạn là:\n<code>${chatId}</code>\n\n` +
        (isAuthorized
          ? `✅ Bạn đang <b>được nhận</b> thông báo đăng ký tư vấn.`
          : `⛔ Bạn <b>chưa</b> được nhận thông báo. Gửi mã Chat ID này cho quản trị viên đã có quyền để họ chạy lệnh <code>/add</code> thêm bạn.`) +
        `\n\nGõ <code>/help</code> để xem các lệnh khác.`
      );
      return;
    }

    if (text.startsWith('/help')) {
      const adminCommands = isAuthorized
        ? `\n\n<b>Quản lý người nhận:</b>\n` +
          `<code>/add &lt;chat_id&gt;</code> - Thêm người nhận thông báo mới\n` +
          `<code>/remove &lt;chat_id&gt;</code> - Ngừng gửi thông báo cho 1 người\n` +
          `<code>/list</code> - Xem danh sách chat_id đang nhận thông báo\n\n` +
          `<b>Chăm sóc khách hàng:</b>\n` +
          `<code>/update &lt;mã KH&gt; &lt;nội dung&gt;</code> - Cập nhật trạng thái 1 khách (hoặc bấm nút "Cập nhật" dưới tin nhắn khách)\n` +
          `<code>/check-cust</code> - Danh sách khách đăng ký hôm nay\n` +
          `<code>/check-cust &lt;mã KH&gt;</code> - Xem chi tiết + toàn bộ lịch sử cập nhật của 1 khách\n` +
          `<code>/check-cust-week</code> - Danh sách khách đăng ký tuần này\n` +
          `<code>/check-cust-month</code> - Danh sách khách đăng ký tháng này\n` +
          `<code>/check-id [chat_id]</code> - Thống kê số khách bạn (hoặc người khác) đã tương tác`
        : '';
      await sendTelegramMessage(
        chatId,
        `<b>Các lệnh hỗ trợ:</b>\n<code>/start</code> - Lấy Chat ID của bạn\n<code>/help</code> - Xem danh sách lệnh này` + adminCommands
      );
      return;
    }

    if (!isAuthorized) {
      if (text.startsWith('/')) {
        await sendTelegramMessage(chatId, `⛔ Bạn chưa có quyền dùng lệnh này. Gõ <code>/start</code> để lấy Chat ID rồi nhờ admin thêm bạn.`);
      }
      return;
    }

    if (text.startsWith('/list')) {
      const list = chatIds.length ? chatIds.map(id => `• <code>${id}</code>`).join('\n') : '(danh sách rỗng)';
      await sendTelegramMessage(chatId, `<b>Danh sách đang nhận thông báo (${chatIds.length}):</b>\n${list}`);
      return;
    }

    if (text.startsWith('/add')) {
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
      await sendTelegramMessage(target, `🎉 Bạn vừa được thêm vào danh sách nhận thông báo đăng ký tư vấn của Fit and Care. Gõ <code>/help</code> để xem các lệnh.`);
      return;
    }

    if (text.startsWith('/remove')) {
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

    if (text.startsWith('/update')) {
      const parts = text.split(/\s+/);
      const custId = parts[1];
      const content = parts.slice(2).join(' ');
      if (!custId || !customerIdRe.test(custId) || !content) {
        await sendTelegramMessage(chatId, `Cú pháp: <code>/update 26-0001 đã liên hệ, hẹn gọi lại chiều mai</code>`);
        return;
      }
      const customer = findCustomer(custId);
      if (!customer) {
        await sendTelegramMessage(chatId, `Không tìm thấy khách hàng <code>${custId}</code>.`);
        return;
      }
      customer.updates.push({ by: chatId, byName: fromName, at: new Date().toISOString(), content });
      saveCustomerDB(customerDB);
      await sendTelegramMessage(chatId, `✅ Đã ghi nhận cập nhật cho khách <code>${custId}</code>.`);
      return;
    }

    if (text.startsWith('/check-cust-week')) {
      const now = new Date();
      const from = startOfVNWeek(now);
      const to = from + 7 * 86400000;
      await sendLongMessage(chatId, buildRangeReport('Khách đăng ký tuần này', from, to));
      return;
    }

    if (text.startsWith('/check-cust-month')) {
      const now = new Date();
      const from = startOfVNMonth(now);
      const p = vnParts(now);
      const nextMonth = p.m === 12 ? { y: p.y + 1, m: 1 } : { y: p.y, m: p.m + 1 };
      const to = vnMidnightMs(nextMonth.y, nextMonth.m, 1);
      await sendLongMessage(chatId, buildRangeReport('Khách đăng ký tháng này', from, to));
      return;
    }

    if (text.startsWith('/check-cust')) {
      const arg = text.split(/\s+/)[1];
      if (arg) {
        if (!customerIdRe.test(arg)) {
          await sendTelegramMessage(chatId, `Mã khách hàng không hợp lệ. Cú pháp: <code>/check-cust 26-0001</code>`);
          return;
        }
        const customer = findCustomer(arg);
        if (!customer) {
          await sendTelegramMessage(chatId, `Không tìm thấy khách hàng <code>${arg}</code>.`);
          return;
        }
        await sendLongMessage(chatId, formatCustomerDetail(customer));
        return;
      }
      const now = new Date();
      const from = startOfVNDay(now);
      const to = from + 86400000;
      await sendLongMessage(chatId, buildRangeReport('Khách đăng ký hôm nay', from, to));
      return;
    }

    if (text.startsWith('/check-id')) {
      const parts = text.split(/\s+/);
      const target = parts[1] || chatId;
      const interactions = [];
      customerDB.customers.forEach(c => {
        c.updates.forEach(u => {
          if (String(u.by) === String(target)) interactions.push({ custId: c.id, custName: c.name, at: u.at, content: u.content });
        });
      });
      if (!interactions.length) {
        await sendTelegramMessage(chatId, `Chưa có tương tác nào được ghi nhận cho <code>${target}</code>.`);
        return;
      }
      interactions.sort((a, b) => new Date(b.at) - new Date(a.at));
      const body = interactions
        .map(i => `<code>${i.custId}</code> - ${escapeHtml(i.custName)} - ${vnDisplay(new Date(i.at))}\n${escapeHtml(i.content)}`)
        .join('\n\n');
      await sendLongMessage(chatId, `<b>${target === chatId ? 'Bạn' : target} đã tương tác với ${interactions.length} lượt khách:</b>\n\n${body}`);
      return;
    }
  } catch (err) {
    console.error('Webhook handling error', err);
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    telegramConfigured: Boolean(TELEGRAM_BOT_TOKEN && chatIds.length > 0),
    recipients: chatIds.length,
    customers: customerDB.customers.length,
  });
});

app.listen(PORT, () => {
  console.log(`Fit and Care server listening on port ${PORT}`);
});
