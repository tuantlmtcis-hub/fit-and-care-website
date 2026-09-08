// Nội dung/câu chữ dùng chung (tone/style FIT AND CARE) — tách riêng để bot/faqData.js và
// bot/safety.js không lặp lại cùng 1 câu ở nhiều nơi. Nguyên văn theo spec, KHÔNG tự thêm nội
// dung ngoài spec.

// UNKNOWN fallback (routing priority 6 — hết safety/nav/FAQ/knowledge mà vẫn không khớp gì).
// Thay cho placeholder "đang trong giai đoạn phát triển" cũ (menu.PLACEHOLDER_REPLY) — 2026-09-08,
// đi kèm bot/unansweredQuestions.js ghi nhận câu hỏi để bổ sung knowledge base sau.
const NOT_ENOUGH_DATA =
  'Mình chưa có đủ thông tin để trả lời chính xác nội dung này. Mình đã ghi nhận câu hỏi của bạn ' +
  'để FIT AND CARE bổ sung nội dung phù hợp nhé. Nếu cần hỗ trợ ngay, mình có thể chuyển câu hỏi ' +
  'tới coach/chuyên gia FIT AND CARE.';

// Khi chuyển 1 case cần người thật xử lý (medical/special population/escalation nói chung).
const TRANSFER_TO_HUMAN =
  'Mình đã ghi nhận thông tin của bạn. Trường hợp này cần được coach/chuyên gia FIT AND CARE xem ' +
  'xét cụ thể để đảm bảo tư vấn phù hợp và an toàn. Mình sẽ chuyển nội dung của bạn tới đội ngũ ' +
  'phụ trách nhé.';

// Khi ghi nhận yêu cầu hỗ trợ từ coach (không phải case y tế/đặc biệt).
const COACH_ACK =
  'Mình đã ghi nhận nhu cầu của bạn. FIT AND CARE sẽ chuyển thông tin tới coach để hỗ trợ bạn cụ ' +
  'thể hơn nhé.';

// Disclaimer y khoa ngắn — kèm vào nội dung có liên quan sức khỏe/dinh dưỡng khi phù hợp.
const HEALTH_DISCLAIMER_SHORT =
  'Nội dung này chỉ mang tính hỗ trợ thông tin và không thay thế tư vấn y khoa. Với tình trạng ' +
  'sức khỏe cụ thể của bạn, FIT AND CARE khuyến nghị trao đổi trực tiếp với chuyên gia/bác sĩ phù ' +
  'hợp trước khi thay đổi chế độ hiện tại.';

// Disclaimer kết quả tham khảo — kèm vào mọi chỗ có nêu số kg/kết quả cụ thể.
const RESULT_DISCLAIMER =
  'Kết quả trên là mức tham khảo/trung bình, không phải cam kết bắt buộc. Kết quả thực tế phụ ' +
  'thuộc tình trạng ban đầu, cơ địa, sinh hoạt và mức độ tuân thủ của từng người.';

// Chính sách hoàn/đổi/hủy — dùng cả ở FAQ (program_refund) lẫn Safety (cancel_request).
const PROGRAM_REFUND_POLICY =
  'FIT AND CARE hiện không có chính sách hoàn/đổi/hủy chương trình. Bạn nên cân nhắc kỹ trước khi ' +
  'đăng ký.';

// Không cam kết kết quả cá nhân.
const NO_WEIGHT_GUARANTEE =
  'FIT AND CARE có mức kết quả tham khảo dựa trên quá trình đồng hành với khách hàng, tuy nhiên ' +
  'kết quả của mỗi người sẽ khác nhau. Chuyên gia sẽ đánh giá tình trạng và mục tiêu của bạn để tư ' +
  'vấn lộ trình phù hợp.';

module.exports = {
  NOT_ENOUGH_DATA,
  TRANSFER_TO_HUMAN,
  COACH_ACK,
  HEALTH_DISCLAIMER_SHORT,
  RESULT_DISCLAIMER,
  PROGRAM_REFUND_POLICY,
  NO_WEIGHT_GUARANTEE,
};
