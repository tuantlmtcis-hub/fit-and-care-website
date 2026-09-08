#!/usr/bin/env node
// In report câu hỏi bot chưa trả lời được, đọc từ DATA_DIR hiện tại (mặc định /data — set
// DATA_DIR=./data hoặc đường dẫn local khi chạy ngoài Fly). Chạy: npm run report-unanswered
//
// Không expose command này qua Zalo bot production (chưa có cơ chế xác định admin identity chắc
// chắn ở bot Zalo — xem báo cáo) — chỉ dùng qua script local này.

const unansweredQuestions = require('../bot/unansweredQuestions');

const args = process.argv.slice(2);
function getArg(name, fallback) {
  const prefix = `--${name}=`;
  const found = args.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const topN = Number(getArg('top', 20));
const since = getArg('since', undefined);
const status = getArg('status', 'OPEN');

console.log(`(đọc từ: ${unansweredQuestions.UNANSWERED_FILE})\n`);

const report = unansweredQuestions.getUnansweredReport({
  status: status === 'ALL' ? null : status,
  since,
  topN,
});

console.log(report.text);
