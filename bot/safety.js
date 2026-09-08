// Safety module ĐỘC LẬP — routing priority 1 (URGENT) và 2 (MEDICAL/SPECIAL POPULATION
// ESCALATION), luôn được kiểm tra TRƯỚC menu/FAQ/knowledge (xem bot/handler.js,
// bot/demoPrivate.js). Bot KHÔNG chẩn đoán/kê thuốc/tự tạo phác đồ — chỉ nhận diện + chuyển
// người thật theo đúng nguyên tắc spec, KHÔNG tự bịa nội dung y khoa ngoài spec.

const { normalizeForMatch } = require('./textNormalize');
const style = require('./style');

// ─── URGENT_MEDICAL — dừng mọi tư vấn qua bot, khuyến nghị liên hệ y tế/cấp cứu ngay ─────────
const URGENT_KEYWORDS = [
  'dau nguc', 'tuc nguc',
  'kho tho bat thuong', 'kho tho',
  'ngat xiu', 'gan ngat', 'ngat',
  'chong mat nghiem trong', 'chong mat du doi',
  'tim dap bat thuong',
  'yeu liet', 'roi loan y thuc',
  'phan ung di ung nghiem trong', 'di ung nghiem trong',
  'dau du doi',
];

const URGENT_RESPONSE =
  'Nếu bạn đang tập, hãy dừng vận động. Với triệu chứng này, FIT AND CARE khuyến nghị bạn liên hệ ' +
  'cơ sở y tế/cấp cứu phù hợp để được đánh giá kịp thời, thay vì chờ tư vấn qua bot.';

// ─── ESCALATE_TO_HUMAN — theo category, có message riêng cho vài case (spec cho sẵn nội dung),
// còn lại dùng style.TRANSFER_TO_HUMAN chung (không tự bịa thêm nội dung ngoài spec). ─────────
const ESCALATION_KEYWORDS = {
  pregnancy: ['mang thai', 'co thai', 'dang bau'],
  postpartum: ['sau sinh'],
  breastfeeding: ['cho con bu', 'dang cho con bu'],
  child: ['tre em', 'tre nho', 'vi thanh nien'],
  medical_condition: ['benh ly nen', 'dang dieu tri', 'benh man tinh', 'co benh nen'],
  medication: ['dang uong thuoc', 'thuoc dieu tri', 'uong thuoc'],
  supplements: ['thuc pham chuc nang', 'uong supplement', 'bo sung supplement'],
  lab_result: ['xet nghiem', 'ket qua xet nghiem'],
  allergy: ['di ung', 'khong dung nap'],
  elderly: ['cao tuoi', 'nguoi gia'],
  eating_disorder: ['roi loan an uong'],
  extreme_weight_loss: ['giam can cuc doan', 'giam can that nhanh', 'giam can gap'],
  complaint: ['khieu nai', 'phan anh dich vu'],
  billing_dispute: ['tranh chap thanh toan', 'khieu nai thanh toan'],
  change_package: ['doi goi tap', 'thay doi goi', 'chuyen goi'],
  // Lưu ý: KHÔNG đặt 'hoan tien' ở đây — 'hoan tien' là FAQ program_refund (câu hỏi thông tin,
  // xem bot/faqData.js). cancel_request chỉ bắt đúng khi có Ý ĐỊNH huỷ thật ("muốn huỷ...").
  cancel_request: ['muon huy chuong trinh', 'huy chuong trinh', 'huy hop dong'],
};

// Regex bổ sung cho "child": bắt các câu kiểu "bé 5 tuổi", "con 5 tuổi" mà không cần liệt kê
// hết mọi độ tuổi trong danh sách keyword.
const CHILD_AGE_PATTERN = /\b(be|con)\b[^|]*\btuoi\b/;

function categoryReply(category) {
  switch (category) {
    case 'pregnancy':
      return (
        'Với phụ nữ đang mang thai, FIT AND CARE cần chuyên gia đánh giá trước để xác định cách ' +
        'đồng hành phù hợp và an toàn — chương trình không áp dụng hướng dẫn chung cho trường hợp ' +
        'này. ' + style.TRANSFER_TO_HUMAN
      );
    case 'postpartum':
      return (
        'Với phụ nữ sau sinh, FIT AND CARE cần chuyên gia đánh giá trước để xác định cách đồng ' +
        'hành phù hợp. ' + style.TRANSFER_TO_HUMAN
      );
    case 'breastfeeding':
      return (
        'Với phụ nữ đang cho con bú, FIT AND CARE cần chuyên gia đánh giá trước để xác định cách ' +
        'đồng hành phù hợp. ' + style.TRANSFER_TO_HUMAN
      );
    case 'child':
      return (
        'Trẻ từ khoảng 2 tuổi trở lên, đã ăn thô, có thể được xem xét tham gia FIT AND CARE. Tuy ' +
        'nhiên mọi trường hợp trẻ em đều cần coach/chuyên gia đánh giá trước khi xây dựng lộ trình ' +
        'phù hợp. ' + style.TRANSFER_TO_HUMAN
      );
    case 'medication':
      return (
        'Với câu hỏi liên quan đến thuốc, FIT AND CARE ưu tiên hướng dẫn của bác sĩ/người kê đơn ' +
        'hiện tại của bạn — mình không thể tư vấn thay đổi/ngừng/tăng giảm liều thuốc. ' +
        style.TRANSFER_TO_HUMAN
      );
    case 'supplements':
      return (
        'FIT AND CARE không tự tạo phác đồ hay tăng/giảm liều supplement qua bot. ' +
        style.TRANSFER_TO_HUMAN
      );
    case 'cancel_request':
      return style.PROGRAM_REFUND_POLICY + ' ' + style.TRANSFER_TO_HUMAN;
    default:
      return style.TRANSFER_TO_HUMAN;
  }
}

// Trả về { level: 'urgent' | 'escalate', category, message } hoặc null nếu không có gì bất
// thường — caller (handler.js/demoPrivate.js) chỉ cần: nếu khác null, gửi message rồi return.
function checkSafety(rawText) {
  const text = normalizeForMatch(rawText);

  for (const kw of URGENT_KEYWORDS) {
    if (text.includes(` ${kw} `)) {
      return { level: 'urgent', category: 'urgent_symptoms', message: URGENT_RESPONSE };
    }
  }

  for (const [category, keywords] of Object.entries(ESCALATION_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(` ${kw} `))) {
      return { level: 'escalate', category, message: categoryReply(category) };
    }
  }

  if (CHILD_AGE_PATTERN.test(text)) {
    return { level: 'escalate', category: 'child', message: categoryReply('child') };
  }

  return null;
}

module.exports = {
  checkSafety,
  URGENT_RESPONSE,
  URGENT_KEYWORDS,
  ESCALATION_KEYWORDS,
};
