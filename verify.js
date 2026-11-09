// Mode Verify (Tầng 7) — kiểm tra một đẳng thức/bất đẳng thức đúng hay sai.
//
// File này chỉ chứa LUẬT RIÊNG của Verify. Nó không giữ trạng thái, không
// đụng DOM, không đọc biến nội bộ của engine: engine truyền vào chuỗi biểu
// thức đã dịch phẳng cùng một hàm tính một vế, ở đây chỉ tách chuỗi, kiểm
// tra chuỗi toán tử có hợp lệ không, rồi so sánh.
//
// Nạp SAU engine.js (xem index.html) vì có dùng hai thứ ở phạm vi toàn cục
// của engine.js: EngineError (để lỗi Verify đi chung một đường với mọi lỗi
// khác) và roundToSignificantDigits (xem verifyCompare bên dưới).
//
// Nguồn hành vi: docs/fx-580VNX_VI.pdf trang 175-178 (đọc qua
// docs/manual-plain.txt — bản trích KHÔNG dùng -layout nên còn nguyên các ký
// hiệu ≠ ≧ ≦; bản docs/manual.txt cũ đã mất sạch các ký hiệu này).

// Sáu toán tử quan hệ. Ký hiệu và THỨ TỰ lấy từ ảnh chụp menu OPTN của máy
// thật (2026-08-17): trang 1 hiện "1:=  2:≠  3:>  4:<  5:≥  6:≤".
// Chú ý màn hình máy dùng ≥ ≤, KHÁC bản PDF manual (viết ≧ ≦) — lấy theo máy.
// Tất cả đều là MỘT ký tự nên việc tách chuỗi không cần lo thứ tự khớp
// dài/ngắn như FUNCTION_KEYWORDS bên engine.js.
const VERIFY_OPERATORS = ['=', '≠', '>', '<', '≥', '≤'];

// Nhóm "hướng" của từng toán tử — dùng cho luật chuỗi nhiều toán tử.
// 'gt' và 'lt' là hai hướng ngược nhau; 'eq' và 'ne' không có hướng.
const VERIFY_DIRECTIONS = {
  '=': 'eq',
  '≠': 'ne',
  '>': 'gt',
  '≥': 'gt',
  '<': 'lt',
  '≤': 'lt'
};

// Tách "1≦1<1+1" thành các vế ["1", "1", "1+1"] và các toán tử ["≦", "<"].
//
// Cắt ở MỌI toán tử quan hệ, không quan tâm đang trong ngoặc hay không.
// Lý do: máy thật không cho đặt toán tử quan hệ bên trong ngoặc (mọi ví dụ
// trong manual đều để nó ở ngoài, vd "(3×6) < (2+6)×2"), nên một toán tử
// "trong ngoặc" trên thực tế chỉ xảy ra khi người dùng chưa đóng ngoặc —
// ví dụ "log2 < log3" gõ ra chuỗi "log(2<log(3". Cắt theo độ sâu ngoặc sẽ
// bỏ sót đúng trường hợp đó; cắt thẳng rồi để engine tự đóng ngoặc từng vế
// (autoCloseParens) cho ra "log(2)" và "log(3)" như máy thật hiển thị.
function splitVerifyExpression(flat) {
  const sides = [];
  const operators = [];
  let current = '';

  for (const ch of flat) {
    if (VERIFY_OPERATORS.includes(ch)) {
      sides.push(current);
      operators.push(ch);
      current = '';
      continue;
    }
    current += ch;
  }
  sides.push(current);

  // Máy KHÔNG báo lỗi khi thiếu toán tử quan hệ — nó tự thêm "=0" rồi so
  // sánh (ĐÃ XÁC NHẬN 2026-08-20). Việc thêm đó làm ở runVerify trong
  // engine.js, vì ở đó mới sửa được CẢ dòng biểu thức hiện trên màn hình.
  // Chỗ này giữ lại như một chốt chặn: gọi thẳng hàm mà thiếu toán tử là
  // lỗi lập trình, không phải thao tác của người dùng.
  if (operators.length === 0) {
    throw new EngineError('Syntax ERROR');
  }
  // Vế rỗng: "4<" hoặc "<4" hoặc "4<<5".
  if (sides.some((side) => side.trim() === '')) {
    throw new EngineError('Syntax ERROR');
  }

  return { sides, operators };
}

// Luật chuỗi nhiều toán tử (manual trang 176-177):
//   HỢP LỆ:   1 ≤ 1 < 1+1        (cùng hướng, lẫn ≤ với < được)
//             3 < π < 4
//             2² = 2+2 = 4
//             2+3 = 5 ≠ 2+5 = 8  (≠ đi chung với = được)
//             1 = 1 < 2          (= đi chung với toán tử có hướng)
//                                — ĐÃ XÁC NHẬN máy thật 2026-08-17
//   LỖI:      5 ≤ 6 ≥ 4          (ngược hướng)
//             4 < 6 ≠ 8          (≠ đi chung với toán tử có hướng)
//             4 > 6 ≠ 8          — ĐÃ XÁC NHẬN máy thật 2026-08-17, tức
//                                luật là "≠ không đi với BẤT KỲ toán tử có
//                                hướng nào", không riêng "<"
function checkVerifyChain(operators) {
  const directions = operators.map((op) => VERIFY_DIRECTIONS[op]);
  const hasGt = directions.includes('gt');
  const hasLt = directions.includes('lt');
  const hasNe = directions.includes('ne');

  if (hasGt && hasLt) {
    throw new EngineError('Syntax ERROR');
  }
  if (hasNe && (hasGt || hasLt)) {
    throw new EngineError('Syntax ERROR');
  }
}

// So sánh hai giá trị đã tính.
//
// Máy thật KHÔNG so sánh chính xác tuyệt đối — manual trang 176 nói thẳng
// "sai số tính toán có thể xảy ra". CLAUDE.md lại cấm so sánh bằng trực tiếp
// giữa hai số thực. Giải pháp thoả cả hai: làm tròn về 10 chữ số có nghĩa
// (đúng độ chính xác máy hiển thị) rồi mới so sánh.
//
// ĐÃ XÁC NHẬN máy thật 2026-08-17 bằng ca phân biệt được hai giả định:
// √2×√2 = 2 cho True. So sánh thô sẽ cho False (2.0000000000000004), nên
// máy thật đúng là có làm tròn trước khi so sánh.
function verifyCompare(op, left, right) {
  const a = roundToSignificantDigits(left, 10);
  const b = roundToSignificantDigits(right, 10);
  switch (op) {
    case '=': return a === b;
    case '≠': return a !== b;
    case '>': return a > b;
    case '<': return a < b;
    case '≥': return a >= b;
    case '≤': return a <= b;
    default: throw new EngineError('Syntax ERROR');
  }
}

// Điểm vào duy nhất engine gọi. `evalSide` là hàm engine đưa xuống, nhận
// chuỗi một vế và trả về số — nhờ vậy file này không cần biết gì về Ans,
// biến A-F, hay đơn vị góc.
//
// Nhiều toán tử = "và" các so sánh liền kề: 1 ≦ 1 < 2 đúng khi cả 1≦1 và
// 1<2 cùng đúng.
function evaluateVerify(flat, evalSide) {
  const { sides, operators } = splitVerifyExpression(flat);
  checkVerifyChain(operators);

  const values = sides.map(evalSide);
  for (let i = 0; i < operators.length; i++) {
    if (!verifyCompare(operators[i], values[i], values[i + 1])) {
      return false;
    }
  }
  return true;
}
