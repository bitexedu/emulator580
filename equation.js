// Mode Equation/Func (Tầng 7) — giải hệ phương trình tuyến tính và phương
// trình đa thức.
//
// Chỉ chứa LUẬT, thuần hàm, không giữ trạng thái, không DOM. Màn hình nhập là
// bộ soạn thảo hệ số dùng chung (coefficient-editor.js); việc lắp lại nằm ở
// engine.js.
//
// Nạp SAU engine.js — dùng ở phạm vi toàn cục: EngineError, bộ phân số BigInt
// (fracAdd/fracSub/fracMul/fracDiv/fracNeg/fracReduce, ZERO_FRACTION,
// fractionFromDecimalString, trimTrailingZeros) và bộ căn thức
// (surdSqrtFraction, surdFromFraction).
//
// Hệ tuyến tính và bậc 2 dùng phân số BigInt/căn thức chính xác. Bậc 3-4
// tìm nghiệm số rồi kiểm tra dạng phân số; quartic trùng phương còn giữ √t
// khi t hữu tỉ đã được kiểm tra chính xác (CASIO 2026-10-20).
//
// Nguồn hành vi: docs/fx-580VNX_VI.pdf trang 164-171 (đọc qua
// docs/manual-plain.txt) và Excel Functional Spec dòng EQ-001…EQ-013.

// Tên ẩn theo số ẩn của hệ. Ẩn thứ tư là 't' — ĐÃ XÁC NHẬN 2026-08-17 trên
// bản giả lập chính hãng: mở hệ 4 ẩn rồi cuộn sang phải thấy cột "0t".
const SIMUL_UNKNOWN_NAMES = ['x', 'y', 'z', 't'];

// Chỉ số dưới để dựng nhãn ô (a₁, b₂...).
const SUBSCRIPT_DIGITS = ['₀', '₁', '₂', '₃', '₄'];

// Nhãn lưới hệ số của hệ n ẩn: mỗi hàng là một phương trình, n hệ số cộng một
// vế phải. Hệ 2 ẩn → 2 hàng × 3 cột: a₁ b₁ c₁ / a₂ b₂ c₂.
function simulLabels(n) {
  const letters = ['a', 'b', 'c', 'd', 'e'];
  const labels = [];
  for (let row = 1; row <= n; row++) {
    for (let col = 0; col <= n; col++) {
      labels.push(letters[col] + SUBSCRIPT_DIGITS[row]);
    }
  }
  return labels;
}

// Nhãn lưới hệ số của đa thức bậc n: a, b, c, ... (n+1 hệ số) trên một hàng.
function polyLabels(degree) {
  return ['a', 'b', 'c', 'd', 'e'].slice(0, degree + 1);
}

// Màn hình nhập của đa thức là CHÍNH ĐA THỨC, không phải danh sách ô có nhãn
// — ĐÃ XÁC NHẬN 2026-08-17 trên bản giả lập chính hãng: bậc 2 hiện dòng tiêu
// đề "ax²+bx+c" rồi `▓▓x²+ 0x + 0`, ô đang chọn tô ngược.
//
// Hệ số ĐẦU mang dấu của chính nó (a=−1 hiện `−1x²`); các hệ số sau thì dấu
// tách ra thành toán tử và ô chỉ hiện trị tuyệt đối (`3x − 1`, không phải
// `3x + −1`). `signOf` đánh dấu chỗ toán tử đó, `abs` đánh dấu ô hiện |giá trị|.
const POLY_POWER_TEXT = ['', 'x', 'x²', 'x³', 'x⁴'];

function polyTemplate(degree) {
  const rows = [[{ cell: 0 }, { text: POLY_POWER_TEXT[degree] }]];
  for (let i = 1; i <= degree; i++) {
    // Màn hình chỉ chứa BA hệ số một dòng, hệ số thứ tư trở đi xuống dòng
    // dưới — và dấu đứng trước nó đi theo xuống cùng. ĐÃ XÁC NHẬN
    // 2026-08-23 trên bản giả lập:
    //   bậc 3:  0x³+  0x²+  0x        bậc 4:  0x⁴+  0x³+  0x²
    //           +  0                          +  0x +  0
    // Bậc 2 chỉ có ba hệ số nên vẫn gọn một dòng như cũ, không đổi gì.
    if (i === 3) rows.push([]);
    const row = rows[rows.length - 1];
    row.push({ signOf: i });
    row.push({ cell: i, abs: true });
    row.push({ text: POLY_POWER_TEXT[degree - i] });
  }
  return rows;
}

// Màn hình nhập của hệ phương trình cũng là CHÍNH hệ đó, không phải lưới nhãn
// a₁ b₁ c₁ — ĐÃ XÁC NHẬN 2026-08-17 trên bản giả lập chính hãng: hệ 2 ẩn hiện
//   ⎧ ▓▓x + 0y = 0
//   ⎩  0x + 0y = 0
// với dấu ngoặc nhọn gom hai dòng, ô đang chọn tô ngược. Hệ 4 ẩn hiện đủ 4
// dòng và CUỘN NGANG khi con trỏ đi sang phải (ẩn thứ tư tên là 't').
// Hệ số âm biến dấu thành toán tử y như đa thức (`1x − 1y = 1`); riêng vế
// phải nằm sau dấu "=" nên giữ dấu trong chính nó.
function simulTemplate(n) {
  const rows = [];
  for (let row = 0; row < n; row++) {
    const base = row * (n + 1);
    const items = [{ cell: base }, { text: SIMUL_UNKNOWN_NAMES[0] }];
    for (let col = 1; col < n; col++) {
      items.push({ signOf: base + col });
      items.push({ cell: base + col, abs: true });
      items.push({ text: SIMUL_UNKNOWN_NAMES[col] });
    }
    // Máy viết "y=" dính liền rồi mới tới hằng số ("1x − 2y= 3"), không phải
    // "y = 3" — ĐÃ XÁC NHẬN 2026-08-20.
    items.push({ text: '= ' });
    items.push({ cell: base + n });
    rows.push(items);
  }
  return rows;
}

function polyHeader(degree) {
  const letters = ['a', 'b', 'c', 'd', 'e'];
  let header = letters[0] + POLY_POWER_TEXT[degree];
  for (let i = 1; i <= degree; i++) {
    header += '+' + letters[i] + POLY_POWER_TEXT[degree - i];
  }
  return header;
}

// Sáu kiểu trong menu Select Type, đúng thứ tự phím máy thật (Excel
// FLOW-EQ-001/004: MENU → 9 → 1|2 → 2|3|4).
// `ready: false` = chưa làm, vẫn liệt kê trong menu để các mục khác giữ đúng
// số thứ tự phím.
const EQUATION_TYPES = [
  { id: 'simul2', group: 'simul', key: '2', label: '2 ẩn', unknowns: 2, labels: simulLabels(2), columns: 3, template: simulTemplate(2), braced: true, ready: true },
  { id: 'simul3', group: 'simul', key: '3', label: '3 ẩn', unknowns: 3, labels: simulLabels(3), columns: 4, template: simulTemplate(3), braced: true, ready: true },
  { id: 'simul4', group: 'simul', key: '4', label: '4 ẩn', unknowns: 4, labels: simulLabels(4), columns: 5, template: simulTemplate(4), braced: true, ready: true },
  { id: 'poly2', group: 'poly', key: '2', label: 'Bậc 2', header: polyHeader(2), degree: 2, labels: polyLabels(2), columns: 3, template: polyTemplate(2), ready: true },
  // Lưới hệ số bậc 3 và bậc 4 đều là BA CỘT — ĐÃ XÁC NHẬN 2026-08-23 trên
  // bản giả lập: bậc 3 xếp "a b c" hàng trên, "d" hàng dưới; bậc 4 xếp
  // "a b c" hàng trên, "d e" hàng dưới. Bản trước để 4 và 5 cột (tức mỗi
  // bậc một hàng ngang) là tự suy ra, không phải đối chiếu.
  { id: 'poly3', group: 'poly', key: '3', label: 'Bậc 3', header: polyHeader(3), degree: 3, labels: polyLabels(3), columns: 3, template: polyTemplate(3), ready: true },
  { id: 'poly4', group: 'poly', key: '4', label: 'Bậc 4', header: polyHeader(4), degree: 4, labels: polyLabels(4), columns: 3, template: polyTemplate(4), ready: true }
];

// Tiêu đề dòng trên của màn hình nghiệm, theo bậc. ĐÃ XÁC NHẬN 2026-08-23:
// bậc 3 viết đủ "ax³+bx²+cx+d=0", còn bậc 4 máy viết tắt phần giữa —
// "ax⁴+bx³+···+e=0" — vì không đủ 16 ký tự một dòng.
const POLY_SOLUTION_HEADER = {
  2: 'ax²+bx+c=0',
  3: 'ax³+bx²+cx+d=0',
  4: 'ax⁴+bx³+···+e=0'
};

function equationTypeById(id) {
  return EQUATION_TYPES.find((type) => type.id === id) || EQUATION_TYPES[0];
}

// Hệ số từ bộ soạn thảo là số thực JS. Đưa về phân số chính xác qua chuỗi
// thập phân — ô chỉ cho gõ tối đa 10 chữ số nên toFixed(10) không mất gì.
function coefficientToFraction(value) {
  if (!Number.isFinite(value)) {
    throw new EngineError('Math ERROR');
  }
  return fractionFromDecimalString(trimTrailingZeros(value.toFixed(10)));
}

// ===== Hệ phương trình tuyến tính =====
// Khử Gauss với xoay từng phần, TRÊN PHÂN SỐ nên không có sai số làm tròn và
// cũng không cần ngưỡng "gần bằng 0" — một hệ số bằng 0 là bằng 0 thật.
//
// Trả về:
//   { kind: 'roots', roots: [{ label, fraction }] }
//   { kind: 'message', message: 'No Solution' | 'Infinite Solution' }
// Hai chữ này ĐÃ XÁC NHẬN 2026-08-17: hệ x+y=1, 2x+2y=3 cho "No Solution";
// hệ x+y=1, 2x+2y=2 cho "Infinite Solution". Cả hai hiện căn PHẢI ở dòng cuối.
function solveSimultaneous(unknowns, values) {
  const width = unknowns + 1;
  // matrix[row] = [hệ số..., vế phải]
  const matrix = [];
  for (let row = 0; row < unknowns; row++) {
    const cells = [];
    for (let col = 0; col < width; col++) {
      cells.push(coefficientToFraction(values[row * width + col]));
    }
    matrix.push(cells);
  }

  for (let pivot = 0; pivot < unknowns; pivot++) {
    // Tìm hàng còn lại có hệ số khác 0 ở cột này để làm hàng chốt.
    let pivotRow = -1;
    for (let row = pivot; row < unknowns; row++) {
      if (!fracIsZero(matrix[row][pivot])) {
        pivotRow = row;
        break;
      }
    }
    if (pivotRow === -1) {
      // Cả cột bằng 0: hệ suy biến. Vô nghiệm nếu còn một hàng dạng
      // "0 = số khác 0", ngược lại là vô số nghiệm.
      return { kind: 'message', message: degenerateMessage(matrix, unknowns, width) };
    }
    if (pivotRow !== pivot) {
      const tmp = matrix[pivot];
      matrix[pivot] = matrix[pivotRow];
      matrix[pivotRow] = tmp;
    }

    // Chuẩn hoá hàng chốt rồi khử cột đó ở mọi hàng khác.
    const pivotValue = matrix[pivot][pivot];
    for (let col = pivot; col < width; col++) {
      matrix[pivot][col] = fracDiv(matrix[pivot][col], pivotValue);
    }
    for (let row = 0; row < unknowns; row++) {
      if (row === pivot) continue;
      const factor = matrix[row][pivot];
      if (fracIsZero(factor)) continue;
      for (let col = pivot; col < width; col++) {
        matrix[row][col] = fracSub(matrix[row][col], fracMul(factor, matrix[pivot][col]));
      }
    }
  }

  // Cùng khuôn với nghiệm bậc 2 (có `form`) để engine và UI chỉ cần một
  // đường vẽ nghiệm, không phân biệt hệ hay đa thức.
  const roots = [];
  for (let row = 0; row < unknowns; row++) {
    roots.push({
      label: SIMUL_UNKNOWN_NAMES[row],
      form: 'fraction',
      fraction: fracReduce(matrix[row][width - 1])
    });
  }
  return { kind: 'roots', roots };
}

// Sau khi gặp cột toàn 0: hàng nào có toàn hệ số 0 mà vế phải khác 0 thì hệ
// mâu thuẫn (vô nghiệm); không có hàng nào như vậy thì thiếu ràng buộc (vô số
// nghiệm).
function degenerateMessage(matrix, unknowns, width) {
  for (let row = 0; row < unknowns; row++) {
    let allZero = true;
    for (let col = 0; col < unknowns; col++) {
      if (!fracIsZero(matrix[row][col])) {
        allZero = false;
        break;
      }
    }
    if (allZero && !fracIsZero(matrix[row][width - 1])) {
      return 'No Solution';
    }
  }
  return 'Infinite Solution';
}

// ===== Phương trình bậc hai =====
// ax² + bx + c = 0, nghiệm = (−b ± √D) / 2a với D = b² − 4ac.
//
// Mỗi nghiệm trả về một trong ba dạng, để UI vẽ đúng cách máy thật:
//   { form: 'fraction', fraction }              — nghiệm hữu tỉ
//   { form: 'surd', surd }                      — nghiệm căn thức
//   { form: 'complex', re, im }                 — nghiệm phức, re/im là surd
// Nghiệm kép (D = 0) trả về MỘT phần tử — ĐÃ XÁC NHẬN 2026-08-17:
// x²−2x+1=0 chỉ có MỘT màn hình nghiệm, nhãn "x=" trần (không phải x₁/x₂),
// rồi mới tới hai màn hình cực trị.
function solveQuadratic(values) {
  const a = coefficientToFraction(values[0]);
  const b = coefficientToFraction(values[1]);
  const c = coefficientToFraction(values[2]);

  // a = 0 thì không còn là phương trình bậc hai.
  if (fracIsZero(a)) {
    throw new EngineError('Math ERROR');
  }

  const discriminant = fracSub(fracMul(b, b), fracMul({ num: 4n, den: 1n }, fracMul(a, c)));
  const twoA = fracMul({ num: 2n, den: 1n }, a);
  const center = fracDiv(fracNeg(b), twoA);          // −b/2a
  // Độ lệch dùng |2a| chứ KHÔNG dùng 2a. ĐÃ XÁC NHẬN 2026-08-17: với
  // −x²+2x=0 máy cho x₁=2 rồi x₂=0, tức nghiệm LỚN đứng trước. Chia cho 2a
  // âm sẽ đảo thứ tự, ra x₁=0/x₂=2 — sai so với máy. Máy xử như đã nhân cả
  // phương trình cho −1 để a dương rồi mới lấy ±.
  const twoAbsA = twoA.num < 0n ? fracNeg(twoA) : twoA;
  const halfSpread = fracDiv({ num: 1n, den: 1n }, twoAbsA); // 1/|2a|

  if (fracIsZero(discriminant)) {
    return [{ form: 'fraction', fraction: center }];
  }

  const negative = discriminant.num < 0n;
  const magnitude = negative ? fracNeg(discriminant) : discriminant;
  // √|D| dưới dạng căn thức chính xác. surdSqrtFraction tự rút gọn thành số
  // hữu tỉ khi |D| là bình phương đúng (radicand === 1n).
  const rootOfDiscriminant = surdSqrtFraction(magnitude);

  if (!negative && rootOfDiscriminant.radicand === 1n) {
    // Nghiệm hữu tỉ: √D rút gọn hết căn.
    const spread = fracMul(halfSpread, rootOfDiscriminant.rational);
    return [
      { form: 'fraction', fraction: fracAdd(center, spread) },
      { form: 'fraction', fraction: fracSub(center, spread) }
    ];
  }

  // Tới đây: hoặc D âm (nghiệm phức, |D| có thể chính phương hay không),
  // hoặc D dương không chính phương (nghiệm căn thức).
  //
  // surdSqrtFraction cất kết quả ở HAI CHỖ KHÁC NHAU: |D| chính phương thì
  // giá trị nằm ở `.rational` và `.coeff` bằng 0; không chính phương thì nằm
  // ở `.coeff` kèm `.radicand`. Lấy nhầm một chỗ sẽ ra phần ảo bằng 0 với
  // những ca như x²+1=0 (|D|=4, chính phương).
  const rootIsRational = rootOfDiscriminant.radicand === 1n;
  const rootMagnitude = rootIsRational ? rootOfDiscriminant.rational : rootOfDiscriminant.coeff;
  const radicand = rootIsRational ? 1n : rootOfDiscriminant.radicand;
  const coeff = fracMul(halfSpread, rootMagnitude);

  if (negative) {
    // Nghiệm phức: phần thực chung là center, phần ảo là ±coeff√radicand.
    return [
      { form: 'complex', re: surdFromFraction(center), im: { rational: ZERO_FRACTION, coeff, radicand } },
      { form: 'complex', re: surdFromFraction(center), im: { rational: ZERO_FRACTION, coeff: fracNeg(coeff), radicand } }
    ];
  }

  return [
    { form: 'surd', surd: { rational: center, coeff, radicand } },
    { form: 'surd', surd: { rational: center, coeff: fracNeg(coeff), radicand } }
  ];
}

// Điểm vào duy nhất engine gọi. Trả về cùng khuôn với solveSimultaneous để
// engine không phải phân biệt hai nhánh.
function solveEquation(typeId, values) {
  const type = equationTypeById(typeId);
  if (!type.ready) {
    throw new EngineError('Math ERROR');
  }
  if (type.group === 'simul') {
    return solveSimultaneous(type.unknowns, values);
  }
  // Bậc 2 giải ĐẠI SỐ (ra phân số/căn thức/số phức chính xác); bậc 3 và 4
  // giải bằng SỐ; riêng quartic trùng phương có thể nhận dạng √t chính xác
  // sau khi kiểm t trên đa thức hữu tỉ (CASIO 2026-10-20).
  const raw = type.degree === 2
    ? solveQuadratic(values)
    : solvePolynomialNumeric(type.degree, values);
  // Tiêu đề màn hình nghiệm. Bậc 4 máy VIẾT TẮT phần giữa thành "···" —
  // ĐÃ XÁC NHẬN 2026-08-23, trong khi bậc 2 và 3 viết đủ.
  const header = POLY_SOLUTION_HEADER[type.degree];
  const roots = raw.map((root, index, all) => ({
    // Nghiệm bội gộp lại chỉ còn một phần tử nên để nhãn trần "x"; từ hai
    // nghiệm trở lên thì đánh số x₁, x₂... như sách giáo khoa. ĐÃ XÁC NHẬN
    // 2026-08-23 ở bậc 3 với (x−1)³ (một màn hình "x=") và (x²−1)² ở bậc 4
    // (hai màn hình x₁, x₂).
    label: all.length === 1 ? 'x' : 'x' + SUBSCRIPT_DIGITS[index + 1],
    header,
    ...root
  }));
  // Bậc 2 và bậc 3 có màn hình cực trị, bậc 4 KHÔNG — ĐÃ XÁC NHẬN
  // 2026-08-23: hết nghiệm x₄ là về thẳng lưới hệ số.
  let tail = [];
  if (type.degree === 2) tail = extremaScreens(values);
  else if (type.degree === 3) tail = cubicExtremaScreens(values);
  return { kind: 'roots', roots: roots.concat(tail) };
}

// Sau nghiệm cuối, máy hiện tiếp toạ độ đỉnh parabol — ĐÃ XÁC NHẬN 2026-08-17
// trên bản giả lập chính hãng, và đây là hành vi MẶC ĐỊNH (mục SETUP
// "Equation/Func" bật sẵn), không phải tuỳ chọn thêm:
//   2x²+3x−1=0 → x₁ → x₂ → "Min of y=ax²+bx+c" x=−3/4 → y=−17/8 → về Bộ soạn thảo
//   −x²+2x=0   → x₁=2 → x₂=0 → "Max of y=..."      x=1    → y=1
// a<0 thì chữ đổi thành Max. Nghiệm phức VẪN có màn hình cực trị (thử với
// x²+2x+3=0, sau x₂ ra "Min of y=..." x=−1).
//
// Đỉnh: x = −b/2a, y = c − b²/4a. Tính bằng phân số BigInt như phần còn lại
// của file nên không lệch chữ số cuối.
function extremaScreens(values) {
  const a = coefficientToFraction(values[0]);
  const b = coefficientToFraction(values[1]);
  const c = coefficientToFraction(values[2]);
  const vertexX = fracDiv(fracNeg(b), fracMul({ num: 2n, den: 1n }, a));
  const vertexY = fracSub(c, fracDiv(fracMul(b, b), fracMul({ num: 4n, den: 1n }, a)));
  const header = (a.num < 0n ? 'Max' : 'Min') + ' of y=ax²+bx+c';
  return [
    { label: 'x', header, form: 'fraction', fraction: fracReduce(vertexX) },
    { label: 'y', header, form: 'fraction', fraction: fracReduce(vertexY) }
  ];
}

// ===== Đa thức bậc 3 và bậc 4 =====
// ĐÃ XÁC NHẬN 2026-08-23 trên bản giả lập chính hãng. Khác hẳn bậc 2, nên
// đọc kỹ trước khi sửa:
//
// Cubic vô tỉ hiện dạng số. Quartic trùng phương giữ √t với t hữu tỉ
// (đã bổ sung đối chứng 2026-10-20). Ca phân biệt của cubic: x³−x²−2x+2=0 có
// nghiệm đúng bằng ±√2 và 1, nhưng máy cho "−1.414213562", "1.414213562",
// "1" — chứ không phải ±√2. Nếu máy giải đại số như bậc 2 thì đã ra dạng căn.
// Nghiệm HỮU TỈ thì vẫn hiện dạng phân số: 2x³−x²−2x+1=0 cho x₃ = 1/2 xếp
// tầng. Tức là: tính bằng SỐ, còn phân số chỉ là chuyện hiển thị — đúng cách
// máy vẫn đổi số thập phân đẹp thành phân số ở mọi chỗ khác.
//
// **Nghiệm bội gộp làm một.** (x−1)³=0 cho ĐÚNG MỘT màn hình, nhãn "x=" trần
// không có chỉ số dưới (giống nghiệm kép của bậc 2). (x²−1)²=0 cho hai màn
// hình x₁=1, x₂=−1.
//
// **Thứ tự nghiệm bậc 3 KHÔNG phải sắp xếp** — ba ca đều khớp một quy tắc:
// x₁ là nghiệm thực NHỎ NHẤT, hai nghiệm còn lại theo đúng lối bậc 2 (nhánh
// cộng trước, tức lớn trước):
//     x³−6x²+11x−6 → 1, 3, 2      (không phải 1, 2, 3)
//     x³−2x²−x+2   → −1, 2, 1
//     x³−x²−2x+2   → −√2, √2, 1   (dạng thập phân)
//     x³−2         → nghiệm thực, rồi cặp phức phần ảo DƯƠNG trước
//
// **Thứ tự nghiệm bậc 4 thì LẠI LÀ sắp xếp**: thực giảm dần trước, rồi phức
// giảm dần theo phần ảo — KHÔNG gom theo cặp liên hợp:
//     x⁴−5x²+4          → 2, 1, −1, −2
//     x⁴−10x³+35x²−50x+24 → 4, 3, 2, 1
//     x⁴−1              → 1, −1, i, −i
//     x⁴+5x²+4          → 2i, i, −i, −2i   ← ca này loại bỏ cách gom cặp,
//                          vì gom cặp sẽ cho i, −i, 2i, −2i
//
// **a = 0 → Math ERROR** ở cả bậc 3 và bậc 4 (đã bấm riêng từng bậc).
//
// **Cực trị**: bậc 3 CÓ, bậc 4 KHÔNG (hết nghiệm là về thẳng lưới hệ số).
// Cực trị bậc 3 lại tính CHÍNH XÁC dạng căn thức — hợp lý, vì đạo hàm là một
// tam thức bậc hai nên máy dùng lại được đúng bộ giải đại số của bậc 2:
//     x³−6x²+11x−6 → Local Max x=(6−√3)/3, y=2√3/9
//                    Local Min x=(6+√3)/3, y=−2√3/9
//     x³−x²−2x+2   → Local Max x=(1−√7)/3, y=(34+14√7)/27
//                    Local Min x=(1+√7)/3, y=(34−14√7)/27
// Đạo hàm vô nghiệm thì hiện MỘT màn hình "No Local Max/Min" (x³−2 và
// (x−1)³ đều cho màn hình này).

// --- Đa thức trên phân số chính xác. Mảng hệ số, bậc CAO đứng trước. ---

function polyTrim(coeffs) {
  // Mảng RỖNG phải thành đa thức 0 chứ không được để rỗng: phép chia cho
  // một hằng số cắt sạch phần dư, và polyGcd sau đó đọc phần tử [0] của nó.
  if (coeffs.length === 0) return [ZERO_FRACTION];
  let start = 0;
  while (start < coeffs.length - 1 && fracIsZero(coeffs[start])) start++;
  return coeffs.slice(start);
}

function polyDegree(coeffs) {
  return polyTrim(coeffs).length - 1;
}

function polyDerivative(coeffs) {
  const n = coeffs.length - 1;
  if (n < 1) return [ZERO_FRACTION];
  return coeffs.slice(0, n).map((c, i) => fracMul(c, { num: BigInt(n - i), den: 1n }));
}

// Chia có dư. Chỉ dùng cho bậc ≤ 4 nên không cần thuật toán khéo.
function polyDivMod(a, b) {
  const divisor = polyTrim(b);
  let rem = polyTrim(a).slice();
  const quotientLength = rem.length - divisor.length + 1;
  if (quotientLength <= 0) return { quotient: [ZERO_FRACTION], remainder: rem };
  const quotient = [];
  for (let i = 0; i < quotientLength; i++) {
    const factor = fracDiv(rem[i], divisor[0]);
    quotient.push(factor);
    for (let j = 0; j < divisor.length; j++) {
      rem[i + j] = fracSub(rem[i + j], fracMul(factor, divisor[j]));
    }
  }
  return { quotient, remainder: polyTrim(rem.slice(quotientLength)) };
}

function polyGcd(a, b) {
  let x = polyTrim(a);
  let y = polyTrim(b);
  while (!(y.length === 1 && fracIsZero(y[0]))) {
    const next = polyDivMod(x, y).remainder;
    x = y;
    y = next;
  }
  return x;
}

// Phần KHÔNG CHÍNH PHƯƠNG: p chia cho gcd(p, p′). Đa thức thu được có đúng
// tập nghiệm của p nhưng mọi nghiệm đều ĐƠN. Đây chính là chỗ làm ra hành vi
// "nghiệm bội gộp làm một" của máy, và tiện thể làm bài toán số dễ hơn nhiều
// (nghiệm bội là thứ bộ giải số nào cũng mất chính xác).
function polySquarefree(coeffs) {
  const g = polyGcd(coeffs, polyDerivative(coeffs));
  if (g.length === 1) return polyTrim(coeffs);
  return polyDivMod(coeffs, g).quotient;
}

function polyEvalFraction(coeffs, x) {
  let acc = ZERO_FRACTION;
  for (let i = 0; i < coeffs.length; i++) {
    acc = fracAdd(fracMul(acc, x), coeffs[i]);
  }
  return acc;
}

// --- Số phức dạng thô, chỉ dùng trong bộ giải số ---

function cAdd(a, b) { return { re: a.re + b.re, im: a.im + b.im }; }
function cSub(a, b) { return { re: a.re - b.re, im: a.im - b.im }; }
function cMul(a, b) {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}
function cDiv(a, b) {
  const d = b.re * b.re + b.im * b.im;
  if (d === 0) throw new EngineError('Math ERROR');
  return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
}
function cAbs(a) { return Math.hypot(a.re, a.im); }

function polyEvalComplex(coeffs, z) {
  let acc = { re: 0, im: 0 };
  for (let i = 0; i < coeffs.length; i++) {
    acc = cAdd(cMul(acc, z), { re: coeffs[i], im: 0 });
  }
  return acc;
}

// Durand–Kerner: tìm ĐỒNG THỜI mọi nghiệm phức của đa thức. Chọn cách này
// thay vì công thức Cardano/Ferrari vì một hàm dùng chung được cho cả bậc 3
// lẫn bậc 4, không phải chia trường hợp theo dấu biệt thức. Nó chỉ yếu ở
// nghiệm bội — mà nghiệm bội đã bị polySquarefree bỏ đi trước rồi.
function durandKernerRoots(coeffs) {
  const lead = coeffs[0];
  const monic = coeffs.map((c) => fracToNumber(fracDiv(c, lead)));
  const n = monic.length - 1;
  // Điểm xuất phát rải đều trên một đường tròn, lệch pha 0.5 rad để không
  // rơi trúng trục thực (nghiệm thực đối xứng sẽ làm phép chia ra 0).
  const z = [];
  for (let k = 0; k < n; k++) {
    const angle = (2 * Math.PI * k) / n + 0.5;
    z.push({ re: 0.4 * Math.cos(angle) + 0.9, im: 0.4 * Math.sin(angle) + 0.9 });
  }
  for (let iter = 0; iter < 500; iter++) {
    let largestStep = 0;
    for (let i = 0; i < n; i++) {
      let denominator = { re: 1, im: 0 };
      for (let j = 0; j < n; j++) {
        if (j !== i) denominator = cMul(denominator, cSub(z[i], z[j]));
      }
      const step = cDiv(polyEvalComplex(monic, z[i]), denominator);
      z[i] = cSub(z[i], step);
      largestStep = Math.max(largestStep, cAbs(step));
    }
    if (largestStep < 1e-15) break;
  }
  return z;
}

// Nghiệm thực bị lẫn một chút phần ảo do sai số. Đa thức đã không chính
// phương nên nghiệm tách nhau rõ, phần ảo rác nhỏ hơn hẳn ngưỡng này.
function isRealRoot(z) {
  return Math.abs(z.im) < 1e-9 * Math.max(1, Math.abs(z.re));
}

// Vài bước Newton trên chính đa thức hữu tỉ để lấy lại đủ chữ số cho nghiệm
// thực: Durand–Kerner dừng theo bước nhảy chung, chưa chắc mỗi nghiệm đã
// khít tới chữ số cuối mà máy hiện.
function polishRealRoot(coeffs, derivative, start) {
  let x = start;
  for (let i = 0; i < 30; i++) {
    const fx = fracToNumber(polyEvalFraction(coeffs, fractionFromDecimalString(String(x))));
    const dx = fracToNumber(polyEvalFraction(derivative, fractionFromDecimalString(String(x))));
    if (dx === 0 || !Number.isFinite(fx) || !Number.isFinite(dx)) break;
    const next = x - fx / dx;
    if (!Number.isFinite(next)) break;
    if (Math.abs(next - x) <= Math.abs(x) * 1e-16) { x = next; break; }
    x = next;
  }
  return x;
}

// Số thập phân tìm được có thể chính là một phân số đẹp (máy hiện 1/2 chứ
// không hiện 0.5). Dựng lại phân số bằng liên phân số rồi KIỂM TRA CHÍNH XÁC
// bằng cách thế vào đa thức hữu tỉ — chỉ nhận khi ra đúng 0, nên không bao
// giờ nhận nhầm một số vô tỉ thành phân số.
const RATIONAL_DENOMINATOR_LIMIT = 1000000n;

function rationalRootOrNull(coeffs, value) {
  let h1 = 1n, h0 = 0n, k1 = 0n, k0 = 1n;
  let x = value;
  for (let i = 0; i < 30; i++) {
    const whole = Math.floor(x);
    if (!Number.isFinite(whole) || Math.abs(whole) > 1e15) return null;
    const wholeBig = BigInt(whole);
    const h2 = wholeBig * h1 + h0;
    const k2 = wholeBig * k1 + k0;
    h0 = h1; h1 = h2;
    k0 = k1; k1 = k2;
    if (k1 !== 0n && bigAbs(k1) <= RATIONAL_DENOMINATOR_LIMIT) {
      const candidate = fracReduce({ num: h1, den: k1 });
      // Hai điều kiện, THIẾU MỘT LÀ SAI:
      //   (1) phân số đó phải là nghiệm thật của đa thức, và
      //   (2) phải đúng CHÍNH nghiệm đang xét chứ không phải nghiệm khác.
      // Bỏ (2) thì bước đầu của liên phân số cho x=√2 ra ngay ứng viên 1,
      // mà 1 lại đúng là một nghiệm khác của x³−x²−2x+2, nên √2 bị nhận
      // nhầm thành 1 và màn hình hiện hai nghiệm giống hệt nhau. Đây là lỗi
      // thật đã mắc ngày 2026-08-23, chỉ lộ ra nhờ ca có nhiều nghiệm.
      if (fracIsZero(polyEvalFraction(coeffs, candidate))
        && Math.abs(fracToNumber(candidate) - value) <= Math.max(1, Math.abs(value)) * 1e-9) {
        return candidate;
      }
    }
    const frac = x - whole;
    if (frac < 1e-12) return null;
    x = 1 / frac;
  }
  return null;
}

// --- Điểm vào: nghiệm của đa thức bậc 3 hoặc 4 ---
// Trả về mảng { form, ... } đúng khuôn solveQuadratic đang dùng, cộng thêm
// hai dạng mới cho kết quả dạng SỐ:
//   { form: 'decimal', value }                  — nghiệm thực không hữu tỉ
//   { form: 'complexDecimal', re, im }          — nghiệm phức dạng số
function solvePolynomialNumeric(degree, values) {
  const coeffs = [];
  for (let i = 0; i <= degree; i++) coeffs.push(coefficientToFraction(values[i]));
  // a = 0 thì không còn là phương trình bậc đó nữa.
  if (fracIsZero(coeffs[0])) throw new EngineError('Math ERROR');

  const squarefree = polySquarefree(coeffs);
  const derivative = polyDerivative(coeffs);
  const roots = durandKernerRoots(squarefree);

  const real = [];
  const complex = [];
  roots.forEach((z) => {
    if (isRealRoot(z)) {
      real.push(polishRealRoot(coeffs, derivative, z.re));
    } else {
      // Phần thực chỉ còn vụn sai số thì coi là 0, để máy hiện "i" chứ
      // không hiện "1×10⁻¹⁷+i".
      const re = Math.abs(z.re) < 1e-9 * Math.max(1, Math.abs(z.im)) ? 0 : z.re;
      complex.push({ re, im: z.im });
    }
  });

  const ordered = degree === 3
    ? orderCubicRoots(real, complex)
    : orderQuarticRoots(real, complex);

  return ordered.map((entry) => {
    if (entry.kind === 'complex') {
      return { form: 'complexDecimal', re: entry.value.re, im: entry.value.im };
    }
    const exact = rationalRootOrNull(coeffs, entry.value);
    if (exact !== null) return { form: 'fraction', fraction: exact };
    // CASIO 2026-10-20: quartic trùng phương giữ √t khi t=x² là
    // nghiệm hữu tỉ chính xác. Kiểm trên đa thức t trước khi nhận dạng,
    // không đổi luật thập phân của cubic hay quartic tổng quát.
    if (degree === 4 && fracIsZero(coeffs[1]) && fracIsZero(coeffs[3])) {
      const squared = rationalRootOrNull([coeffs[0], coeffs[2], coeffs[4]], entry.value * entry.value);
      if (squared !== null && squared.num > 0n) {
        const root = surdSqrtFraction(squared);
        return { form: 'surd', surd: entry.value < 0 ? surdNeg(root) : root };
      }
    }
    return { form: 'decimal', value: entry.value };
  });
}

// Bậc 3: nghiệm thực NHỎ NHẤT đứng đầu, phần còn lại lớn trước — xem bảng ca
// bấm ở đầu mục. Cặp phức thì phần ảo dương trước.
function orderCubicRoots(real, complex) {
  const sortedReal = real.slice().sort((a, b) => a - b);
  const out = [];
  if (sortedReal.length > 0) {
    out.push({ kind: 'real', value: sortedReal[0] });
    sortedReal.slice(1).sort((a, b) => b - a)
      .forEach((v) => out.push({ kind: 'real', value: v }));
  }
  complex.slice().sort((a, b) => b.im - a.im)
    .forEach((z) => out.push({ kind: 'complex', value: z }));
  return out;
}

// Bậc 4: thực giảm dần, rồi phức giảm dần theo phần ảo.
function orderQuarticRoots(real, complex) {
  const out = real.slice().sort((a, b) => b - a).map((v) => ({ kind: 'real', value: v }));
  complex.slice().sort((a, b) => b.im - a.im)
    .forEach((z) => out.push({ kind: 'complex', value: z }));
  return out;
}

// --- Cực trị của bậc 3, tính CHÍNH XÁC ---
// Đạo hàm 3ax²+2bx+c là một tam thức bậc hai nên giải được bằng đúng bộ căn
// thức của bậc 2; y thì thế thẳng x dạng căn vào đa thức, vẫn nằm trong
// trường ℚ(√D) nên không rơi về thập phân.
function cubicExtremaScreens(values) {
  const a = coefficientToFraction(values[0]);
  const b = coefficientToFraction(values[1]);
  const c = coefficientToFraction(values[2]);
  const d = coefficientToFraction(values[3]);

  const three = { num: 3n, den: 1n };
  const two = { num: 2n, den: 1n };
  const four = { num: 4n, den: 1n };
  const da = fracMul(three, a);
  const db = fracMul(two, b);
  const discriminant = fracSub(fracMul(db, db), fracMul(four, fracMul(da, c)));

  // Đạo hàm vô nghiệm hoặc nghiệm kép → đồ thị không có cực trị. ĐÃ XÁC NHẬN
  // 2026-08-23: x³−2 (biệt thức âm) và (x−1)³ (biệt thức bằng 0) đều cho một
  // màn hình "No Local Max/Min", không có tiêu đề và không có nhãn.
  if (discriminant.num <= 0n) {
    return [{ form: 'message', label: null, header: null, text: 'No Local Max/Min' }];
  }

  const twoDa = fracMul(two, da);
  const twoAbsDa = twoDa.num < 0n ? fracNeg(twoDa) : twoDa;
  const center = fracDiv(fracNeg(db), twoDa);
  const rootOfDiscriminant = surdSqrtFraction(discriminant);
  const rootIsRational = rootOfDiscriminant.radicand === 1n;
  const spreadCoeff = fracMul(
    fracDiv({ num: 1n, den: 1n }, twoAbsDa),
    rootIsRational ? rootOfDiscriminant.rational : rootOfDiscriminant.coeff);
  const radicand = rootIsRational ? 1n : rootOfDiscriminant.radicand;

  // A rational surd stores the entire value in rational, with coeff = 0.
  // Keeping a √1 coefficient violates that invariant and loses it in surdMul.
  const lower = rootIsRational ? surdFromFraction(fracSub(center, spreadCoeff))
    : surdNormalize({ rational: center, coeff: fracNeg(spreadCoeff), radicand });
  const upper = rootIsRational ? surdFromFraction(fracAdd(center, spreadCoeff))
    : surdNormalize({ rational: center, coeff: spreadCoeff, radicand });

  // a > 0: đồ thị đi lên ở hai đầu nên cực ĐẠI ở x nhỏ, cực TIỂU ở x lớn.
  // a < 0 thì ngược lại. ĐÃ XÁC NHẬN 2026-08-23 với a=1 ở cả hai ca bấm:
  // Local Max luôn ứng với x nhỏ hơn ((6−√3)/3 và (1−√7)/3).
  const maxX = a.num > 0n ? lower : upper;
  const minX = a.num > 0n ? upper : lower;

  const evaluate = (x) => surdAdd(
    surdAdd(surdMul(surdFromFraction(a), surdCube(x)), surdMul(surdFromFraction(b), surdSquare(x))),
    surdAdd(surdMul(surdFromFraction(c), x), surdFromFraction(d)));

  const header = ' of y=ax³+bx²+cx+d';
  return [
    { form: 'surd', label: 'x', header: 'Local Max' + header, surd: maxX },
    { form: 'surd', label: 'y', header: 'Local Max' + header, surd: surdNormalize(evaluate(maxX)) },
    { form: 'surd', label: 'x', header: 'Local Min' + header, surd: minX },
    { form: 'surd', label: 'y', header: 'Local Min' + header, surd: surdNormalize(evaluate(minX)) }
  ].map(screen => screen.surd.coeff.num === 0n
    ? { form: 'fraction', label: screen.label, header: screen.header, fraction: screen.surd.rational }
    : screen);
}
