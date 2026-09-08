// Nội dung menu + câu trả lời placeholder cho Zalo Bot FIT AND CARE (MVP, chưa có AI/RAG).

const PLACEHOLDER_REPLY =
  '🤖 FIT AND CARE Assistant\n\n' +
  'Cảm ơn bạn đã gửi câu hỏi.\n\n' +
  'Nội dung này hiện đang trong giai đoạn phát triển và hoàn thiện.\n' +
  'FIT AND CARE sẽ sớm cập nhật hướng dẫn chi tiết.';

const SAFETY_REPLY =
  '🤖 FIT AND CARE Assistant\n\n' +
  'Đây là câu hỏi liên quan đến sức khỏe/y tế nên mình chưa thể tự đưa ra lời khuyên.\n\n' +
  'Bạn vui lòng liên hệ trực tiếp Coach của FIT AND CARE hoặc bác sĩ/chuyên gia y tế để được tư vấn an toàn nhé.';

const CATEGORIES = [
  {
    key: 'NUTRITION',
    emoji: '🍽️',
    title: 'Ăn uống & dinh dưỡng',
    questions: [
      'Tôi có được ăn cơm/bún/phở không?',
      'Buổi tối đói thì làm gì?',
      'Đi ăn buffet/lẩu thì ăn thế nào?',
      'Tôi nên uống bao nhiêu nước?',
      'Tôi lỡ ăn sai chế độ thì làm gì?',
    ],
  },
  {
    key: 'EXERCISE',
    emoji: '🏃',
    title: 'Vận động & tập luyện',
    questions: [
      'Mỗi tuần tôi nên tập bao nhiêu buổi?',
      'Không có thời gian đến phòng gym thì tập ở đâu?',
      'Tập bao lâu thì thấy kết quả?',
      'Tôi mới bắt đầu thì nên tập bài gì?',
      'Bị đau cơ sau khi tập có nên tập tiếp không?',
    ],
  },
  {
    key: 'MEASUREMENT',
    emoji: '⚖️',
    title: 'Cân đo & theo dõi kết quả',
    questions: [
      'Bao lâu tôi nên cân đo 1 lần?',
      'Cân không giảm dù đã cố gắng thì phải làm sao?',
      'Nên đo vào thời điểm nào trong ngày?',
      'Ngoài cân nặng còn nên theo dõi chỉ số nào?',
      'Kết quả đo dao động nhiều có bình thường không?',
    ],
  },
  {
    key: 'PROGRAM',
    emoji: '📋',
    title: 'Chương trình FIT AND CARE',
    questions: [
      'FIT AND CARE hiện có những gói nào?',
      'Chương trình kéo dài bao lâu?',
      'Chi phí tham gia chương trình là bao nhiêu?',
      'Đăng ký chương trình như thế nào?',
      'Chương trình có phù hợp với người mới bắt đầu không?',
    ],
  },
  {
    key: 'SUPPORT',
    emoji: '👩‍💼',
    title: 'Coach & hỗ trợ',
    questions: [
      'Làm sao để liên hệ Coach của tôi?',
      'Tôi muốn đổi Coach thì làm thế nào?',
      'Coach có hỗ trợ ngoài giờ hành chính không?',
      'Tôi cần hỗ trợ gấp thì liên hệ ở đâu?',
    ],
  },
  {
    key: 'OTHER',
    emoji: '💬',
    title: 'Câu hỏi khác',
    questions: [
      'Tôi muốn góp ý về dịch vụ.',
      'Tôi gặp lỗi khi dùng website/ứng dụng.',
      'Tôi muốn biết thêm thông tin về FIT AND CARE.',
      'Câu hỏi của tôi không nằm trong các mục trên.',
    ],
  },
];

function buildMainMenuText() {
  const lines = CATEGORIES.map((c, i) => `${i + 1}. ${c.emoji} ${c.title}`);
  // Mục cuối "7. 📚 KIẾN THỨC..." trỏ vào bot/knowledge.js (xử lý ở handler.js/demoPrivate.js),
  // đặt cố định ngay sau danh mục FAQ nên không cần import knowledge.js vào file này.
  lines.push(`${CATEGORIES.length + 1}. 📚 KIẾN THỨC FIT AND CARE`);
  return (
    '👋 Xin chào! Mình là trợ lý FIT AND CARE.\n\n' +
    'Bạn có thể gõ số để chọn 1 danh mục bên dưới, hoặc gõ trực tiếp câu hỏi của bạn:\n\n' +
    lines.join('\n') +
    '\n\nGõ "menu" bất cứ lúc nào để quay lại danh mục này.'
  );
}

function buildCategoryText(category) {
  const lines = category.questions.map((q, i) => `${i + 1}. ${q}`);
  return (
    `${category.emoji} ${category.title}\n\n` +
    'Một vài câu hỏi thường gặp (gõ số để xem câu trả lời, hoặc gõ câu hỏi khác của bạn):\n\n' +
    lines.join('\n') +
    '\n\n0. Quay lại\nmenu. Menu chính'
  );
}

module.exports = {
  CATEGORIES,
  PLACEHOLDER_REPLY,
  SAFETY_REPLY,
  buildMainMenuText,
  buildCategoryText,
};
