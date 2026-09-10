#!/usr/bin/env node
// Regression test cho bug "ăn phở" KHÔNG match knowledge (eat_pho_ga thiếu keyword "pho" đứng
// một mình, chỉ có "pho ga"/"an pho ga" — xem bot/knowledge.js). Chạy: node scripts/test-knowledge-matching.js
// Không sửa dữ liệu, chỉ đọc và assert. exit code != 0 nếu có case fail.

const assert = require('assert');
const knowledge = require('../bot/knowledge');

let failed = 0;

function check(description, actualIds, expectedIds) {
  try {
    assert.deepStrictEqual(actualIds, expectedIds);
    console.log(`✅ ${description}`);
  } catch (err) {
    failed++;
    console.log(`❌ ${description}`);
    console.log(`   kỳ vọng: [${expectedIds.join(', ')}]`);
    console.log(`   thực tế: [${actualIds.join(', ')}]`);
  }
}

function idsFor(text) {
  return knowledge.findKnowledgeItems(text).map((i) => i.id);
}

// --- Single-match: "ăn phở" và các biến thể PHẢI match eat_pho_ga dù không nói "phở gà" ---
check('"ăn phở" -> eat_pho_ga', idsFor('ăn phở'), ['eat_pho_ga']);
check('"phở" -> eat_pho_ga', idsFor('phở'), ['eat_pho_ga']);
check('"phở gà" -> eat_pho_ga', idsFor('phở gà'), ['eat_pho_ga']);
check('"tối nay ăn phở" -> eat_pho_ga', idsFor('tối nay ăn phở'), ['eat_pho_ga']);
check('"em có được ăn phở không" -> eat_pho_ga', idsFor('em có được ăn phở không'), ['eat_pho_ga']);

// --- Multi-match vẫn phải giữ nguyên (2 item, sort theo score giảm dần rồi id tăng dần) ---
check(
  '"ăn phở và mất ngủ" -> 2 item (eat_pho_ga + sleep_better)',
  idsFor('ăn phở và mất ngủ'),
  ['sleep_better', 'eat_pho_ga'] // "mat ngu" (score 2) > "pho" (score 1)
);
check(
  '"ăn phở và chững cân" -> 2 item (eat_pho_ga + weight_plateau)',
  idsFor('ăn phở và chững cân'),
  ['weight_plateau', 'eat_pho_ga'] // "chung can" (score 2) > "pho" (score 1)
);

// --- Không match nhầm sang item khác chỉ vì chứa "pho" ở đâu đó không liên quan ---
check('"em bị táo bón" -> chỉ constipation, không lẫn phở', idsFor('em bị táo bón'), ['constipation']);

if (failed > 0) {
  console.log(`\n❌ ${failed} case FAIL.`);
  process.exitCode = 1;
} else {
  console.log('\n✅ Tất cả case regression "ăn phở" PASS.');
}
