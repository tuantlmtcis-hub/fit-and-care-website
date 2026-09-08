// Ghi nhận câu hỏi bot CHƯA có đủ dữ liệu để trả lời (đã qua safety -> navigation/menu -> FAQ ->
// knowledge mà vẫn không khớp gì, trước khi trả UNKNOWN fallback — xem bot/handler.js,
// bot/demoPrivate.js) để đội ngũ FIT AND CARE định kỳ bổ sung knowledge base.
//
// Lưu persistent tại DATA_DIR/unanswered-questions.json (cùng DATA_DIR + cùng convention
// load/save đồng bộ với server.js::loadCustomerDB/saveCustomerDB — /data trên Fly Volume, giữ
// dữ liệu qua deploy/restart). KHÔNG lưu token/SĐT/user profile — chỉ lưu nội dung câu hỏi.

const fs = require('fs');
const path = require('path');
const { stripDiacritics } = require('./textNormalize');

const DATA_DIR = process.env.DATA_DIR || '/data';
const UNANSWERED_FILE = path.join(DATA_DIR, 'unanswered-questions.json');

const MAX_EXAMPLES = 5;

function loadStore() {
  try {
    const raw = fs.readFileSync(UNANSWERED_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.questions)) return parsed;
  } catch (err) {
    // chưa tồn tại lần đầu chạy
  }
  return { questions: [] };
}

function saveStore(db) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(UNANSWERED_FILE, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error('Không lưu được unanswered-questions.json (kiểm tra Fly Volume đã mount /data chưa)', err);
  }
}

// Dedup key: lowercase + bỏ dấu câu + gộp khoảng trắng thừa. CỐ Ý giữ nguyên dấu tiếng Việt (khác
// stripDiacritics dùng cho keyword-matching ở bot/textNormalize.js) — dedup cần phân biệt đúng
// các câu hỏi có nghĩa khác nhau (vd "chan" vs "chán"), không gộp nhầm như khi tìm kiếm mờ.
function normalizeForDedup(rawText) {
  return String(rawText || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/[?.!,;:'"“”‘’()[\]{}…–—-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- Loại trừ: chào hỏi / navigation / quá ngắn-vô nghĩa. Menu/back/0/thoát thực ra đã bị chặn
// từ trước khi luồng đi tới đây (xem bot/handler.js, bot/demoPrivate.js) — liệt kê lại ở đây chỉ
// để phòng hờ (defense-in-depth), không phải cơ chế chính. Export isGreeting() riêng để
// bot/handler.js dùng LẠI đúng danh sách này cho quyết định "first contact -> menu" thay vì dựa
// vào category UNKNOWN quá rộng của classify.js (classify() coi MỌI câu không khớp rule cũ nào
// là UNKNOWN, kể cả câu hỏi cụ thể — dẫn đến sai lệch nếu dùng để quyết định có log hay không).
const GREETING_WORDS = new Set(['xin chao', 'chao', 'chao ban', 'chao shop', 'hi', 'hii', 'hello', 'hey', 'alo']);
const NAV_WORDS = new Set(['menu', 'start', '/start', 'help', '/help', 'tro giup', 'back', '0', 'thoat', 'thoat demo']);

// So khớp bằng bản KHÔNG dấu (ASCII) — khác dedup key (giữ dấu) — để "chào bạn"/"Chào bạn!" đều
// khớp đúng 'chao ban' trong GREETING_WORDS.
function asciiKeyOf(rawText) {
  return stripDiacritics(normalizeForDedup(rawText)).toLowerCase();
}

function isGreeting(rawText) {
  return GREETING_WORDS.has(asciiKeyOf(rawText));
}

function isNavCommand(rawText) {
  return NAV_WORDS.has(asciiKeyOf(rawText));
}

function isLoggable(rawText) {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) return false;

  const key = normalizeForDedup(trimmed);
  if (!key) return false;
  if (isNavCommand(trimmed)) return false;
  if (isGreeting(trimmed)) return false;

  // Quá ngắn (1 "từ" và <=2 ký tự, vd "?", "ok", "ừ") -> coi là spam/vô nghĩa, không log — chỉ
  // loại các case rõ ràng, không cố nhận diện mọi loại spam.
  const words = key.split(/\s+/).filter(Boolean);
  if (words.length <= 1 && trimmed.length <= 2) return false;

  return true;
}

function nextId(db) {
  db.seq = (db.seq || 0) + 1;
  return 'uq-' + String(db.seq).padStart(4, '0');
}

// Ghi nhận 1 câu hỏi chưa trả lời được — dedup theo normalizedText, tăng count nếu đã tồn tại.
// chatType: 'PRIVATE' | 'GROUP_DEMO' (không log số điện thoại/user id thật). Trả về record đã
// ghi (hoặc null nếu bị loại bởi isLoggable — chào hỏi/nav/quá ngắn).
function recordUnansweredIfEligible(rawText, chatType) {
  const trimmed = String(rawText || '').trim();
  if (!isLoggable(trimmed)) return null;

  const normalizedText = normalizeForDedup(trimmed);
  const db = loadStore();
  const now = new Date().toISOString();

  let record = db.questions.find((q) => q.normalizedText === normalizedText);
  if (record) {
    record.count += 1;
    record.lastSeenAt = now;
    if (!record.examples.includes(trimmed) && record.examples.length < MAX_EXAMPLES) {
      record.examples.push(trimmed);
    }
    if (chatType && !record.chatTypes.includes(chatType)) {
      record.chatTypes.push(chatType);
    }
  } else {
    record = {
      id: nextId(db),
      representativeText: trimmed,
      normalizedText,
      examples: [trimmed],
      count: 1,
      firstSeenAt: now,
      lastSeenAt: now,
      chatTypes: chatType ? [chatType] : [],
      status: 'OPEN',
    };
    db.questions.push(record);
  }

  saveStore(db);
  return record;
}

// --- Report ---
// options: { status = 'OPEN', since, until, topN = 20 } — since/until là ISO string hoặc Date,
// lọc theo lastSeenAt (hoạt động gần đây trong khoảng). Trả { text, totalCount, totalTopics, top }.
function getUnansweredReport(options) {
  const opts = options || {};
  const status = opts.status === undefined ? 'OPEN' : opts.status; // null/false = không lọc status
  const since = opts.since ? new Date(opts.since).getTime() : null;
  const until = opts.until ? new Date(opts.until).getTime() : null;
  const topN = Number.isInteger(opts.topN) && opts.topN > 0 ? opts.topN : 20;

  const db = loadStore();
  let filtered = db.questions.slice();

  if (status) filtered = filtered.filter((q) => q.status === status);
  if (since !== null) filtered = filtered.filter((q) => new Date(q.lastSeenAt).getTime() >= since);
  if (until !== null) filtered = filtered.filter((q) => new Date(q.lastSeenAt).getTime() <= until);

  filtered.sort((a, b) => b.count - a.count || new Date(b.lastSeenAt) - new Date(a.lastSeenAt));

  const totalCount = filtered.reduce((sum, q) => sum + q.count, 0);
  const totalTopics = filtered.length;
  const top = filtered.slice(0, topN);

  const lines = ['📊 CÂU HỎI BOT CHƯA TRẢ LỜI ĐƯỢC', ''];
  if (top.length === 0) {
    lines.push('(chưa có câu hỏi nào được ghi nhận trong khoảng lọc này)');
  } else {
    top.forEach((q, i) => {
      lines.push(`${i + 1}. ${q.representativeText}`);
      lines.push(`   ${q.count} lượt`);
      lines.push('');
    });
  }
  lines.push('Tổng:');
  lines.push(`- ${totalCount} lượt unanswered`);
  lines.push(`- ${totalTopics} chủ đề unique`);

  return { text: lines.join('\n'), totalCount, totalTopics, top };
}

module.exports = {
  UNANSWERED_FILE,
  isLoggable,
  isGreeting,
  isNavCommand,
  normalizeForDedup,
  recordUnansweredIfEligible,
  getUnansweredReport,
  loadStore,
};
