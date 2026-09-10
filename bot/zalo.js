// Client mỏng cho Zalo Bot Platform API.
// Docs chính thức: https://docs.zaloplatforms.com/docs/BOT/apis/<method>
// Base URL + token nằm ngay trong path: https://bot-api.zaloplatforms.com/bot<TOKEN>/<method>

const ZALO_API_BASE = 'https://bot-api.zaloplatforms.com';

function getToken() {
  return process.env.ZALO_BOT_TOKEN || '';
}

// Không bao giờ log URL/token thật ra console — nếu cần log lỗi, phải thay token bằng "***".
function redactToken(value) {
  const token = getToken();
  const str = String(value);
  return token ? str.split(token).join('***') : str;
}

function apiUrl(method) {
  return `${ZALO_API_BASE}/bot${getToken()}/${method}`;
}

async function callApi(method, payload) {
  if (!getToken()) {
    console.error(`[zalo-bot] Thiếu ZALO_BOT_TOKEN, bỏ qua lệnh gọi API "${method}"`);
    return { ok: false, error: 'missing_token' };
  }
  try {
    const res = await fetch(apiUrl(method), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!data.ok) {
      console.error(`[zalo-bot] API "${method}" trả về lỗi:`, redactToken(JSON.stringify(data)));
    }
    return data;
  } catch (err) {
    console.error(`[zalo-bot] Gọi API "${method}" thất bại:`, redactToken(err && err.message));
    return { ok: false, error: 'request_failed' };
  }
}

function sendMessage(chatId, text) {
  return callApi('sendMessage', { chat_id: chatId, text });
}

// resolvePhotoUrl: ghép PUBLIC_BASE_URL (cùng biến env dùng cho VNPay trong server.js) với 1 path
// tương đối (vd "/assets/bot-knowledge/eat_hotpot.jpg") thành URL công khai tuyệt đối — dùng cho
// cả sendPhoto() bên dưới lẫn knowledge.sendKnowledgeItemPhoto() (fallback link ảnh, xem
// bot/knowledge.js — sau khi điều tra kỹ (2026-09-08: metadata/orientation/encoder A/B) xác nhận
// đây KHÔNG PHẢI lỗi ảnh mà là hạn chế Zalo Mobile hiển thị ảnh gửi qua sendPhoto/URL, nên
// production knowledge flow đã chuyển sang gửi link thay vì gọi sendPhoto trực tiếp).
const DEFAULT_PUBLIC_BASE_URL = 'https://fitandcare-web.fly.dev';

function resolvePhotoUrl(imagePathOrUrl) {
  const value = String(imagePathOrUrl || '');
  if (/^https?:\/\//i.test(value)) return value;
  const base = (process.env.PUBLIC_BASE_URL || DEFAULT_PUBLIC_BASE_URL).replace(/\/$/, '');
  const path = value.startsWith('/') ? value : `/${value}`;
  return `${base}${path}`;
}

// sendPhoto: theo docs.zaloplatforms.com/docs/BOT/apis/sendPhoto, "photo" phải là 1 URL string
// bắt đầu bằng http:// hoặc https:// (không phải upload file). Giữ lại như 1 API wrapper chung —
// production knowledge flow hiện KHÔNG còn gọi hàm này nữa (xem comment ở resolvePhotoUrl).
function sendPhoto(chatId, imagePathOrUrl, caption) {
  const photo = resolvePhotoUrl(imagePathOrUrl);
  // Validate trước khi gọi API: Zalo bắt buộc "photo" phải là URL http/https tuyệt đối.
  if (!/^https?:\/\//i.test(photo)) {
    console.error(
      '[zalo-bot] sendPhoto: URL ảnh không hợp lệ (phải bắt đầu bằng http:// hoặc https://), bỏ qua gọi API. Input gốc:',
      redactToken(String(imagePathOrUrl))
    );
    return Promise.resolve({ ok: false, error: 'invalid_photo_url' });
  }
  return callApi('sendPhoto', { chat_id: chatId, photo, caption });
}

function getMe() {
  return callApi('getMe', {});
}

function setWebhook(url, secretToken) {
  return callApi('setWebhook', { url, secret_token: secretToken });
}

function getWebhookInfo() {
  return callApi('getWebhookInfo', {});
}

module.exports = {
  sendMessage,
  sendPhoto,
  resolvePhotoUrl,
  getMe,
  setWebhook,
  getWebhookInfo,
  isConfigured: () => Boolean(getToken()),
};
