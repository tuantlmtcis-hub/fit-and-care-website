#!/usr/bin/env node
// Regression test cho bot/unansweredQuestions.js (2026-09-08). Chạy:
//   DATA_DIR=/tmp/fitandcare-test-data node scripts/test-unanswered.js
// (DATA_DIR set qua env trước khi require bot/unansweredQuestions.js — bắt buộc, nếu không sẽ
// cố ghi vào /data thật.)

if (!process.env.DATA_DIR) {
  console.error('Cần set DATA_DIR trước khi chạy (vd DATA_DIR=/tmp/fitandcare-test-data). Dừng.');
  process.exit(1);
}

const fs = require('fs');
const assert = require('assert');
const Module = require('module');

// Xoá sạch store cũ (nếu có) để test độc lập, không lẫn dữ liệu chạy trước.
try { fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }); } catch (e) { /* noop */ }

const originalRequire = Module.prototype.require;
let calls = [];
Module.prototype.require = function (id) {
  if (id === './zalo') {
    return {
      sendMessage: async (chatId, text) => { calls.push({ fn: 'sendMessage', chatId, text }); },
      sendPhoto: async () => {},
      resolvePhotoUrl: (p) => 'https://fitandcare-web.fly.dev' + p,
    };
  }
  return originalRequire.apply(this, arguments);
};

const handler = require('../bot/handler');
const faqData = require('../bot/faqData');
const knowledge = require('../bot/knowledge');
const safety = require('../bot/safety');
let unansweredQuestions = require('../bot/unansweredQuestions');

let failed = 0;
let msgSeq = 0;

function check(description, condition) {
  if (condition) console.log(`✅ ${description}`);
  else { failed += 1; console.log(`❌ ${description}`); }
}

async function sendPrivate(chatId, text) {
  calls = [];
  msgSeq += 1;
  await handler.handleUpdate({
    message: { chat: { id: chatId, chat_type: 'PRIVATE' }, text, message_id: 'm' + msgSeq, from: { id: 'sender-' + chatId } },
  });
  return calls;
}

function countRecords() {
  return unansweredQuestions.loadStore().questions.length;
}

(async () => {
  // 1. Câu đã match FAQ -> không log
  await sendPrivate('u1', 'giá bao nhiêu');
  check('1. FAQ match ("giá bao nhiêu") -> KHÔNG log unanswered', countRecords() === 0);

  // 2. "ăn phở" -> knowledge match -> không log
  await sendPrivate('u1', 'ăn phở');
  check('2. Knowledge match ("ăn phở") -> KHÔNG log unanswered', countRecords() === 0);

  // 3. urgent medical -> safety -> không log
  await sendPrivate('u1', 'em đau ngực khi tập');
  check('3. Safety urgent -> KHÔNG log unanswered', countRecords() === 0);

  // 7a. menu -> không log
  await sendPrivate('u1', 'menu');
  check('7a. "menu" -> KHÔNG log unanswered', countRecords() === 0);

  // 7b. xin chào (user MỚI, first-contact) -> không log
  const cs7b = await sendPrivate('u-greet-1', 'xin chào');
  check('7b. "xin chào" (first contact) -> KHÔNG log unanswered', countRecords() === 0);

  // 7c. xin chào từ user ĐÃ có state (qua nhánh classify UNKNOWN, không phải first-contact
  // early-return) -> vẫn KHÔNG log nhờ isLoggable() chặn greeting tường minh.
  await sendPrivate('u-greet-2', '1'); // đơn giản: gõ số trước để có "trạng thái" khác 0 record baseline
  // (không quan trọng state hợp lệ hay không — chỉ cần userState.has(...) = true để rơi xuống
  // nhánh KHÔNG early-return; nếu "1" tự nó match gì đó cũng không ảnh hưởng vì ta chỉ đếm
  // record MỚI ở bước tiếp theo)
  const before7c = countRecords();
  await sendPrivate('u-greet-2', 'chào bạn');
  check('7c. "chào bạn" dù có state -> vẫn KHÔNG log (greeting filter)', countRecords() === before7c);

  // 4. Câu unknown thật -> log 1 record + fallback mới
  const UNKNOWN_Q = 'FIT AND CARE có hướng dẫn ăn khoai lang tím buổi tối không?';
  assert.strictEqual(faqData.findFaqIntents(UNKNOWN_Q).length, 0, 'câu test phải KHÔNG match FAQ nào (tiền đề test)');
  assert.strictEqual(knowledge.findKnowledgeItems(UNKNOWN_Q).length, 0, 'câu test phải KHÔNG match knowledge nào (tiền đề test)');
  assert.strictEqual(safety.checkSafety(UNKNOWN_Q), null, 'câu test phải KHÔNG match safety nào (tiền đề test)');
  const beforeUnknown = countRecords();
  let cs = await sendPrivate('u2', UNKNOWN_Q);
  check('4a. Câu unknown -> log đúng 1 record mới', countRecords() === beforeUnknown + 1);
  check('4b. Bot trả fallback mới (KHÔNG còn "đang phát triển")', cs.some((c) => c.text.includes('Mình đã ghi nhận câu hỏi của bạn')) && !cs.some((c) => c.text.includes('đang trong giai đoạn phát triển')));

  // 5. Gửi lại chính câu đó -> không tạo record mới, count = 2
  await sendPrivate('u2', UNKNOWN_Q);
  let store = unansweredQuestions.loadStore();
  let rec = store.questions.find((q) => q.normalizedText === unansweredQuestions.normalizeForDedup(UNKNOWN_Q));
  check('5. Gửi lại câu giống hệt -> không record mới, count = 2', countRecords() === beforeUnknown + 1 && rec && rec.count === 2);

  // 6. Khác hoa/thường/dấu câu -> vẫn dedup
  await sendPrivate('u3', 'fit and care CÓ hướng dẫn ăn khoai lang tím buổi tối không ??');
  store = unansweredQuestions.loadStore();
  rec = store.questions.find((q) => q.normalizedText === unansweredQuestions.normalizeForDedup(UNKNOWN_Q));
  check('6. Khác hoa/thường/dấu câu -> vẫn dedup, count = 3', countRecords() === beforeUnknown + 1 && rec && rec.count === 3);
  check('6b. chatTypes ghi nhận đúng, KHÔNG lưu user id/SĐT thật', JSON.stringify(rec).includes('PRIVATE') && !JSON.stringify(rec).includes('sender-'));

  // 8. Restart module / đọc lại store -> data vẫn đọc được
  delete require.cache[require.resolve('../bot/unansweredQuestions')];
  const reloaded = require('../bot/unansweredQuestions');
  const reloadedRec = reloaded.loadStore().questions.find((q) => q.normalizedText === unansweredQuestions.normalizeForDedup(UNKNOWN_Q));
  check('8. Restart module + đọc lại store -> data vẫn còn (count = 3)', reloadedRec && reloadedRec.count === 3);
  unansweredQuestions = reloaded;

  // Thêm 1 câu unknown khác, count thấp hơn, để test sort DESC
  const OTHER_Q = 'Có được uống cà phê sữa không?';
  assert.strictEqual(faqData.findFaqIntents(OTHER_Q).length, 0, 'câu test 2 phải KHÔNG match FAQ (tiền đề test)');
  await sendPrivate('u4', OTHER_Q);

  // 9. report -> sort count DESC
  const report = unansweredQuestions.getUnansweredReport({ topN: 20 });
  check('9a. Report sort theo count giảm dần', report.top[0].count >= report.top[1].count);
  check('9b. Report chứa đúng câu hỏi top 1 (count=3)', report.top[0].normalizedText === unansweredQuestions.normalizeForDedup(UNKNOWN_Q));
  check('9c. Report text đúng format (header + Tổng)', report.text.includes('📊 CÂU HỎI BOT CHƯA TRẢ LỜI ĐƯỢC') && report.text.includes('Tổng:') && report.text.includes('lượt unanswered') && report.text.includes('chủ đề unique'));
  check('9d. Report totals đúng (2 chủ đề, 3+1=4 lượt)', report.totalTopics === 2 && report.totalCount === 4);

  console.log('');
  if (failed > 0) {
    console.log(`❌ ${failed} case FAIL.`);
    process.exitCode = 1;
  } else {
    console.log('✅ Tất cả case unanswered-questions PASS.');
  }
})();
