// FAQ chương trình/nghiệp vụ/kiến thức dinh dưỡng-vận động-cân đo FIT AND CARE — nội dung nghiệp
// vụ tách riêng khỏi handler (routing priority 4, xem bot/handler.js + bot/demoPrivate.js).
// KHÔNG dùng sendPhoto (chỉ sendMessage). KHÔNG tự thêm dữ liệu ngoài spec — nơi thiếu dữ liệu
// dùng đúng style.NOT_ENOUGH_DATA.
//
// Cùng kỹ thuật multi-match/scoring với bot/knowledge.js (longest-keyword-wins, quét toàn bộ,
// sort theo score giảm dần rồi id tăng dần) — xem findFaqIntents().

const { normalizeForMatch, keywordScore } = require('./textNormalize');
const style = require('./style');

function buildPackageReply({ label, price, resultRange, suitableFor }) {
  return (
    `📦 Gói ${label}\n` +
    `- Giá: ${price}\n` +
    `- Kết quả tham khảo: ${resultRange}\n` +
    `- Phù hợp: ${suitableFor}\n\n` +
    style.RESULT_DISCLAIMER
  );
}

const FAQ_ITEMS = [
  // --- Chương trình ---
  {
    id: 'program_overview',
    keywords: ['fit and care la gi', 'gioi thieu fit and care', 'chuong trinh fit and care la gi', 'fit and care hoat dong nhu the nao'],
    reply:
      'FIT AND CARE là chương trình quản lý cân nặng, dinh dưỡng, vận động và xây dựng lối sống ' +
      'lành mạnh theo hướng cá nhân hóa — không chỉ đơn thuần là giảm cân. Đội ngũ coach và chuyên ' +
      'gia được đào tạo về dinh dưỡng tại các trường đại học Y ở Việt Nam, đồng thời có nền tảng ' +
      'đào tạo về sức khỏe, wellness và coaching từ Harvard Medical School.\n\n' +
      'Chương trình đồng hành, theo dõi tiến trình qua từng bữa ăn hằng ngày của bạn — kể cả khi ' +
      'đi du lịch, dự tiệc hay ăn ngoài — không áp dụng thực đơn cứng nhắc, không bắt tính calo và ' +
      'không sử dụng thực phẩm chức năng.',
  },
  {
    id: 'program_price',
    keywords: ['gia bao nhieu', 'bao nhieu tien', 'chi phi'],
    reply:
      'FIT AND CARE hiện có 3 mức giá theo gói chương trình: 1 tháng (13.333.333đ), 2 tháng ' +
      '(23.333.333đ), 3 tháng (33.333.333đ). Bạn muốn tìm hiểu gói nào để mình gửi thêm chi tiết nhé?',
  },
  {
    id: 'program_packages',
    keywords: ['co may goi', 'nhung goi nao', 'co nhung goi nao'],
    reply:
      'FIT AND CARE hiện có 3 gói chương trình: 1 tháng, 2 tháng và 3 tháng. Gói phù hợp sẽ phụ ' +
      'thuộc vào mục tiêu và tình trạng ban đầu của bạn — bạn hỏi cụ thể 1 gói để mình gửi chi ' +
      'tiết (giá + kết quả tham khảo) nhé.',
  },
  {
    id: 'program_package_1m',
    keywords: ['goi 1 thang'],
    reply: buildPackageReply({
      label: '1 tháng',
      price: '13.333.333 VND',
      resultRange: 'khoảng 3–4 kg',
      suitableFor: 'người cần khởi động, điều chỉnh thói quen và giảm cân ở mức vừa phải',
    }),
  },
  {
    id: 'program_package_2m',
    keywords: ['goi 2 thang'],
    reply: buildPackageReply({
      label: '2 tháng',
      price: '23.333.333 VND',
      resultRange: 'khoảng 4–7 kg',
      suitableFor: 'người cần thêm thời gian để thay đổi thói quen và kiểm soát cân nặng',
    }),
  },
  {
    id: 'program_package_3m',
    keywords: ['goi 3 thang'],
    reply: buildPackageReply({
      label: '3 tháng',
      price: '33.333.333 VND',
      resultRange: 'khoảng 7–10 kg',
      suitableFor: 'người có mục tiêu giảm cân lớn hơn hoặc muốn có thời gian dài hơn để xây dựng thói quen bền vững',
    }),
  },
  {
    id: 'program_duration',
    keywords: ['thoi gian chuong trinh', 'chuong trinh keo dai bao lau', 'co nhung thoi gian nao'],
    reply:
      'Hiện FIT AND CARE có các gói chương trình 1 tháng, 2 tháng và 3 tháng. Gói phù hợp sẽ được ' +
      'lựa chọn dựa trên mục tiêu và tình trạng ban đầu của bạn.',
  },
  {
    id: 'program_support',
    keywords: ['ho tro nhu the nao', 'chuong trinh ho tro gi', 'duoc ho tro gi'],
    reply:
      'FIT AND CARE đồng hành cùng bạn qua: coach/chuyên gia theo dõi sát, theo dõi hình ảnh bữa ' +
      'ăn, hướng dẫn dinh dưỡng và vận động, theo dõi cân/chỉ số/số đo (cân sinh học/app theo ' +
      'chính sách chương trình), nhóm đồng hành, và chia sẻ kiến thức qua Zoom.',
  },
  {
    id: 'program_registration',
    keywords: ['dang ky nhu the nao', 'lam sao de dang ky', 'dang ky tham gia'],
    reply:
      'Quy trình tham gia: liên hệ → tư vấn nhu cầu → đánh giá tình trạng/mục tiêu → đề xuất gói → ' +
      'thanh toán → onboarding → cập nhật chỉ số ban đầu → hướng dẫn công cụ/nhóm → bắt đầu chương ' +
      'trình. Nếu bạn có bệnh lý/tình trạng đặc biệt, cần cung cấp thông tin/xét nghiệm liên quan ' +
      'và được chuyên gia đánh giá trước khi bắt đầu.\n\n' +
      'Bạn liên hệ qua Zalo/SĐT: 0393272286 hoặc Fanpage FIT AND CARE – Học ăn thông minh để bắt ' +
      'đầu nhé.',
  },
  {
    id: 'program_payment',
    keywords: ['thanh toan nhu the nao', 'hinh thuc thanh toan', 'thanh toan qua the'],
    reply: 'FIT AND CARE có chính sách trả góp 3, 6, 9 hoặc 12 tháng cho tất cả các gói dịch vụ.',
  },
  {
    id: 'program_installment',
    keywords: ['tra gop', 'co tra gop khong'],
    reply: 'Có, FIT AND CARE hỗ trợ trả góp 3, 6, 9 hoặc 12 tháng cho tất cả các gói dịch vụ nhé.',
  },
  {
    id: 'program_refund',
    keywords: ['hoan tien', 'chinh sach hoan tien', 'doi tra'],
    reply: style.PROGRAM_REFUND_POLICY,
  },
  {
    id: 'program_weight_guarantee',
    keywords: ['dam bao giam', 'cam ket giam', 'chac chan giam'],
    reply: style.NO_WEIGHT_GUARANTEE,
  },
  {
    id: 'program_travel',
    keywords: ['di cong tac', 'di du lich', 'hay di cong tac', 'thuong xuyen di cong tac'],
    reply:
      'Có, đây là điểm mạnh của chương trình. Coach sẽ cá nhân hóa theo lịch trình thực tế của ' +
      'bạn, kể cả khi ăn ngoài, đi tiệc hay di chuyển liên tục — không áp dụng một thực đơn cứng ' +
      'nhắc.',
  },
  {
    id: 'coach_online_followup',
    keywords: ['chi nhan file thuc don', 'dong hanh online nhu the nao', 'chi nhan thuc don thoi'],
    reply:
      'Không chỉ là thực đơn. Bạn sẽ có coach theo sát, phản hồi bữa ăn thực tế hằng ngày qua ' +
      'hình ảnh và điều chỉnh liên tục theo tiến trình — không phải một tài liệu tĩnh gửi một ' +
      'lần. Bạn vẫn ăn uống linh hoạt theo thực đơn của cá nhân và gia đình.',
  },
  {
    id: 'founder_involvement',
    keywords: ['co phai founder khong', 'founder co truc tiep dong hanh khong', 'ai truc tiep dong hanh toi'],
    reply:
      'Founder trực tiếp xây dựng phương pháp và đào tạo đội ngũ coach FIT AND CARE; đội coach ' +
      'được đào tạo theo cùng phương pháp để đảm bảo chất lượng đồng hành đồng nhất, nhưng không ' +
      'phải lúc nào cũng làm việc trực tiếp 1-1 với founder.',
  },
  {
    id: 'compare_meal_plan',
    keywords: ['khac gi meal plan', 'khac gi thuc don dong goi', 'khac gi eat clean'],
    reply:
      'Thực đơn đóng gói giải quyết bữa ăn hôm nay, còn FIT AND CARE giúp bạn tự xây được thói ' +
      'quen ăn đúng lâu dài, kể cả khi không còn nhận thực đơn nữa.',
  },
  {
    id: 'compare_pt_community',
    keywords: ['khac gi pt gym', 'khac gi cong dong giam can mien phi', 'khac gi hoi nhom giam can'],
    reply:
      'Thông tin miễn phí trên mạng thường chung chung, không chắc phù hợp với cơ địa và lối sống ' +
      'riêng của bạn. FIT AND CARE cá nhân hóa theo đúng thói quen, công việc và sức khỏe thật ' +
      'của từng người, có coach đồng hành theo sát chứ không phải tự mày mò.',
  },
  {
    id: 'after_program_support',
    keywords: ['sau khi het goi', 'ket thuc goi roi co ho tro khong', 'het goi roi co con nhom khong'],
    reply:
      'Có. Sau khi kết thúc gói, nhóm đồng hành cùng bạn vẫn duy trì — bạn có thể nhắn vào nhóm ' +
      'khi cần, đội ngũ coach và chuyên gia sẽ hỗ trợ.',
  },

  // --- Harvard (xem quy tắc claim ở categoryReply/exclusivity trong findFaqIntents) ---
  {
    id: 'harvard_training',
    keywords: ['harvard', 'harvard medical school', 'lien quan gi den harvard'],
    reply:
      'Đội ngũ coach và chuyên gia của FIT AND CARE được đào tạo về dinh dưỡng tại các trường đại ' +
      'học Y ở Việt Nam, đồng thời có nền tảng đào tạo về sức khỏe, wellness và coaching từ ' +
      'Harvard Medical School. Kiến thức và phương pháp từ quá trình đào tạo này được áp dụng khi ' +
      'xây dựng nội dung và cách đồng hành trong FIT AND CARE.',
  },
  {
    id: 'harvard_certification',
    keywords: ['chung chi harvard', 'chung nhan harvard', 'duoc harvard chung nhan khong', 'tieu chuan harvard'],
    reply:
      'FIT AND CARE không phải là chương trình được Harvard Medical School chứng nhận hay bảo ' +
      'trợ. Đội ngũ coach và chuyên gia của FIT AND CARE được đào tạo về dinh dưỡng tại các ' +
      'trường đại học Y ở Việt Nam, đồng thời có nền tảng đào tạo về sức khỏe, wellness và ' +
      'coaching từ Harvard Medical School, và áp dụng những kiến thức, phương pháp phù hợp khi ' +
      'xây dựng chương trình.',
  },

  // --- Liên hệ ---
  {
    id: 'contact_phone',
    keywords: ['so dien thoai', 'sdt fit and care', 'goi dien cho fit and care'],
    reply: 'Bạn có thể liên hệ FIT AND CARE qua số điện thoại/Zalo: 0393272286.',
  },
  {
    id: 'contact_zalo',
    keywords: ['lien he qua zalo', 'zalo fit and care', 'so zalo'],
    reply: 'Bạn có thể liên hệ FIT AND CARE qua Zalo/SĐT: 0393272286.',
  },
  {
    id: 'contact_fanpage',
    keywords: ['fanpage fit and care', 'fanpage'],
    reply: 'Fanpage chính thức của FIT AND CARE: "FIT AND CARE – Học ăn thông minh".',
  },
  {
    id: 'contact_website',
    keywords: ['website fit and care', 'trang web fit and care'],
    reply: 'Website FIT AND CARE: fitandcare.vn',
  },
  {
    id: 'contact_email',
    keywords: ['email fit and care', 'dia chi email fit and care'],
    reply:
      'FIT AND CARE hiện chưa có dữ liệu email công khai. Bạn có thể liên hệ qua Zalo/SĐT ' +
      '0393272286 hoặc Fanpage "FIT AND CARE – Học ăn thông minh" nhé.',
  },

  // --- Coach & hỗ trợ ---
  {
    id: 'support_coach',
    keywords: ['can coach ho tro', 'ho tro tu coach', 'lien he coach'],
    reply: style.COACH_ACK,
  },
  {
    id: 'support_expert',
    keywords: ['lien he chuyen gia', 'gap chuyen gia', 'tu van chuyen gia'],
    reply:
      'Bạn có thể liên hệ chuyên gia FIT AND CARE qua Zalo/Fanpage chính thức (Zalo/SĐT: ' +
      '0393272286). Mình cũng có thể tiếp nhận thông tin và chuyển chuyên gia hỗ trợ bạn.',
  },
  {
    id: 'support_technical',
    keywords: ['loi ung dung', 'app bi loi', 'loi ky thuat', 'khong dang nhap duoc'],
    reply:
      'Bạn mô tả cụ thể lỗi đang gặp (và gửi ảnh chụp màn hình nếu có) để mình ghi nhận và chuyển ' +
      'đội kỹ thuật FIT AND CARE hỗ trợ nhé. Zalo/SĐT: 0393272286.',
  },
  {
    id: 'support_time',
    keywords: ['coach co ho tro 24 7 khong', 'phan hoi trong bao lau', 'bao gio coach tra loi'],
    reply:
      'Mình (bot) có thể tiếp nhận câu hỏi của bạn 24/7. Coach/chuyên gia FIT AND CARE sẽ phản hồi ' +
      'trong thời gian hỗ trợ phù hợp — mình không thể cam kết một mốc thời gian cụ thể, bạn cứ để ' +
      'lại nội dung, mình sẽ chuyển ngay nhé.',
  },

  // --- Dinh dưỡng ---
  {
    id: 'nutrition_carbs',
    keywords: ['an com duoc khong', 'an tinh bot duoc khong', 'co duoc an com khong', 'cat tinh bot'],
    reply:
      'Cơm, bún, phở, bánh mì vẫn ăn được bình thường nhé, mình không cắt hoàn toàn tinh bột. ' +
      'Quan trọng là kiểm soát khẩu phần, ăn cùng rau và đạm, hạn chế dầu mỡ/sốt béo/đường/topping ' +
      'nhiều năng lượng. Không có một khẩu phần cố định áp dụng cho tất cả — coach sẽ điều chỉnh ' +
      'theo tình trạng của bạn.',
  },
  {
    id: 'nutrition_evening_hunger',
    keywords: ['doi bung buoi toi', 'them an dem', 'doi vao ban dem'],
    reply:
      'Bạn thử phân biệt đói thật hay chỉ thèm ăn nhé: có thể uống nước, chờ một chút rồi đánh giá ' +
      'lại. Nếu đói thật, ăn một phần nhỏ thực phẩm phù hợp theo hướng dẫn của coach, hạn chế đồ ' +
      'ngọt/chiên/snack/trà sữa. Nếu đói tối diễn ra thường xuyên, báo cho coach để được điều ' +
      'chỉnh nhé.',
  },
  {
    id: 'nutrition_buffet',
    keywords: ['di an buffet', 'an lau', 'an buffet'],
    reply:
      'Trước khi ăn buffet/lẩu, bạn không cần nhịn cả ngày để dành bụng. Gợi ý thứ tự: rau → đạm → ' +
      'tinh bột, ưu tiên thịt nạc/cá/hải sản/trứng/đậu phụ, hạn chế đồ chiên/viên chế biến/sốt ' +
      'ngọt béo, ăn chậm. Bữa sau đó quay lại chế độ ăn bình thường là được 👍',
  },
  {
    id: 'nutrition_water',
    keywords: ['uong bao nhieu nuoc', 'uong nuoc nhu the nao'],
    reply:
      'Bạn nên uống đủ nước, chia đều trong ngày — không có một công thức cố định áp dụng cho tất ' +
      'cả. Nếu bạn cần hạn chế lượng dịch theo chỉ định của bác sĩ, hãy tuân theo hướng dẫn y tế ' +
      'đó trước nhé.',
  },
  {
    id: 'nutrition_overeat',
    keywords: ['an qua nhieu', 'an qua nhieu toi qua', 'an bu'],
    reply:
      'Không sao đâu, bạn đừng nhịn bữa sau hay tập quá sức để bù nhé — cũng không cần tự trách ' +
      'mình. Quay lại kế hoạch bình thường từ bữa tiếp theo là được. Bạn có thể gửi ảnh bữa ăn cho ' +
      'coach nếu cần hỗ trợ thêm 🙂',
  },
  {
    id: 'nutrition_calories',
    keywords: ['co can dem calo khong', 'dem calo'],
    reply:
      'Bạn không bắt buộc phải đếm calorie mỗi ngày. FIT AND CARE không tự đặt mức calorie cố ' +
      'định cho tất cả mọi người — coach sẽ hướng dẫn phù hợp theo tình trạng của bạn.',
  },
  {
    id: 'nutrition_weigh_food',
    keywords: ['can do an', 'can tung gram'],
    reply:
      'Bạn không bắt buộc phải cân từng gram thức ăn. Trong một số giai đoạn cụ thể, coach có thể ' +
      'yêu cầu cân đo để theo dõi chính xác hơn, nhưng đây không phải yêu cầu áp dụng mọi lúc.',
  },

  // --- Vận động ---
  {
    id: 'exercise_gym',
    keywords: ['co bat buoc tap gym khong', 'phai di gym khong'],
    reply:
      'Bạn không bắt buộc phải tập gym. FIT AND CARE có nhiều cách vận động phù hợp với sinh hoạt ' +
      'của bạn, coach sẽ gợi ý hình thức phù hợp nhất.',
  },
  {
    id: 'exercise_duration',
    keywords: ['van dong bao lau moi ngay', 'tap bao nhieu phut'],
    reply:
      'Khoảng 30 phút vận động mỗi ngày là mốc tham khảo, bạn có thể chia nhỏ thời gian và kết ' +
      'hợp đi bộ hoặc vận động ngay trong sinh hoạt hằng ngày.',
  },
  {
    id: 'exercise_steps',
    keywords: ['10000 buoc', 'so buoc chan moi ngay', 'di bo bao nhieu buoc'],
    reply:
      'Khoảng 10.000 bước/ngày là mốc tham khảo khi phù hợp, nhưng không bắt buộc với tất cả mọi ' +
      'người. Nếu bạn ít vận động, hãy tăng dần số bước theo thời gian nhé.',
  },
  {
    id: 'exercise_cardio',
    keywords: ['nhip tim cardio', 'nhip tim bao nhieu la dung', 'cardio nhip tim'],
    reply:
      'Khoảng 30 phút/buổi cardio là mốc tham khảo. FIT AND CARE từng dùng vùng nhịp tim 140–150 ' +
      'bpm cho người phù hợp, nhưng KHÔNG áp dụng mức này cho tất cả mọi người — người mới tập, ' +
      'lớn tuổi hoặc có bệnh lý cần được chuyên gia đánh giá trước khi xác định mức phù hợp.',
  },
  {
    id: 'exercise_busy',
    keywords: ['khong co thoi gian tap', 'ban khong tap duoc', 'it thoi gian van dong'],
    reply:
      'Bạn có thể chia nhỏ vận động thành 5–10–15 phút: đi bộ khi gọi điện, đi cầu thang, đi bộ ' +
      'sau bữa ăn — tăng vận động ngay trong sinh hoạt hằng ngày là được.',
  },
  {
    id: 'exercise_evening',
    keywords: ['tap buoi toi', 'van dong buoi toi'],
    reply:
      'Tập buổi tối vẫn được nhé, chỉ nên tránh vận động quá nặng sát giờ ngủ nếu nó ảnh hưởng ' +
      'đến giấc ngủ của bạn.',
  },
  {
    id: 'exercise_after_meal',
    keywords: ['tap ngay sau khi an', 'van dong sau bua an'],
    reply:
      'Sau khi ăn, bạn có thể đi bộ nhẹ nếu thấy thoải mái, nhưng không nên tập nặng ngay khi vừa ' +
      'ăn no. Không có một mốc thời gian cố định áp dụng cho tất cả — bạn theo dõi cảm giác cơ ' +
      'thể là chính.',
  },
  {
    id: 'exercise_beginner',
    keywords: ['moi bat dau tap', 'nguoi moi tap the duc'],
    reply:
      'Bạn có thể bắt đầu nhẹ nhàng với đi bộ rồi tăng dần theo thời gian — không cần đạt 10.000 ' +
      'bước hay 30 phút vận động ngay từ ngày đầu. Quan trọng là theo dõi phản ứng của cơ thể ' +
      'mình nhé.',
  },

  // --- Cân đo ---
  {
    id: 'measurement_weigh_time',
    keywords: ['can luc nao', 'thoi diem can nang'],
    reply:
      'Nên cân vào buổi sáng, sau khi ngủ dậy, sau khi đi vệ sinh và trước khi ăn/uống — cố gắng ' +
      'giữ điều kiện tương tự mỗi lần cân để số liệu so sánh được chính xác.',
  },
  {
    id: 'measurement_weigh_protocol',
    keywords: ['can nhu the nao cho dung', 'cach can dung'],
    reply:
      'Khi cân, bạn nên đứng trên sàn phẳng/cứng, mặc trang phục tương tự mỗi lần, đứng đúng tư ' +
      'thế nếu dùng cân sinh học, và đảm bảo app/kết nối hoạt động đúng. Không nên so cân buổi ' +
      'tối với cân buổi sáng rồi kết luận nhé.',
  },
  {
    id: 'measurement_weight_fluctuation',
    keywords: ['can tang 1kg', 'can nang thay doi', 'can len xuong that thuong'],
    reply:
      'Tăng khoảng 0,5–1kg trong một ngày không nhất thiết là tăng mỡ — có thể do nước, thức ăn, ' +
      'muối, tinh bột, chu kỳ, stress hoặc mất ngủ. Bạn không cần nhịn ăn hay tập quá sức chỉ vì ' +
      'một lần cân cao, nên đánh giá theo xu hướng nhiều ngày/tuần thay vì 1 lần cân.',
  },
  {
    id: 'measurement_waist',
    keywords: ['do vong bung o dau', 'vi tri do vong bung', '3 vi tri vong bung'],
    reply:
      'FIT AND CARE theo dõi 3 vị trí vòng bụng theo hướng dẫn chính thức của chương trình. Nếu ' +
      'bạn cần, coach sẽ hướng dẫn đúng vị trí đo.',
  },
  {
    id: 'measurement_hip',
    keywords: ['do vong mong', 'vi tri do vong mong'],
    reply: 'Vòng mông đo ở phần rộng nhất của mông, dùng thước đo ngang và không siết chặt thước khi đo nhé.',
  },
  {
    id: 'measurement_other',
    keywords: ['cac chi so khac can theo doi', 'do vong dui', 'ty le mo co'],
    reply:
      'Ngoài cân nặng, bạn có thể theo dõi thêm vòng mông, vòng đùi, tỷ lệ mỡ/cơ... Coach sẽ chọn ' +
      'chỉ số phù hợp theo mục tiêu của bạn — không cần quá tập trung vào biến động nhỏ trong 1 ngày.',
  },
  {
    id: 'measurement_tracking_frequency',
    keywords: ['bao lau can do 1 lan', 'tan suat theo doi chi so'],
    reply:
      'Tần suất cân đo sẽ theo lịch coach hướng dẫn cụ thể cho bạn — hiện chưa có một quy định ' +
      'tần suất bắt buộc chung cho tất cả.',
  },
  {
    id: 'measurement_missed_tracking',
    keywords: ['quen cap nhat can', 'bo lo 1 ngay can do'],
    reply:
      'Không sao, bạn không cần làm lại từ đầu đâu — cứ tiếp tục cập nhật ở lần tiếp theo là được. ' +
      'Bạn có thể đặt nhắc nhở để không quên, và không cần khai lại dữ liệu mà mình không chắc chắn.',
  },
  {
    id: 'measurement_app_problem',
    keywords: ['can sinh hoc bi loi', 'app can khong ket noi', 'loi bluetooth'],
    reply:
      'Bạn thử kiểm tra vài bước sau: pin/nguồn cân, Bluetooth, quyền của app, khởi động lại app, ' +
      'khởi động lại Bluetooth/điện thoại, để điện thoại gần cân khi đo. Nếu vẫn lỗi, bạn chụp ' +
      'screenshot và mình sẽ chuyển đội hỗ trợ FIT AND CARE xử lý tiếp nhé (không tự can thiệp ' +
      'phần cứng).',
  },
];

const MAX_FAQ_RESULTS = 3;

// Harvard: 2 intent cùng đúng ngữ nghĩa "liên quan Harvard" nhưng mức độ khác nhau — nếu câu hỏi
// đủ cụ thể để khớp harvard_certification (câu hỏi/nghi vấn về CHỨNG NHẬN) thì KHÔNG kèm thêm
// harvard_training (tránh 2 câu trả lời trùng lặp nội dung cho cùng 1 câu hỏi).
function applyHarvardExclusivity(items) {
  const hasCertification = items.some((i) => i.id === 'harvard_certification');
  const hasTraining = items.some((i) => i.id === 'harvard_training');
  if (hasCertification && hasTraining) {
    return items.filter((i) => i.id !== 'harvard_training');
  }
  return items;
}

function findFaqIntents(rawText) {
  const text = normalizeForMatch(rawText);
  const scored = [];
  for (const item of FAQ_ITEMS) {
    let bestScore = 0;
    for (const kw of item.keywords) {
      const padded = ` ${kw} `;
      if (text.includes(padded)) {
        const score = keywordScore(kw);
        if (score > bestScore) bestScore = score;
      }
    }
    if (bestScore > 0) scored.push({ item, score: bestScore });
  }
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.item.id < b.item.id) return -1;
    if (a.item.id > b.item.id) return 1;
    return 0;
  });
  let items = scored.map((s) => s.item);
  items = applyHarvardExclusivity(items);
  return items.slice(0, MAX_FAQ_RESULTS);
}

// Gửi tất cả FAQ item khớp (đã cap MAX_FAQ_RESULTS) — chỉ sendMessage, KHÔNG sendPhoto. Trả về
// true nếu đã gửi gì đó, false nếu không có intent nào khớp (để caller rơi xuống knowledge
// matcher / fallback).
async function respondFaq(zaloClient, chatId, rawText) {
  const items = findFaqIntents(rawText);
  if (items.length === 0) return false;
  for (const item of items) {
    await zaloClient.sendMessage(chatId, item.reply);
  }
  return true;
}

module.exports = { FAQ_ITEMS, MAX_FAQ_RESULTS, findFaqIntents, respondFaq };
