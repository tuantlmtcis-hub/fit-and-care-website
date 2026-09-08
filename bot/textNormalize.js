// Chuẩn hoá tiếng Việt dùng chung cho bot/faqData.js + bot/safety.js — cùng kỹ thuật với
// bot/knowledge.js/bot/classify.js (không đụng 2 file đó, chỉ tách ra 1 bản dùng chung cho các
// module MỚI để không lặp lại code).

function stripDiacritics(str) {
  return String(str)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

// Chuỗi các "từ" cách nhau đúng 1 khoảng trắng, đệm khoảng trắng 2 đầu — so khớp theo ranh giới
// từ, tránh khớp nhầm xuyên từ.
function normalizeForMatch(rawText) {
  const ascii = stripDiacritics(rawText).toLowerCase();
  const words = ascii.replace(/[^a-z0-9\s]/g, ' ').trim().split(/\s+/).filter(Boolean);
  return ` ${words.join(' ')} `;
}

// Điểm của 1 keyword = số từ trong cụm — cụm càng dài/cụ thể thì điểm càng cao.
function keywordScore(kw) {
  return stripDiacritics(kw).toLowerCase().trim().split(/\s+/).filter(Boolean).length;
}

module.exports = { stripDiacritics, normalizeForMatch, keywordScore };
