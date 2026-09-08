// Phân loại câu hỏi tự do bằng keyword/rule đơn giản (MVP, chưa dùng AI/RAG).
// Ưu tiên MEDICAL_SAFETY lên đầu để luôn bắt được các câu hỏi có rủi ro sức khỏe trước.

function stripDiacritics(str) {
  return String(str)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

// Chuẩn hoá thành chuỗi các "từ" cách nhau đúng 1 khoảng trắng, có đệm khoảng trắng
// ở 2 đầu, để so khớp theo ranh giới từ (tránh khớp nhầm xuyên từ, vd "tuần tôi" -> "tuan toi"
// không được phép khớp nhầm với từ khoá "an toi").
function normalizeForMatch(rawText) {
  const ascii = stripDiacritics(rawText).toLowerCase();
  const words = ascii.replace(/[^a-z0-9\s]/g, ' ').trim().split(/\s+/).filter(Boolean);
  return ` ${words.join(' ')} `;
}

const RULES = [
  {
    category: 'MEDICAL_SAFETY',
    keywords: [
      'dau nguc', 'kho tho', 'chong mat', 'ngat xiu', 'ngat', 'tim dap nhanh',
      'huyet ap', 'tieu duong', 'mang thai', 'co thai', 'di ung', 'chan thuong',
      'gay xuong', 'phau thuat', 'tai bien', 'benh nen', 'cap cuu', 'sot cao',
      'non ra mau', 'tho gap', 'dot quy', 'ung thu', 'tim mach', 'benh tim',
    ],
  },
  {
    category: 'NUTRITION',
    keywords: [
      'an uong', 'dinh duong', 'thuc don', 'com', 'bun', 'pho', 'calo', 'protein',
      'uong nuoc', 'buffet', 'doi bung', 'an vat', 'che do an', 'thuc pham',
      'bua an', 'an kieng', 'an sang', 'an trua', 'an toi',
    ],
  },
  {
    category: 'EXERCISE',
    keywords: [
      'tap luyen', 'van dong', 'gym', 'cardio', 'chay bo', 'yoga', 'bai tap',
      'gian co', 'tap gym', 'tap the duc', 'plank', 'gap bung', 'tap the hinh', 'tap',
    ],
  },
  {
    category: 'MEASUREMENT',
    keywords: [
      'can nang', 'can do', 'can dien tu', 'vong eo', 'bmi', 'mo co the',
      'ket qua tap', 'theo doi can', 'giam can', 'tang can', 'so do',
    ],
  },
  {
    category: 'PROGRAM',
    keywords: [
      'chuong trinh', 'goi tap', 'goi dich vu', 'hoc phi', 'dang ky', 'lich trinh',
      'fit and care', 'uu dai', 'hoc vien', 'khoa hoc',
      // Thêm cho first-contact PRIVATE CHAT (vd "giá bao nhiêu", "chi phí thế nào",
      // "có những gói nào") — dùng cụm 2-3 từ, tránh từ đơn dễ trùng (vd "giá"/"già" bỏ dấu
      // đều thành "gia", "gói"/"gọi" đều thành "goi").
      'chi phi', 'gia bao nhieu', 'nhung goi',
    ],
  },
  {
    category: 'SUPPORT',
    keywords: [
      'coach', 'huan luyen vien', 'ho tro', 'tu van', 'lien he', 'doi coach', 'gap coach',
    ],
  },
];

// Đệm khoảng trắng quanh mỗi keyword để so khớp cũng theo ranh giới từ.
const COMPILED_RULES = RULES.map(rule => ({
  category: rule.category,
  keywords: rule.keywords.map(kw => ` ${kw} `),
}));

function classify(rawText) {
  const text = normalizeForMatch(rawText);
  for (const rule of COMPILED_RULES) {
    if (rule.keywords.some(kw => text.includes(kw))) return rule.category;
  }
  return 'UNKNOWN';
}

module.exports = { classify };
