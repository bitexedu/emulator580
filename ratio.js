// Mode Ratio (Tầng 7) — tìm X trong tỷ lệ A:B = X:D hoặc A:B = C:X.
//
// Chỉ chứa LUẬT của Ratio, thuần hàm, không giữ trạng thái, không DOM.
// Màn hình nhập là bộ soạn thảo hệ số dùng chung (coefficient-editor.js);
// việc lắp hai thứ lại nằm ở engine.js.
//
// Nạp SAU engine.js (dùng EngineError ở phạm vi toàn cục).
//
// Nguồn hành vi: docs/fx-580VNX_VI.pdf trang 178 (đọc qua
// docs/manual-plain.txt) và Excel Functional Spec dòng RATIO-001…004.

// Hai kiểu tỷ lệ, đúng thứ tự menu "Select Type" của máy thật:
//   1: A:B=X:D   — nhập A, B, D
//   2: A:B=C:X   — nhập A, B, C
// `cells` là nhãn các ô người dùng phải nhập; X là ẩn nên không có ô.
//
// `template` mô tả cách xếp màn hình nhập: máy thật KHÔNG liệt kê từng ô một
// dòng ("A 0 / B 0 / D 0") mà vẽ nguyên cái tỷ lệ trên MỘT dòng, ô đang chọn
// tô ngược — ĐÃ XÁC NHẬN 2026-08-17 trên bản giả lập chính hãng, màn hình đầu
// của kiểu 1 là `▓0▓:__0 = X:__0`.
// `template` là mảng các DÒNG (hệ phương trình cần nhiều dòng); mỗi dòng là
// mảng phần tử { text } (chữ cố định) hoặc { cell } (chỉ số ô hệ số).
const RATIO_TYPES = [
  {
    id: 'ABXD', label: 'A:B=X:D', cells: ['A', 'B', 'D'],
    template: [[{ cell: 0 }, { text: ':' }, { cell: 1 }, { text: ' = X:' }, { cell: 2 }]]
  },
  {
    id: 'ABCX', label: 'A:B=C:X', cells: ['A', 'B', 'C'],
    template: [[{ cell: 0 }, { text: ':' }, { cell: 1 }, { text: ' = ' }, { cell: 2 }, { text: ':X' }]]
  }
];

function ratioTypeById(id) {
  return RATIO_TYPES.find((type) => type.id === id) || RATIO_TYPES[0];
}

// Giải X.
//   A:B = X:D  ⇒  X = A×D ÷ B
//   A:B = C:X  ⇒  X = B×C ÷ A
//
// "Math ERROR sẽ xảy ra nếu bạn thực hiện tính toán trong khi 0 là đầu vào
// cho hệ số" (manual trang 178) — lỗi khi BẤT KỲ hệ số nào bằng 0, không chỉ
// riêng mẫu số. Kiểm tra trước khi chia nên không bao giờ lọt Infinity/NaN
// lên màn hình.
function solveRatio(typeId, values) {
  if (values.some((value) => !Number.isFinite(value) || value === 0)) {
    throw new EngineError('Math ERROR');
  }
  const [a, b, third] = values;
  const result = typeId === 'ABCX' ? (b * third) / a : (a * third) / b;
  if (!Number.isFinite(result)) {
    throw new EngineError('Math ERROR');
  }
  return result;
}

// Bản CHÍNH XÁC của solveRatio, chạy trên phân số BigInt thay vì số thực —
// dùng cho dạng phân số hiện trên màn hình (1:3=X:1 phải ra 1/3, không phải
// 3333333333/10000000000). Cùng công thức, cùng điều kiện lỗi với bản số
// thực ngay trên; tách làm hai hàm vì hai kiểu số không dùng chung toán tử.
function solveRatioExact(typeId, fractions) {
  if (fractions.some((f) => f === null || f.num === 0n)) {
    throw new EngineError('Math ERROR');
  }
  const [a, b, third] = fractions;
  return typeId === 'ABCX'
    ? fracDiv(fracMul(b, third), a)
    : fracDiv(fracMul(a, third), b);
}
