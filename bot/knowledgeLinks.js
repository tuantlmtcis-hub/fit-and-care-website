// Mapping CỐ ĐỊNH (static, KHÔNG gọi Bitly API lúc runtime): knowledge item id -> Bitly short URL.
// Dùng bởi bot/knowledge.js::sendKnowledgeItemPhoto() để gửi link ngắn thay vì URL public dài
// (assets/bot-knowledge/*.jpg) khi có sẵn. Giá trị null = CHƯA có Bitly URL thật -> caller tự
// fallback về URL public dài để bot không bị hỏng (xem sendKnowledgeItemPhoto).
//
// ĐỂ THÊM LINK BITLY THẬT: paste URL vào đúng dòng id tương ứng bên dưới, giữ nguyên format
// 'item_id': 'https://bit.ly/xxx',  — không cần sửa file nào khác, mapping được dùng tự động.
// Đủ 22 id khớp CHÍNH XÁC bot/knowledge.js (không đổi/không thêm/không xoá knowledge item nào).
const KNOWLEDGE_BITLY_LINKS = {
  // --- Ăn uống hằng ngày ---
  meal_order_breakfast_lunch: null,
  main_meal_order: null,
  why_meal_order_matters: null,
  hand_portion_rule: null,
  food_preparation: null,
  cooking_methods: null,
  drink_water: null,

  // --- Món ăn cụ thể ---
  eat_pho_ga: 'https://bit.ly/fit-pho',
  eat_bun_rieu: null,
  eat_hotpot: null,
  eat_pizza: null,
  eat_porridge: null,
  cook_balanced_porridge: null,
  make_nem: null,

  // --- Thực phẩm & dinh dưỡng ---
  eat_fruit: null,
  non_meat_protein: null,
  healthy_food_myths: null,

  // --- Vấn đề thường gặp ---
  weight_plateau: null,
  constipation: null,

  // --- Lối sống ---
  sleep_better: null,

  // --- Dịp đặc biệt ---
  tet_feast: null,
  holiday_with_fitandcare: null,
};

// Trả về Bitly URL nếu có, null nếu chưa cấu hình (caller tự fallback).
function getBitlyUrl(itemId) {
  return KNOWLEDGE_BITLY_LINKS[itemId] || null;
}

module.exports = { KNOWLEDGE_BITLY_LINKS, getBitlyUrl };
