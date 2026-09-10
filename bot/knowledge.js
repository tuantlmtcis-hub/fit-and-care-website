// Kiến thức FIT AND CARE: keyword mapping đơn giản (KHÔNG AI/RAG/vector DB) cho câu hỏi tự do
// trong PRIVATE CHAT và DEMO PRIVATE. Mỗi item = 1 đoạn text ngắn + 1 ảnh infographic liên quan.
// Ảnh nằm tại assets/bot-knowledge/*.jpg, được phục vụ tĩnh qua express.static(__dirname) sẵn có
// trong server.js — không cần thêm route mới. bot/zalo.js::sendPhoto() ghép PUBLIC_BASE_URL +
// imagePath thành URL công khai để gọi API sendPhoto (Zalo yêu cầu photo là 1 URL string).
//
// Kiểm tra tính nhất quán (22 item, id không trùng, file ảnh tồn tại, không collision keyword...):
// chạy `npm run check-knowledge` (xem scripts/check-knowledge.js).

const knowledgeLinks = require('./knowledgeLinks');

function stripDiacritics(str) {
  return String(str)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

// Chuẩn hoá thành chuỗi các "từ" cách nhau đúng 1 khoảng trắng, có đệm khoảng trắng ở 2 đầu,
// để so khớp theo ranh giới từ (tránh khớp nhầm xuyên từ, cùng kỹ thuật với bot/classify.js).
function normalizeForMatch(rawText) {
  const ascii = stripDiacritics(rawText).toLowerCase();
  const words = ascii.replace(/[^a-z0-9\s]/g, ' ').trim().split(/\s+/).filter(Boolean);
  return ` ${words.join(' ')} `;
}

const GROUPS = [
  { key: 'DAILY_EATING', emoji: '🍽️', title: 'Ăn uống hằng ngày' },
  { key: 'SPECIFIC_MEALS', emoji: '🍜', title: 'Món ăn cụ thể' },
  { key: 'FOOD_NUTRITION', emoji: '🥑', title: 'Thực phẩm & dinh dưỡng' },
  { key: 'COMMON_ISSUES', emoji: '⚖️', title: 'Vấn đề thường gặp' },
  { key: 'LIFESTYLE', emoji: '🌙', title: 'Lối sống' },
  { key: 'SPECIAL_OCCASION', emoji: '🎉', title: 'Dịp đặc biệt' },
];

// Chỉ khai báo dữ liệu thô (không tự lặp lại câu "FIT AND CARE gửi bạn ... 👇" 22 lần) —
// trường "reply" được build 1 lần bên dưới từ emoji + title, dùng chung 1 template.
const RAW_ITEMS = [
  // --- Ăn uống hằng ngày ---
  {
    id: 'meal_order_breakfast_lunch', category: 'DAILY_EATING', title: 'Thứ tự ăn bữa sáng/trưa', emoji: '🍽️',
    keywords: ['thu tu an bua sang', 'thu tu an bua trua', 'thu tu bua sang trua'],
    imagePath: '/assets/bot-knowledge/meal_order_breakfast_lunch_v2.jpg',
  },
  {
    id: 'main_meal_order', category: 'DAILY_EATING', title: 'Thứ tự bữa ăn chính', emoji: '🍽️',
    keywords: ['thu tu bua an chinh', 'thu tu an bua chinh'],
    imagePath: '/assets/bot-knowledge/main_meal_order_v2.jpg',
  },
  {
    id: 'why_meal_order_matters', category: 'DAILY_EATING', title: 'Vì sao thứ tự ăn quan trọng', emoji: '🍽️',
    keywords: ['tai sao thu tu an quan trong', 'thu tu an quan trong', 'vi sao thu tu an quan trong'],
    imagePath: '/assets/bot-knowledge/why_meal_order_matters_v2.jpg',
  },
  {
    id: 'hand_portion_rule', category: 'DAILY_EATING', title: 'Quy tắc bàn tay khi ăn', emoji: '✋',
    keywords: ['quy tac ban tay', 'khau phan ban tay'],
    imagePath: '/assets/bot-knowledge/hand_portion_rule_v2.jpg',
  },
  {
    id: 'food_preparation', category: 'DAILY_EATING', title: 'Chuẩn bị thức ăn', emoji: '🥗',
    keywords: ['chuan bi thuc an', 'chuan bi do an', 'meal prep'],
    imagePath: '/assets/bot-knowledge/food_preparation_v2.jpg',
  },
  {
    id: 'cooking_methods', category: 'DAILY_EATING', title: 'Phương pháp nấu ăn', emoji: '🍳',
    keywords: ['phuong phap nau an', 'cach nau an', 'che bien mon an'],
    imagePath: '/assets/bot-knowledge/cooking_methods_v2.jpg',
  },
  {
    id: 'drink_water', category: 'DAILY_EATING', title: 'Cách uống nước', emoji: '💧',
    keywords: ['uong nuoc', 'cach uong nuoc'],
    imagePath: '/assets/bot-knowledge/drink_water_v2.jpg',
  },

  // --- Món ăn cụ thể ---
  {
    id: 'eat_pho_ga', category: 'SPECIFIC_MEALS', title: 'Lưu ý ăn phở gà', emoji: '🍜',
    // "pho" đứng một mình PHẢI có: đây là item phở duy nhất trong KB, nên "ăn phở"/"phở" chung
    // chung (không nói rõ phở gà) vẫn phải match được, không chỉ "phở gà"/"ăn phở gà".
    keywords: ['pho ga', 'an pho ga', 'pho'],
    imagePath: '/assets/bot-knowledge/eat_pho_ga_v2.jpg',
  },
  {
    id: 'eat_bun_rieu', category: 'SPECIFIC_MEALS', title: 'Ăn bún riêu cua', emoji: '🍜',
    keywords: ['bun rieu', 'an bun rieu'],
    imagePath: '/assets/bot-knowledge/eat_bun_rieu_v2.jpg',
  },
  {
    id: 'eat_hotpot', category: 'SPECIFIC_MEALS', title: 'Lưu ý khi ăn lẩu', emoji: '🍲',
    keywords: ['an lau', 'lau', 'hotpot'],
    imagePath: '/assets/bot-knowledge/eat_hotpot_v2.jpg',
  },
  {
    id: 'eat_pizza', category: 'SPECIFIC_MEALS', title: 'Bí kíp ăn Pizza', emoji: '🍕',
    keywords: ['pizza', 'an pizza'],
    imagePath: '/assets/bot-knowledge/eat_pizza_v2.jpg',
  },
  {
    id: 'eat_porridge', category: 'SPECIFIC_MEALS', title: 'Bí kíp ăn cháo', emoji: '🥣',
    // Không dùng "chao" đứng một mình: trùng dạng bỏ dấu với "chào" (chào hỏi) và với
    // "nấu cháo" (cook_balanced_porridge) -> luôn yêu cầu cụm từ cụ thể hơn.
    keywords: ['an chao'],
    imagePath: '/assets/bot-knowledge/eat_porridge_v2.jpg',
  },
  {
    id: 'cook_balanced_porridge', category: 'SPECIFIC_MEALS', title: 'Nấu cháo đủ chất', emoji: '🥣',
    keywords: ['nau chao', 'nau chao du chat'],
    imagePath: '/assets/bot-knowledge/cook_balanced_porridge_v2.jpg',
  },
  {
    id: 'make_nem', category: 'SPECIFIC_MEALS', title: 'Bí kíp làm chả nem', emoji: '🥟',
    keywords: ['lam nem', 'cha nem', 'nem ran', 'cha gio'],
    imagePath: '/assets/bot-knowledge/make_nem_v2.jpg',
  },

  // --- Thực phẩm & dinh dưỡng ---
  {
    id: 'eat_fruit', category: 'FOOD_NUTRITION', title: 'Lưu ý ăn hoa quả', emoji: '🍎',
    keywords: ['an hoa qua', 'an trai cay', 'hoa qua', 'trai cay'],
    imagePath: '/assets/bot-knowledge/eat_fruit_v2.jpg',
  },
  {
    id: 'non_meat_protein', category: 'FOOD_NUTRITION', title: 'Tại sao cần đạm phi thịt', emoji: '🥑',
    keywords: ['dam phi thit', 'dam thuc vat', 'protein thuc vat'],
    imagePath: '/assets/bot-knowledge/non_meat_protein_v2.jpg',
  },
  {
    id: 'healthy_food_myths', category: 'FOOD_NUTRITION', title: 'Các món tưởng "healthy"', emoji: '🥑',
    keywords: ['hieu lam an uong', 'mon an gay beo', 'do an gay beo', 'mon tuong healthy'],
    imagePath: '/assets/bot-knowledge/healthy_food_myths_v2.jpg',
  },

  // --- Vấn đề thường gặp ---
  {
    id: 'weight_plateau', category: 'COMMON_ISSUES', title: 'Cải thiện chững cân', emoji: '⚖️',
    keywords: ['chung can'],
    imagePath: '/assets/bot-knowledge/weight_plateau_v2.jpg',
  },
  {
    id: 'constipation', category: 'COMMON_ISSUES', title: 'Bạn có đang bị táo bón?', emoji: '⚖️',
    keywords: ['tao bon'],
    imagePath: '/assets/bot-knowledge/constipation_v2.jpg',
  },

  // --- Lối sống ---
  {
    id: 'sleep_better', category: 'LIFESTYLE', title: 'Bí quyết ngủ ngon', emoji: '🌙',
    keywords: ['ngu ngon', 'mat ngu', 'kho ngu'],
    imagePath: '/assets/bot-knowledge/sleep_better_v2.jpg',
  },

  // --- Dịp đặc biệt ---
  {
    id: 'tet_feast', category: 'SPECIAL_OCCASION', title: 'Ăn cỗ ngày Tết', emoji: '🎉',
    keywords: ['an co ngay tet', 'co tet', 'mam co tet', 'an tet'],
    imagePath: '/assets/bot-knowledge/tet_feast_v2.jpg',
  },
  {
    id: 'holiday_with_fitandcare', category: 'SPECIAL_OCCASION', title: 'Nghỉ lễ với FIT AND CARE', emoji: '🎉',
    keywords: ['nghi le', 'ky nghi'],
    imagePath: '/assets/bot-knowledge/holiday_with_fitandcare_v2.jpg',
  },
];

function buildReplyText(item) {
  return `${item.emoji} ${item.title.toUpperCase()}\n\nFIT AND CARE gửi bạn hướng dẫn nhanh dưới đây 👇`;
}

const ITEMS = RAW_ITEMS.map((item) => ({ ...item, reply: buildReplyText(item) }));

// Điểm của 1 keyword = số từ trong cụm (vd "chững cân" = 2 từ > "cân" = 1 từ) — cụm càng dài/
// càng cụ thể thì điểm càng cao, đúng yêu cầu "match cụ thể phải thắng match chung chung".
function keywordScore(kw) {
  return stripDiacritics(kw).toLowerCase().trim().split(/\s+/).filter(Boolean).length;
}

// Quét TOÀN BỘ 22 item (không dừng ở match đầu tiên), lấy điểm CAO NHẤT trong số các keyword
// khớp của mỗi item (1 item chỉ tính 1 lần dù nhiều keyword của nó cùng khớp — không duplicate).
// Sắp xếp theo điểm giảm dần, hoà điểm thì theo id tăng dần để kết quả không phụ thuộc thứ tự
// RAW_ITEMS trong file lẫn thứ tự các cụm từ khoá xuất hiện trong câu người dùng gõ.
function findKnowledgeItems(rawText) {
  const text = normalizeForMatch(rawText);
  const scored = [];
  for (const item of ITEMS) {
    let bestScore = 0;
    for (const kw of item.keywords) {
      const padded = ` ${stripDiacritics(kw).toLowerCase()} `;
      if (text.includes(padded)) {
        const score = keywordScore(kw);
        if (score > bestScore) bestScore = score;
      }
    }
    if (bestScore > 0) scored.push({ item, score: bestScore });
  }
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.item.id < b.item.id) return -1;
    if (a.item.id > b.item.id) return 1;
    return 0;
  });
  return scored.map((s) => s.item);
}

// Tương thích ngược cho nơi chỉ cần 1 item khớp mạnh nhất.
function findByKeyword(rawText) {
  return findKnowledgeItems(rawText)[0] || null;
}

const MAX_KNOWLEDGE_RESULTS = 3;

function buildMultiMatchIntro(items) {
  const lines = items.map((item, i) => `${i + 1}. ${item.emoji} ${item.title}`);
  return '🔎 Mình thấy câu hỏi của bạn liên quan đến nhiều chủ đề:\n\n' + lines.join('\n');
}

function buildClarifyPrompt(items) {
  const lines = items.map((item, i) => `${i + 1}. ${item.emoji} ${item.title}`);
  return (
    '🤔 Câu hỏi của bạn có vẻ liên quan đến khá nhiều chủ đề, mình gợi ý vài mục gần nhất:\n\n' +
    lines.join('\n') +
    '\n\nBạn gõ cụ thể hơn (vd đúng tên chủ đề) để mình gửi đúng hướng dẫn nhé!'
  );
}

// Fallback ổn định cho MVP (2026-09-08) — sau khi điều tra kỹ (metadata, orientation, encoder
// A/B qua Pillow/sips, cùng known-good image + cùng respondWithMatches + cùng payload) vẫn FAIL
// trên Zalo Mobile dù PASS Desktop, kết luận: KHÔNG PHẢI lỗi ảnh/encoding — dừng sửa ảnh. Thay
// sendPhoto (ảnh) bằng sendMessage chứa link ảnh — ổn định trên mọi client vì không phụ thuộc
// Zalo Mobile tự tải/hiển thị ảnh trong khung chat. Dùng chung cho mọi nơi gửi ảnh 1 knowledge
// item (respondWithMatches ở đây, và nhánh chọn-số-bài-cụ-thể ở bot/handler.js +
// bot/demoPrivate.js).
//
// Bitly short link (2026-09-08): ưu tiên link ngắn cố định trong bot/knowledgeLinks.js (KHÔNG
// gọi Bitly API lúc runtime — bảng tĩnh) nếu item đã có; item CHƯA có (null) thì tự fallback về
// URL public dài qua zaloClient.resolvePhotoUrl() — CHÍNH CÙNG cơ chế PUBLIC_BASE_URL đang dùng,
// không tự chế URL khác, để bot không bao giờ bị hỏng vì thiếu Bitly URL.
async function sendKnowledgeItemPhoto(zaloClient, chatId, item) {
  const url = knowledgeLinks.getBitlyUrl(item.id) || zaloClient.resolvePhotoUrl(item.imagePath);
  return zaloClient.sendMessage(chatId, `📷 Xem infographic: ${url}`);
}

// Xử lý 1 lượt câu hỏi tự do bằng kết quả matching Kiến thức: gửi đúng 1/nhiều/không quá
// MAX_KNOWLEDGE_RESULTS bài (text + link ảnh, xem sendKnowledgeItemPhoto ở trên), hoặc hỏi lại
// nếu quá nhiều chủ đề cùng khớp (không xổ hàng loạt).
// zaloClient được truyền vào (không require './zalo' trực tiếp) để giữ file này thuần dữ
// liệu/logic — dùng chung được cho cả bot/handler.js (private) lẫn bot/demoPrivate.js (demo).
// Trả về true nếu đã xử lý xong (đã gửi gì đó); false nếu không có item nào khớp, để caller rơi
// xuống logic cũ (classify()/placeholder...).
async function respondWithMatches(zaloClient, replyChatId, rawText) {
  const items = findKnowledgeItems(rawText);
  if (items.length === 0) return false;

  if (items.length > MAX_KNOWLEDGE_RESULTS) {
    await zaloClient.sendMessage(replyChatId, buildClarifyPrompt(items.slice(0, MAX_KNOWLEDGE_RESULTS)));
    return true;
  }

  if (items.length > 1) {
    await zaloClient.sendMessage(replyChatId, buildMultiMatchIntro(items));
  }

  for (const item of items) {
    await zaloClient.sendMessage(replyChatId, item.reply);
    await sendKnowledgeItemPhoto(zaloClient, replyChatId, item);
  }
  return true;
}

function findGroup(key) {
  return GROUPS.find((g) => g.key === key);
}

function itemsInGroup(key) {
  return ITEMS.filter((i) => i.category === key);
}

// Chọn 1 bài theo vị trí hiển thị (0-based) trong danh sách của 1 nhóm — dùng khi user gõ số
// ở màn "đang xem 1 nhóm Kiến thức" (bot/handler.js, bot/demoPrivate.js).
function getGroupItem(groupKey, index) {
  const items = itemsInGroup(groupKey);
  return items[index] || null;
}

function buildKnowledgeMenuText() {
  const lines = GROUPS.map((g, i) => `${i + 1}. ${g.emoji} ${g.title}`);
  return (
    '📚 KIẾN THỨC FIT AND CARE\n\n' +
    lines.join('\n') +
    '\n\n0. Quay lại\nmenu. Menu chính'
  );
}

function buildGroupText(group) {
  const items = itemsInGroup(group.key);
  const lines = items.map((i, idx) => `${idx + 1}. ${i.title}`);
  return (
    `${group.emoji} ${group.title}\n\n` +
    'Gõ số để xem bài, hoặc gõ trực tiếp câu hỏi/từ khoá của bạn:\n\n' +
    lines.join('\n') +
    '\n\n0. Quay lại\nmenu. Menu chính'
  );
}

// Encode trạng thái "đang xem menu/nhóm Kiến thức" thành chuỗi để lưu chung trong userState
// (chat riêng thật) hoặc làm 1 loại stack-frame mới trong DEMO_PRIVATE — tránh mỗi nơi tự bịa
// 1 kiểu encode khác nhau.
const KNOWLEDGE_ROOT_STATE = '__KNOWLEDGE_ROOT__';
const KNOWLEDGE_GROUP_PREFIX = '__KNOWLEDGE_GROUP__:';

function knowledgeGroupState(groupKey) {
  return KNOWLEDGE_GROUP_PREFIX + groupKey;
}
function isKnowledgeGroupState(state) {
  return typeof state === 'string' && state.startsWith(KNOWLEDGE_GROUP_PREFIX);
}
function groupKeyFromState(state) {
  return state.slice(KNOWLEDGE_GROUP_PREFIX.length);
}

module.exports = {
  GROUPS,
  ITEMS,
  findByKeyword,
  findKnowledgeItems,
  respondWithMatches,
  sendKnowledgeItemPhoto,
  MAX_KNOWLEDGE_RESULTS,
  findGroup,
  itemsInGroup,
  getGroupItem,
  buildKnowledgeMenuText,
  buildGroupText,
  KNOWLEDGE_ROOT_STATE,
  knowledgeGroupState,
  isKnowledgeGroupState,
  groupKeyFromState,
};
