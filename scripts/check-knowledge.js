#!/usr/bin/env node
// Kiểm tra tính nhất quán của bot/knowledge.js. Chạy: npm run check-knowledge
// Không sửa dữ liệu, chỉ đọc và báo lỗi. exit code != 0 nếu có lỗi (dùng được trong CI sau này).

const fs = require('fs');
const path = require('path');
const knowledge = require('../bot/knowledge');

const PROJECT_ROOT = path.join(__dirname, '..');
const errors = [];

function fail(message) {
  errors.push(message);
}

// 1. Đúng 22 item
if (knowledge.ITEMS.length !== 22) {
  fail(`Số lượng item = ${knowledge.ITEMS.length}, kỳ vọng 22`);
}

// 2. id không được trùng nhau
const idCounts = new Map();
knowledge.ITEMS.forEach((item) => idCounts.set(item.id, (idCounts.get(item.id) || 0) + 1));
idCounts.forEach((count, id) => {
  if (count > 1) fail(`id trùng lặp: "${id}" xuất hiện ${count} lần`);
});

const validCategoryKeys = new Set(knowledge.GROUPS.map((g) => g.key));

knowledge.ITEMS.forEach((item) => {
  // 3. category phải là 1 trong 6 nhóm hợp lệ
  if (!validCategoryKeys.has(item.category)) {
    fail(`[${item.id}] category không hợp lệ: "${item.category}"`);
  }
  // 4. title không rỗng
  if (!item.title || !item.title.trim()) {
    fail(`[${item.id}] thiếu title`);
  }
  // 5. mỗi item phải có ít nhất 1 keyword
  if (!Array.isArray(item.keywords) || item.keywords.length === 0) {
    fail(`[${item.id}] không có keyword nào`);
  }
  // 6. reply không rỗng
  if (!item.reply || !item.reply.trim()) {
    fail(`[${item.id}] thiếu reply`);
  }
  // 7. imagePath phải trỏ tới 1 file thật sự tồn tại trên đĩa
  if (!item.imagePath) {
    fail(`[${item.id}] thiếu imagePath`);
  } else {
    const filePath = path.join(PROJECT_ROOT, item.imagePath);
    if (!fs.existsSync(filePath)) {
      fail(`[${item.id}] file ảnh không tồn tại: ${item.imagePath}`);
    }
  }
});

// 8. Mỗi nhóm trong GROUPS phải có ít nhất 1 item (tránh nhóm rỗng khi duyệt cây)
knowledge.GROUPS.forEach((g) => {
  const count = knowledge.ITEMS.filter((i) => i.category === g.key).length;
  if (count === 0) fail(`Nhóm "${g.key}" (${g.title}) không có item nào`);
});

// 9. Collision nghiêm trọng: keyword của 1 item phải luôn khớp về đúng item đó khi tra cứu,
// không bị 1 item khác (đứng trước trong mảng, hoặc keyword rộng hơn) "cướp" mất.
knowledge.ITEMS.forEach((item) => {
  item.keywords.forEach((kw) => {
    const found = knowledge.findByKeyword(kw);
    if (!found || found.id !== item.id) {
      fail(`[${item.id}] keyword "${kw}" bị khớp nhầm sang "${found ? found.id : '(không match)'}"`);
    }
  });
});

console.log(`Tổng số item: ${knowledge.ITEMS.length}`);
console.log(`Tổng số nhóm: ${knowledge.GROUPS.length}`);
knowledge.GROUPS.forEach((g) => {
  console.log(`  - ${g.emoji} ${g.title}: ${knowledge.itemsInGroup(g.key).length} bài`);
});

if (errors.length) {
  console.log(`\n❌ ${errors.length} lỗi:`);
  errors.forEach((e) => console.log('  -', e));
  process.exitCode = 1;
} else {
  console.log(`\n✅ Tất cả ${knowledge.ITEMS.length} item PASS toàn bộ kiểm tra.`);
}
