// Xử lý sự kiện webhook từ Zalo Bot Platform cho FIT AND CARE Assistant (MVP).
// Update object do Zalo gửi có dạng: { event_name, message: { chat: { id, chat_type }, text, from, ... } }
// chat_type: "PRIVATE" (chat riêng) | "GROUP" (chat nhóm, Beta) — theo tài liệu chính thức
// docs.zaloplatforms.com/docs/BOT/webhook.

const zalo = require('./zalo');
const menu = require('./menu');
const group = require('./group');
const demoPrivate = require('./demoPrivate');
const knowledge = require('./knowledge');
const faqData = require('./faqData');
const safety = require('./safety');
const unansweredQuestions = require('./unansweredQuestions');
const style = require('./style');
const { classify } = require('./classify');

// Trạng thái hội thoại tạm thời của CHAT RIÊNG THẬT (không cần bền vững cho MVP):
// chatId -> category key đang xem. DEMO_PRIVATE trong group có state riêng, xem bot/demoPrivate.js.
const userState = new Map();

function findCategory(key) {
  return menu.CATEGORIES.find(c => c.key === key);
}

function stripDiacritics(str) {
  return String(str)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

const MENU_KEYWORDS = new Set(['menu', 'start', '/start', 'help', '/help', 'tro giup']);

// stateKey: khoá lưu userState (chatId thật hoặc "groupChatId:senderId" khi demo trong group).
// replyChatId: nơi thực sự gửi tin nhắn trả lời (luôn là 1 chat_id thật của Zalo).
// Với chat riêng, 2 giá trị này luôn giống nhau (giữ nguyên hành vi cũ y hệt).
async function replyMainMenu(stateKey, replyChatId) {
  userState.delete(stateKey);
  return zalo.sendMessage(replyChatId, menu.buildMainMenuText());
}

async function handleTextMessage(stateKey, replyChatId, rawText) {
  const text = String(rawText || '').trim();
  if (!text) return;

  // --- Routing priority 1+2 (URGENT / MEDICAL & SPECIAL POPULATION ESCALATION) — TUYỆT ĐỐI ưu
  // tiên cao nhất, kiểm tra TRƯỚC menu/nav/FAQ/knowledge. Không đụng state (userState) — chỉ trả
  // lời an toàn rồi dừng, không thay đổi luồng điều hướng đang có của user. ---
  const safetyResult = safety.checkSafety(text);
  if (safetyResult) {
    return zalo.sendMessage(replyChatId, safetyResult.message);
  }

  const normalized = stripDiacritics(text).toLowerCase();
  if (MENU_KEYWORDS.has(normalized)) {
    return replyMainMenu(stateKey, replyChatId);
  }

  // --- Đang trong 1 danh mục FAQ (1-6) và gõ "back" (không phải số, "0" xử lý ở nhánh số bên
  // dưới) -> quay lại menu chính. findCategory() chỉ khớp đúng 6 category key thật (NUTRITION,
  // EXERCISE, MEASUREMENT, PROGRAM, SUPPORT, OTHER), không bao giờ khớp state Kiến thức
  // (KNOWLEDGE_ROOT_STATE / KNOWLEDGE_GROUP_PREFIX:...) -> không ảnh hưởng Knowledge Library.
  if (normalized === 'back' && findCategory(userState.get(stateKey))) {
    return replyMainMenu(stateKey, replyChatId);
  }

  const isPureNumber = /^\d+$/.test(text);
  if (isPureNumber) {
    const index = Number(text) - 1;
    const currentState = userState.get(stateKey);

    // --- Đang xem 1 nhóm Kiến thức: "0" quay lại danh sách nhóm, hoặc chọn số = 1 bài cụ thể. ---
    if (knowledge.isKnowledgeGroupState(currentState)) {
      if (text === '0') {
        userState.set(stateKey, knowledge.KNOWLEDGE_ROOT_STATE);
        return zalo.sendMessage(replyChatId, knowledge.buildKnowledgeMenuText());
      }
      const groupKey = knowledge.groupKeyFromState(currentState);
      const item = knowledge.getGroupItem(groupKey, index);
      if (item) {
        await zalo.sendMessage(replyChatId, item.reply);
        return knowledge.sendKnowledgeItemPhoto(zalo, replyChatId, item);
      }
      return zalo.sendMessage(
        replyChatId,
        'Số bạn chọn không hợp lệ. Gõ "0" để quay lại hoặc "menu" để về menu chính.'
      );
    }

    // --- Đang xem danh sách nhóm Kiến thức: chọn nhóm (1-6) hoặc "0" quay lại menu chính. ---
    if (currentState === knowledge.KNOWLEDGE_ROOT_STATE) {
      if (text === '0') {
        return replyMainMenu(stateKey, replyChatId);
      }
      const knowledgeGroup = knowledge.GROUPS[index];
      if (knowledgeGroup) {
        userState.set(stateKey, knowledge.knowledgeGroupState(knowledgeGroup.key));
        return zalo.sendMessage(replyChatId, knowledge.buildGroupText(knowledgeGroup));
      }
      return zalo.sendMessage(replyChatId, 'Số bạn chọn không hợp lệ. Gõ "0" để quay lại hoặc "menu" để về menu chính.');
    }

    // --- Ở menu chính hoặc trong 1 danh mục FAQ (hành vi cũ, không đổi) ---
    if (!currentState) {
      if (index === menu.CATEGORIES.length) {
        // Chọn mục cuối "📚 KIẾN THỨC FIT AND CARE" (xem bot/knowledge.js).
        userState.set(stateKey, knowledge.KNOWLEDGE_ROOT_STATE);
        return zalo.sendMessage(replyChatId, knowledge.buildKnowledgeMenuText());
      }
      const category = menu.CATEGORIES[index];
      if (category) {
        userState.set(stateKey, category.key);
        return zalo.sendMessage(replyChatId, menu.buildCategoryText(category));
      }
      return zalo.sendMessage(replyChatId, 'Số bạn chọn không hợp lệ. Gõ "menu" để xem lại danh mục.');
    }

    // --- Đang trong 1 danh mục FAQ (1-6): "0" quay lại menu chính (giống "back", xem thêm ---
    // --- nhánh chữ "back" phía trên đầu hàm). ---
    if (text === '0') {
      return replyMainMenu(stateKey, replyChatId);
    }

    const category = findCategory(currentState);
    const question = category && category.questions[index];
    if (question) {
      return zalo.sendMessage(replyChatId, menu.PLACEHOLDER_REPLY);
    }
    return zalo.sendMessage(replyChatId, 'Số bạn chọn không hợp lệ. Gõ "menu" để xem lại danh mục.');
  }

  // --- Routing priority 4 (FAQ chương trình/dinh dưỡng/vận động/cân đo — bot/faqData.js) TRƯỚC
  // routing priority 5 (Knowledge 22-item matcher hiện tại — bot/knowledge.js), như yêu cầu. ---
  if (await faqData.respondFaq(zalo, replyChatId, text)) return;

  // --- Câu hỏi tự do: ưu tiên khớp Kiến thức FIT AND CARE (text + ảnh, có thể nhiều bài cùng
  // lúc — xem knowledge.findKnowledgeItems) trước; nếu không khớp mới rơi xuống phân loại
  // keyword/rule đơn giản như hiện tại (chưa dùng AI/RAG). ---
  if (await knowledge.respondWithMatches(zalo, replyChatId, text)) return;

  const category = classify(text);

  // --- FIRST CONTACT: private chat CHƯA có state/session (chưa từng chọn danh mục/duyệt gì) VÀ
  // câu chào thật (xem unansweredQuestions.isGreeting — KHÔNG dùng category==='UNKNOWN' của
  // classify.js nữa vì nó coi MỌI câu không khớp 5 rule cũ là UNKNOWN, kể cả câu hỏi cụ thể chưa
  // có FAQ/knowledge, khiến các câu đó bị chuyển hướng sang menu thay vì được ghi nhận unanswered
  // đúng yêu cầu — xem bot/unansweredQuestions.js) -> chào + menu chính.
  // (2026-09-08: đã bỏ luôn nhánh PROGRAM shortcut cũ ở đây — lý do ban đầu là né placeholder
  // "đang phát triển" cho tin nhắn đầu tiên, nay không còn cần vì style.NOT_ENOUGH_DATA đã đủ
  // thân thiện.) ---
  if (!userState.has(stateKey) && unansweredQuestions.isGreeting(text)) {
    return replyMainMenu(stateKey, replyChatId);
  }

  if (category === 'MEDICAL_SAFETY') {
    return zalo.sendMessage(replyChatId, menu.SAFETY_REPLY);
  }

  // --- Routing priority 6 (UNKNOWN fallback) — đã qua safety(1,2) -> nav/menu(3) -> FAQ(4) ->
  // knowledge(5) mà vẫn không khớp gì. Ghi nhận câu hỏi (bot/unansweredQuestions.js — tự loại
  // chào hỏi/nav/spam quá ngắn) rồi trả wording chính thức, KHÔNG dùng placeholder "đang phát
  // triển" cũ (menu.PLACEHOLDER_REPLY vẫn giữ nguyên cho nhánh chọn-số-câu-hỏi-FAQ-cũ khác, xem
  // trên — không đổi UX đó, ngoài phạm vi yêu cầu lần này). ---
  unansweredQuestions.recordUnansweredIfEligible(text, 'PRIVATE');
  return zalo.sendMessage(replyChatId, style.NOT_ENOUGH_DATA);
}

// --- Chat nhóm (GROUP, Beta): mặc định im lặng, chỉ trả lời khi được @mention. ---
// Không hiện menu/submenu trong group thường — chỉ 3 dạng trả lời ngắn (xem bot/group.js).
// DEMO_PRIVATE (mô phỏng cây menu private) vẫn LUÔN cần @mention cho mọi lượt tương tác —
// Zalo Bot Platform chỉ gửi sự kiện tin nhắn nhóm về webhook khi bot được @mention, nên không
// có (và không cần) cơ chế "bỏ qua mention" nào ở đây.
async function handleGroupMessage(chatId, message) {
  const senderId = message.from && message.from.id;
  const demoKey = `${chatId}:${senderId}`;

  const botIdentity = await group.getBotIdentity();
  const { mentioned, strippedText } = group.detectMention(message.text, botIdentity);

  // Log an toàn: chat type, sender id, group chat id, có mention hay không. KHÔNG log token.
  console.log('[zalo-bot] group message', {
    chatType: 'GROUP',
    groupChatId: chatId,
    senderId,
    mentioned,
  });

  if (!mentioned) return; // im lặng hoàn toàn, không gửi phản hồi

  if (!strippedText) {
    return zalo.sendMessage(chatId, group.GROUP_SHORT_REPLY);
  }

  // --- DEMO PRIVATE MODE: mô phỏng trải nghiệm chat riêng ngay trong group (chỉ để demo). ---
  const normalized = stripDiacritics(strippedText).toLowerCase().trim();

  if (demoPrivate.ENTER_KEYWORDS.has(normalized)) {
    demoPrivate.startSession(demoKey, chatId); // luôn (re)bắt đầu demo từ menu chính
    return zalo.sendMessage(chatId, demoPrivate.DEMO_PRIVATE_BANNER + menu.buildMainMenuText());
  }

  if (demoPrivate.getSession(demoKey)) {
    // Đang trong DEMO_PRIVATE -> giao cho demoPrivate xử lý điều hướng theo stack
    // (0/back/menu/thoat/số/câu hỏi tự do). Nội dung menu/submenu/placeholder tái sử dụng
    // nguyên vẹn từ bot/menu.js + bot/classify.js.
    return demoPrivate.handleMessage(chatId, demoKey, strippedText);
  }

  // --- GROUP MODE bình thường (không đổi so với trước) ---
  // Phân loại bằng keyword/rule đơn giản (dùng chung bot/classify.js với chat riêng).
  const category = classify(strippedText);
  if (category === 'MEDICAL_SAFETY') {
    return zalo.sendMessage(chatId, group.GROUP_SAFETY_REPLY);
  }

  if (group.isShortQuestion(strippedText)) {
    return zalo.sendMessage(chatId, group.GROUP_SHORT_REPLY);
  }
  return zalo.sendMessage(chatId, group.GROUP_REDIRECT_TO_DM_REPLY);
}

async function handleUpdate(update) {
  const message = update && update.message;
  if (!message) return;

  const chatId = message.chat && message.chat.id;
  if (!chatId) return;

  const chatType = (message.chat && message.chat.chat_type) || 'PRIVATE';
  const senderId = message.from && message.from.id;

  if (chatType === 'GROUP') {
    if (typeof message.text !== 'string') {
      // MVP: group chỉ xử lý tin nhắn văn bản; ảnh/sticker/voice trong group -> im lặng bỏ qua.
      console.log('[zalo-bot] group message bỏ qua (không phải văn bản)', { groupChatId: chatId, senderId });
      return;
    }
    await handleGroupMessage(chatId, message);
    return;
  }

  // --- Chat riêng: giữ nguyên toàn bộ hành vi hiện tại, không thay đổi. ---
  console.log('[zalo-bot] private message', { chatType: 'PRIVATE', senderId });

  if (typeof message.text !== 'string') {
    await zalo.sendMessage(chatId, 'Hiện tại mình chỉ hỗ trợ tin nhắn dạng văn bản. Gõ "menu" để xem danh mục hỗ trợ.');
    return;
  }

  await handleTextMessage(chatId, chatId, message.text);
}

module.exports = { handleUpdate };
