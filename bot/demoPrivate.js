// DEMO_PRIVATE MODE: mô phỏng trải nghiệm chat riêng ngay trong group, chỉ phục vụ demo MVP.
// Không đụng tới chat riêng thật (bot/handler.js::handleTextMessage) hay GROUP MODE bình thường
// (bot/group.js). Toàn bộ nội dung menu/submenu/placeholder được TÁI SỬ DỤNG từ bot/menu.js và
// bot/classify.js — file này chỉ thêm phần điều hướng (navigation stack).
//
// LƯU Ý: Zalo Bot Platform chỉ gửi sự kiện tin nhắn nhóm về webhook khi bot được @mention (hoặc
// bị "trả lời") — nên mọi lượt tương tác trong DEMO_PRIVATE ở group vẫn LUÔN cần @mention, kể cả
// khi đang trong demo. Không có (và không cần) cơ chế "bỏ qua mention" nào ở đây.
//
// State theo từng "demoKey" = `${groupChatId}:${senderId}` -> nhiều người trong cùng group
// không ảnh hưởng nhau, và hoàn toàn tách biệt với state chat riêng thật (bot/handler.js có
// Map userState riêng, dùng chatId thật làm khoá).

const zalo = require('./zalo');
const menu = require('./menu');
const knowledge = require('./knowledge');
const faqData = require('./faqData');
const safety = require('./safety');
const unansweredQuestions = require('./unansweredQuestions');
const style = require('./style');
const { classify } = require('./classify');

function stripDiacritics(str) {
  return String(str)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

// Từ khoá điều hướng, đã chuẩn hoá bỏ dấu + viết thường (so khớp chuỗi đã qua stripDiacritics).
const ENTER_KEYWORDS = new Set(['demo private', 'private']);
const ROOT_KEYWORDS = new Set(['menu']);
const BACK_KEYWORDS = new Set(['0', 'back']);
const EXIT_KEYWORDS = new Set(['thoat', 'thoat demo']);

const DEMO_PRIVATE_BANNER =
  '🔒 Đây là chế độ mô phỏng chat riêng trong nhóm. Khi chat riêng thật, bạn không cần @bot.\n\n';

const DEMO_EXIT_REPLY =
  '🔓 Đã thoát DEMO PRIVATE MODE. Quay lại GROUP MODE bình thường — ' +
  'mention Bot kèm câu hỏi nếu bạn cần hỗ trợ tiếp nhé!';

const INVALID_NUMBER_REPLY =
  'Số bạn chọn không hợp lệ. Gõ "menu" để về menu chính hoặc "0"/"back" để quay lại 1 tầng.';

// demoKey ("groupChatId:senderId") -> session = { groupChatId, stack: Array<'ROOT' | { type: 'CATEGORY', key }> }
const sessions = new Map();

function findCategory(key) {
  return menu.CATEGORIES.find((c) => c.key === key);
}

// Vẽ lại nội dung của tầng đang đứng trên đỉnh stack — không hardcode đường đi, chỉ đọc stack.
function renderLevel(stack) {
  const top = stack[stack.length - 1];
  if (top === 'ROOT') return menu.buildMainMenuText();
  if (top.type === 'CATEGORY') {
    const category = findCategory(top.key);
    return category ? menu.buildCategoryText(category) : menu.buildMainMenuText();
  }
  if (top.type === 'KNOWLEDGE_ROOT') return knowledge.buildKnowledgeMenuText();
  if (top.type === 'KNOWLEDGE_GROUP') {
    const knowledgeGroup = knowledge.findGroup(top.key);
    return knowledgeGroup ? knowledge.buildGroupText(knowledgeGroup) : knowledge.buildKnowledgeMenuText();
  }
  return menu.buildMainMenuText();
}

function getSession(demoKey) {
  return sessions.get(demoKey) || null;
}

function startSession(demoKey, groupChatId) {
  const session = { groupChatId, stack: ['ROOT'] };
  sessions.set(demoKey, session);
  return session;
}

function endSession(demoKey) {
  sessions.delete(demoKey);
}

// Xử lý 1 tin nhắn của 1 sender đã @mention bot, thuộc về 1 session DEMO_PRIVATE đang tồn tại.
async function handleMessage(groupChatId, demoKey, rawText) {
  const trimmed = String(rawText || '').trim();
  const normalized = stripDiacritics(trimmed).toLowerCase();

  // --- Routing priority 1+2 (URGENT / MEDICAL & SPECIAL POPULATION ESCALATION) — TUYỆT ĐỐI ưu
  // tiên cao nhất, kể cả trước "thoát", đồng bộ với bot/handler.js (chat riêng thật). ---
  const safetyResult = safety.checkSafety(trimmed);
  if (safetyResult) {
    return zalo.sendMessage(groupChatId, safetyResult.message);
  }

  // "thoat"/"thoát" luôn được ưu tiên xử lý trước.
  if (EXIT_KEYWORDS.has(normalized)) {
    endSession(demoKey);
    return zalo.sendMessage(groupChatId, DEMO_EXIT_REPLY);
  }

  const session = sessions.get(demoKey);
  if (!session) return; // phòng hờ: caller phải đảm bảo session tồn tại trước khi gọi hàm này

  // Điều hướng theo stack, không hardcode đường quay lại — chỉ đọc/pop/push đỉnh stack.
  if (ROOT_KEYWORDS.has(normalized)) {
    session.stack = ['ROOT'];
    return zalo.sendMessage(groupChatId, renderLevel(session.stack));
  }

  if (BACK_KEYWORDS.has(normalized)) {
    if (session.stack.length > 1) session.stack.pop();
    return zalo.sendMessage(groupChatId, renderLevel(session.stack));
  }

  const isPureNumber = /^\d+$/.test(trimmed);
  if (isPureNumber) {
    const index = Number(trimmed) - 1;
    const top = session.stack[session.stack.length - 1];

    if (top === 'ROOT') {
      if (index === menu.CATEGORIES.length) {
        // Chọn mục cuối "📚 KIẾN THỨC FIT AND CARE" (xem bot/knowledge.js).
        session.stack.push({ type: 'KNOWLEDGE_ROOT' });
        return zalo.sendMessage(groupChatId, renderLevel(session.stack));
      }
      const category = menu.CATEGORIES[index];
      if (category) {
        session.stack.push({ type: 'CATEGORY', key: category.key });
        return zalo.sendMessage(groupChatId, renderLevel(session.stack));
      }
      return zalo.sendMessage(groupChatId, INVALID_NUMBER_REPLY);
    }

    if (top.type === 'CATEGORY') {
      const category = findCategory(top.key);
      const question = category && category.questions[index];
      if (question) {
        return zalo.sendMessage(groupChatId, menu.PLACEHOLDER_REPLY);
      }
      return zalo.sendMessage(groupChatId, INVALID_NUMBER_REPLY);
    }

    if (top.type === 'KNOWLEDGE_ROOT') {
      const knowledgeGroup = knowledge.GROUPS[index];
      if (knowledgeGroup) {
        session.stack.push({ type: 'KNOWLEDGE_GROUP', key: knowledgeGroup.key });
        return zalo.sendMessage(groupChatId, renderLevel(session.stack));
      }
      return zalo.sendMessage(groupChatId, INVALID_NUMBER_REPLY);
    }

    // top.type === 'KNOWLEDGE_GROUP' -> chọn 1 bài cụ thể trong nhóm.
    const item = knowledge.getGroupItem(top.key, index);
    if (item) {
      await zalo.sendMessage(groupChatId, item.reply);
      return knowledge.sendKnowledgeItemPhoto(zalo, groupChatId, item);
    }
    return zalo.sendMessage(groupChatId, INVALID_NUMBER_REPLY);
  }

  // Routing priority 4 (FAQ — bot/faqData.js) trước priority 5 (Knowledge 22-item matcher).
  if (await faqData.respondFaq(zalo, groupChatId, trimmed)) return;

  // Câu hỏi tự do -> ưu tiên khớp Kiến thức FIT AND CARE (text + ảnh, có thể nhiều bài cùng lúc
  // — xem knowledge.findKnowledgeItems) trước; nếu không khớp mới rơi xuống phân loại
  // keyword/rule đơn giản (dùng chung bot/classify.js).
  if (await knowledge.respondWithMatches(zalo, groupChatId, trimmed)) return;

  const category = classify(trimmed);
  if (category === 'MEDICAL_SAFETY') {
    return zalo.sendMessage(groupChatId, menu.SAFETY_REPLY);
  }

  // Routing priority 6 (UNKNOWN fallback) — đồng bộ bot/handler.js: ghi nhận câu hỏi rồi trả
  // wording chính thức, không dùng placeholder "đang phát triển" cũ.
  unansweredQuestions.recordUnansweredIfEligible(trimmed, 'GROUP_DEMO');
  return zalo.sendMessage(groupChatId, style.NOT_ENOUGH_DATA);
}

module.exports = {
  sessions,
  getSession,
  startSession,
  endSession,
  handleMessage,
  ENTER_KEYWORDS,
  DEMO_PRIVATE_BANNER,
};
