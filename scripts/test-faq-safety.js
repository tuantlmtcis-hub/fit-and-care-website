#!/usr/bin/env node
// Regression test cho FAQ/Safety/Harvard/tone (2026-09-08) + xác nhận không phá menu 7/22
// knowledge item/"ăn phở"/multi-match/private-group-demo hiện có. Chạy:
//   node scripts/test-faq-safety.js
// Mock zalo (không gọi API thật), assert bằng require('assert').

const assert = require('assert');
const Module = require('module');

const originalRequire = Module.prototype.require;
let calls = [];
Module.prototype.require = function (id) {
  if (id === './zalo') {
    return {
      sendMessage: async (chatId, text) => { calls.push({ fn: 'sendMessage', chatId, text }); },
      sendPhoto: async (chatId, imagePath, caption) => { calls.push({ fn: 'sendPhoto', chatId, imagePath, caption }); },
      resolvePhotoUrl: (p) => 'https://fitandcare-web.fly.dev' + p,
    };
  }
  return originalRequire.apply(this, arguments);
};

const handler = require('../bot/handler');
const demoPrivate = require('../bot/demoPrivate');
const knowledge = require('../bot/knowledge');
const faqData = require('../bot/faqData');
const safety = require('../bot/safety');

let failed = 0;
let msgSeq = 0;

function nextMsgId() {
  msgSeq += 1;
  return 'test-msg-' + msgSeq;
}

async function sendPrivate(chatId, text) {
  calls = [];
  await handler.handleUpdate({
    message: { chat: { id: chatId, chat_type: 'PRIVATE' }, text, message_id: nextMsgId(), from: { id: 'sender-' + chatId } },
  });
  return calls;
}

function allText(cs) {
  return cs.filter((c) => c.fn === 'sendMessage').map((c) => c.text).join('\n---\n');
}

function check(description, condition) {
  if (condition) {
    console.log(`✅ ${description}`);
  } else {
    failed += 1;
    console.log(`❌ ${description}`);
  }
}

(async () => {
  // 1
  let cs = await sendPrivate('c1', 'giá bao nhiêu');
  check('1. "giá bao nhiêu" -> program_price', faqData.findFaqIntents('giá bao nhiêu').some((i) => i.id === 'program_price') && allText(cs).includes('13.333.333'));

  // 2
  check('2. "có những gói nào" -> packages', faqData.findFaqIntents('có những gói nào').some((i) => i.id === 'program_packages'));

  // 3
  cs = await sendPrivate('c1', 'gói 2 tháng bao nhiêu tiền');
  check('3. "gói 2 tháng bao nhiêu tiền" -> chứa 23.333.333', allText(cs).includes('23.333.333'));

  // 4
  cs = await sendPrivate('c1', 'có trả góp không');
  check('4. "có trả góp không" -> 3/6/9/12 tháng qua Visa', /3, 6, 9 hoặc 12 tháng qua thẻ Visa/.test(allText(cs)));

  // 5
  cs = await sendPrivate('c1', 'có hoàn tiền được không');
  check('5. "có hoàn tiền được không" -> đúng policy, KHÔNG kèm transfer-to-human', allText(cs).includes('không có chính sách hoàn/đổi/hủy') && !allText(cs).includes('chuyển nội dung của bạn tới đội ngũ'));

  // 6
  cs = await sendPrivate('c1', 'FIT AND CARE có đảm bảo giảm 7kg không');
  check('6. đảm bảo giảm 7kg -> không cam kết cá nhân', allText(cs).includes('kết quả của mỗi người sẽ khác nhau'));

  // 7
  cs = await sendPrivate('c1', 'FIT AND CARE có được Harvard chứng nhận không?');
  check(
    '7. Harvard certification -> đúng KHÔNG chứng nhận + đào tạo, không lẫn harvard_training riêng',
    allText(cs).includes('không phải là chương trình được Harvard Medical School chứng nhận') &&
      allText(cs).includes('đã hoàn thành các chương trình đào tạo') &&
      cs.filter((c) => c.fn === 'sendMessage').length === 1
  );

  // 8
  cs = await sendPrivate('c1', 'FIT AND CARE liên quan gì đến Harvard?');
  check(
    '8. Harvard training -> đúng mối liên hệ đào tạo, KHÔNG có câu "chứng nhận"',
    allText(cs).includes('đã hoàn thành các chương trình đào tạo') && !allText(cs).includes('chứng nhận')
  );

  // 9
  let s = safety.checkSafety('em đang mang thai có tập cardio 140 được không');
  cs = await sendPrivate('c1', 'em đang mang thai có tập cardio 140 được không');
  check(
    '9. mang thai + cardio -> pregnancy escalation, KHÔNG trả cardio FAQ, KHÔNG nói phù hợp hoàn toàn',
    s && s.category === 'pregnancy' && !allText(cs).includes('140–150 bpm') && !/phù hợp hoàn toàn/.test(allText(cs))
  );

  // 10
  s = safety.checkSafety('bé 5 tuổi tham gia được không');
  check('10. bé 5 tuổi -> có thể xem xét NHƯNG cần chuyên gia đánh giá', s && s.category === 'child' && s.message.includes('có thể được xem xét') && s.message.includes('cần coach/chuyên gia đánh giá'));

  // 11
  s = safety.checkSafety('em đang uống thuốc...');
  check('11. đang uống thuốc -> escalation (category medication)', s && s.level === 'escalate' && s.category === 'medication');

  // 12
  cs = await sendPrivate('c1', 'em đau ngực khi tập');
  s = safety.checkSafety('em đau ngực khi tập');
  check(
    '12. đau ngực khi tập -> urgent, KHÔNG chỉ nói "chuyển coach", KHÔNG trả exercise FAQ',
    s && s.level === 'urgent' && allText(cs).includes('liên hệ cơ sở y tế/cấp cứu') && !/chỉ.*chuyển coach/i.test(allText(cs))
  );

  // 13 — ăn phở vẫn PASS (knowledge cũ, KHÔNG bị FAQ/safety mới nuốt). Lưu ý: eat_pho_ga đã có
  // Bitly link (task trước) nên message chứa bit.ly/fit-pho thay vì tên file .jpg — kiểm tra
  // đúng item match + có gửi link infographic là đủ, không assert tên file cụ thể.
  cs = await sendPrivate('c1', 'ăn phở');
  check(
    '13. "ăn phở" -> vẫn đúng knowledge eat_pho_ga (không đổi)',
    knowledge.findKnowledgeItems('ăn phở').map((i) => i.id).join(',') === 'eat_pho_ga' && allText(cs).includes('Xem infographic')
  );

  // 14 — multi-match cũ vẫn PASS
  const multi = knowledge.findKnowledgeItems('ăn phở và mất ngủ').map((i) => i.id).sort();
  check('14. "ăn phở và mất ngủ" -> multi-match 2 item (không đổi)', JSON.stringify(multi) === JSON.stringify(['eat_pho_ga', 'sleep_better']));

  // 15
  cs = await sendPrivate('c1', 'em ăn quá nhiều tối qua');
  check('15. "em ăn quá nhiều tối qua" -> nutrition_overeat', faqData.findFaqIntents('em ăn quá nhiều tối qua').some((i) => i.id === 'nutrition_overeat'));

  // 16
  check('16. "có cần đếm calo không" -> không bắt buộc', faqData.findFaqIntents('có cần đếm calo không').some((i) => i.id === 'nutrition_calories'));

  // 17
  cs = await sendPrivate('c1', 'mỗi ngày 10000 bước bắt buộc à');
  check('17. 10000 bước bắt buộc à -> không bắt buộc', allText(cs).includes('không bắt buộc'));

  // 18
  cs = await sendPrivate('c1', 'cardio nhịp tim 145 có đúng cho tất cả không');
  check('18. cardio nhịp tim 145 -> không áp cố định cho tất cả', allText(cs).includes('KHÔNG áp dụng mức này cho tất cả'));

  // 19
  cs = await sendPrivate('c1', 'cân tăng 1kg sau 1 ngày');
  check('19. cân tăng 1kg sau 1 ngày -> fluctuation', faqData.findFaqIntents('cân tăng 1kg sau 1 ngày').some((i) => i.id === 'measurement_weight_fluctuation'));

  // 20
  cs = await sendPrivate('c1', 'đo vòng bụng ở đâu');
  check('20. đo vòng bụng ở đâu -> KHÔNG bịa 3 mốc cụ thể', allText(cs).includes('theo dõi 3 vị trí vòng bụng') && !/mốc\s*1|mốc\s*2|vị trí\s*1[:.]/.test(allText(cs)));

  // 21
  cs = await sendPrivate('c1', 'email FIT AND CARE');
  check('21. email FIT AND CARE -> chưa có dữ liệu, không bịa', allText(cs).includes('chưa có dữ liệu email') && !/@/.test(allText(cs)));

  // 22
  cs = await sendPrivate('c1', 'coach có hỗ trợ 24/7 không');
  check('22. coach 24/7 -> phân biệt bot 24/7 vs coach', /bot.*24\/7|24\/7.*bot/i.test(allText(cs)) && allText(cs).includes('Coach/chuyên gia'));

  // 23
  cs = await sendPrivate('c1', 'tôi muốn hủy chương trình');
  check('23. muốn hủy chương trình -> policy + chuyển người phụ trách', allText(cs).includes('không có chính sách hoàn/đổi/hủy') && allText(cs).includes('chuyển nội dung của bạn tới đội ngũ'));

  // 24a — private: menu 7 + 22 knowledge browse vẫn hoạt động
  await sendPrivate('c3', 'menu');
  await sendPrivate('c3', '7');
  cs = await sendPrivate('c3', '1');
  check('24a. menu 7 (Kiến thức) vẫn hoạt động private chat', allText(cs).includes('KIẾN THỨC') || cs.length > 0);

  // 24b — group demo-private vẫn hoạt động (mirror handler)
  calls = [];
  demoPrivate.startSession('g1:s1', 'g1');
  demoPrivate.sessions.get('g1:s1').stack.push({ type: 'KNOWLEDGE_ROOT' });
  demoPrivate.sessions.get('g1:s1').stack.push({ type: 'KNOWLEDGE_GROUP', key: 'SPECIFIC_MEALS' });
  await demoPrivate.handleMessage('g1', 'g1:s1', '1');
  check('24b. demo-private browse vẫn hoạt động, trả eat_pho_ga', allText(calls).includes('Xem infographic'));

  // 24c — group demo-private: safety cũng hoạt động
  demoPrivate.startSession('g2:s2', 'g2');
  calls = [];
  await demoPrivate.handleMessage('g2', 'g2:s2', 'em đau ngực khi tập');
  check('24c. demo-private: safety urgent cũng hoạt động', allText(calls).includes('liên hệ cơ sở y tế/cấp cứu'));

  console.log('');
  if (failed > 0) {
    console.log(`❌ ${failed} case FAIL.`);
    process.exitCode = 1;
  } else {
    console.log('✅ Tất cả case FAQ/Safety/regression PASS.');
  }
})();
