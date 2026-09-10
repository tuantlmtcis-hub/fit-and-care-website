// Xử lý riêng cho GROUP CHAT (tính năng Beta của Zalo Bot Platform).
//
// GHI CHÚ QUAN TRỌNG VỀ NGUỒN DỮ LIỆU:
// Theo tài liệu chính thức (docs.zaloplatforms.com/docs/BOT/webhook), Message object chỉ có
// các trường: from, chat, text, photo, caption, sticker, url, voice_url — KHÔNG có trường
// mentions/entities nào được công bố. Hướng dẫn nhóm chat
// (docs.zaloplatforms.com/docs/BOT/best-practices/build-bot-interaction-with-group) chỉ mô tả
// hành vi: "Bot sẽ nhận được sự kiện khi người dùng gõ @ và chọn tên của Bot trong tin nhắn".
// Vì tài liệu không đặc tả cấu trúc mention, cách suy luận hợp lý duy nhất là so khớp
// "@<display_name của Bot>" (lấy từ API getMe(), không hardcode) trong nội dung text.
// Nếu sau này Zalo công bố thêm trường mention/entity chính thức, chỉ cần sửa detectMention().

const zalo = require('./zalo');

let botIdentityPromise = null;
function getBotIdentity() {
  if (!botIdentityPromise) {
    botIdentityPromise = zalo.getMe().then((res) => {
      if (res && res.ok && res.result) return res.result; // { id, display_name, ... }
      botIdentityPromise = null; // cho phép thử lại lần gọi sau nếu thất bại
      return null;
    }).catch(() => {
      botIdentityPromise = null;
      return null;
    });
  }
  return botIdentityPromise;
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Trả về { mentioned, strippedText }. Nếu không xác định được tên Bot (vd getMe() lỗi),
// coi như KHÔNG mention -> giữ đúng quy tắc "mặc định im lặng" trong group.
function detectMention(rawText, botIdentity) {
  const text = String(rawText || '');
  if (!botIdentity || !botIdentity.display_name) {
    return { mentioned: false, strippedText: text.trim() };
  }

  const mentionPattern = new RegExp(`@\\s*${escapeRegExp(botIdentity.display_name)}`, 'i');
  if (!mentionPattern.test(text)) {
    return { mentioned: false, strippedText: text.trim() };
  }

  const strippedText = text.replace(mentionPattern, '').replace(/\s+/g, ' ').trim();
  return { mentioned: true, strippedText };
}

const SHORT_QUESTION_MAX_LENGTH = 60;
function isShortQuestion(text) {
  return String(text || '').length <= SHORT_QUESTION_MAX_LENGTH;
}

const GROUP_SHORT_REPLY =
  '🤖 FIT AND CARE Assistant\n\n' +
  'Cảm ơn bạn đã hỏi! Nội dung này đang được hoàn thiện, FIT AND CARE sẽ cập nhật sớm nhé.';

const GROUP_REDIRECT_TO_DM_REPLY =
  '🤖 FIT AND CARE Assistant\n\n' +
  'Câu hỏi này khá chi tiết/cá nhân, bạn nhắn riêng (chat 1-1) cho mình để được hỗ trợ kỹ hơn nhé!';

const GROUP_SAFETY_REPLY =
  '🤖 FIT AND CARE Assistant\n\n' +
  'Câu hỏi này liên quan đến sức khỏe/y tế nên mình không tư vấn ở đây. ' +
  'Bạn vui lòng liên hệ Coach của FIT AND CARE hoặc bác sĩ/chuyên gia phù hợp nhé.';

module.exports = {
  getBotIdentity,
  detectMention,
  isShortQuestion,
  GROUP_SHORT_REPLY,
  GROUP_REDIRECT_TO_DM_REPLY,
  GROUP_SAFETY_REPLY,
};
