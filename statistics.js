// Mode Statistics (Tầng 7) — luật của mode, thuần hàm, không giữ trạng thái,
// không DOM. Trạng thái (bảng dữ liệu, con trỏ, màn hình đang xem) nằm ở
// createStatisticsHandler() trong engine.js, giống cách Ratio và Equation làm.
//
// Nạp SAU engine.js (dùng EngineError ở phạm vi toàn cục).
//
// Số liệu 1-Variable tự bấm bản giả lập 2026-08-25/26; y=a+bx bấm 2026-08-27.
// Vào mode: MENU → 6.

// Tám kiểu tính toán, đúng thứ tự màn hình "Select Type" của máy. Máy chia
// làm HAI TRANG và đánh số LẠI theo từng trang (1-4 rồi 1-4), giống menu
// SETUP — nên `key` lặp lại là đúng, không phải lỗi.
//
// `twoVar` = kiểu hai biến (bảng có cột y, có màn hình Regression Calc). Bảy
// kiểu hồi quy đều là hai biến; mới làm `linear` (y=a+bx), còn lại để mờ
// nhưng VẪN liệt kê đủ để số thứ tự khớp máy.
const STATISTICS_TYPES = [
  { id: '1var', page: 0, key: '1', label: '1-Variable', ready: true },
  { id: 'linear', page: 0, key: '2', label: 'y=a+bx', ready: true, twoVar: true },
  { id: 'quad', page: 0, key: '3', label: 'y=a+bx+cx²', ready: true, twoVar: true },
  { id: 'log', page: 0, key: '4', label: 'y=a+b·ln(x)', ready: true, twoVar: true },
  { id: 'exp-e', page: 1, key: '1', label: 'y=a·e^(bx)', ready: true, twoVar: true },
  { id: 'exp-ab', page: 1, key: '2', label: 'y=a·b^x', ready: true, twoVar: true },
  { id: 'power', page: 1, key: '3', label: 'y=a·x^b', ready: true, twoVar: true },
  { id: 'inverse', page: 1, key: '4', label: 'y=a+b/x', ready: true, twoVar: true }
];

function statisticsTypeById(id) {
  return STATISTICS_TYPES.find((type) => type.id === id) || STATISTICS_TYPES[0];
}

// Cột của bảng dữ liệu, tuỳ kiểu tính toán và thiết lập Frequency. Mỗi cột có
// `key` (tên trường trong dòng dữ liệu) và `label` (chữ trên đầu cột). Dòng
// dữ liệu luôn là { x, y, f } đầy đủ (xem newStatRow); cột chỉ quyết định ô
// nào HIỆN và SỬA được.
//   1-Variable, Freq Off: [x]
//   1-Variable, Freq On:  [x, Freq]
//   hai biến, Freq Off:   [x, y]
//   hai biến, Freq On:    [x, y, Freq]   ĐÃ XÁC NHẬN 2026-08-28
function statColumns(type, frequencyOn) {
  const cols = type.twoVar
    ? [{ key: 'x', label: 'x' }, { key: 'y', label: 'y' }]
    : [{ key: 'x', label: 'x' }];
  if (frequencyOn) cols.push({ key: 'f', label: 'Freq' });
  return cols;
}

// Dòng dữ liệu mới. x, y mặc định 0 và f mặc định 1 — đúng cách máy tự điền ô
// còn lại khi ta chỉ gõ MỘT cột: gõ x thì y=0/f=1, gõ y thì x=0, gõ Freq thì
// x=0. ĐÃ XÁC NHẬN 2026-08-26 (Freq) và 2026-08-27 (y). Insert Row cũng dùng
// đúng dòng này (x=0, y=0, Freq=1).
function newStatRow() {
  return { x: 0, y: 0, f: 1 };
}

// Số dòng tối đa của bảng dữ liệu. Manual trang 119 cho bảng đầy đủ:
// biến đơn 160 dòng (Freq Off) / 80 (Freq On); biến đôi 80 / 53. Trần biến đôi
// kèm Freq = 53 ĐÃ XÁC NHẬN 2026-08-28 bằng cách gõ tới hàng 53 rồi "=": con
// trỏ không sang hàng 54 (khớp ⌊160/3⌋).
function statisticsMaxRows(type, frequencyOn) {
  if (type && type.twoVar) return frequencyOn ? 53 : 80;
  return frequencyOn ? 80 : 160;
}

// Số dòng hiện cùng lúc trên màn hình danh sách thống kê, và cũng là bước
// cuộn của ▲▼ — ĐÃ XÁC NHẬN 2026-08-25: sáu dòng một trang, ▼ nhảy nguyên
// trang chứ không đi từng dòng.
const STAT_ROWS_PER_PAGE = 6;

// Mười ba dòng của màn hình `1-Variable Calc`, ĐÚNG THỨ TỰ máy hiện. `key` là
// tên trường trong kết quả computeStatistics(); `label` là chữ trên màn hình.
const STAT_RESULT_ROWS = [
  { key: 'meanX', label: 'x̄' },
  { key: 'sumX', label: 'Σx' },
  { key: 'sumX2', label: 'Σx²' },
  { key: 'popVarX', label: 'σ²x' },
  { key: 'popSdX', label: 'σx' },
  { key: 'sampVarX', label: 's²x' },
  { key: 'sampSdX', label: 'sx' },
  { key: 'n', label: 'n' },
  { key: 'minX', label: 'min(x)' },
  { key: 'q1', label: 'Q₁' },
  { key: 'med', label: 'Med' },
  { key: 'q3', label: 'Q₃' },
  { key: 'maxX', label: 'max(x)' }
];

// Hai mươi ba dòng của màn hình `2-Variable Calc`, ĐÚNG THỨ TỰ máy hiện —
// ĐÃ XÁC NHẬN 2026-08-27 (đọc hết cả bốn màn hình cuộn). Σx³/Σx²y/Σx⁴ có mặt
// sẵn ở đây dù đang ở kiểu tuyến tính, vì chúng cần cho hồi quy bậc 2.
const STAT_TWOVAR_ROWS = [
  { key: 'meanX', label: 'x̄' },
  { key: 'sumX', label: 'Σx' },
  { key: 'sumX2', label: 'Σx²' },
  { key: 'popVarX', label: 'σ²x' },
  { key: 'popSdX', label: 'σx' },
  { key: 'sampVarX', label: 's²x' },
  { key: 'sampSdX', label: 'sx' },
  { key: 'n', label: 'n' },
  { key: 'meanY', label: 'ȳ' },
  { key: 'sumY', label: 'Σy' },
  { key: 'sumY2', label: 'Σy²' },
  { key: 'popVarY', label: 'σ²y' },
  { key: 'popSdY', label: 'σy' },
  { key: 'sampVarY', label: 's²y' },
  { key: 'sampSdY', label: 'sy' },
  { key: 'sumXY', label: 'Σxy' },
  { key: 'sumX3', label: 'Σx³' },
  { key: 'sumX2Y', label: 'Σx²y' },
  { key: 'sumX4', label: 'Σx⁴' },
  { key: 'minX', label: 'min(x)' },
  { key: 'maxX', label: 'max(x)' },
  { key: 'minY', label: 'min(y)' },
  { key: 'maxY', label: 'max(y)' }
];

// Màn hình `Regression Calc` — ĐÃ XÁC NHẬN 2026-08-27: một dòng tiêu đề rồi
// ba dòng. Không cuộn. Tiêu đề đổi theo kiểu. Đa số kiểu hiện a, b, r; riêng
// bậc 2 hiện a, b, c (ba hệ số, KHÔNG r) — ĐÃ XÁC NHẬN 2026-08-28.
const STAT_REGRESSION_ROWS = [
  { key: 'a', label: 'a' },
  { key: 'b', label: 'b' },
  { key: 'r', label: 'r' }
];
const STAT_QUAD_REGRESSION_ROWS = [
  { key: 'a', label: 'a' },
  { key: 'b', label: 'b' },
  { key: 'c', label: 'c' }
];

// Dòng Regression Calc theo kiểu.
function statRegressionRows(typeId) {
  return statRegressionModel(typeId).quadratic ? STAT_QUAD_REGRESSION_ROWS : STAT_REGRESSION_ROWS;
}

// Mỗi kiểu hồi quy = hồi quy TUYẾN TÍNH trên dữ liệu đã BIẾN ĐỔI. Chỉ phần
// a, b, r và ước lượng x̂/ŷ dùng phép biến đổi; màn hình `2-Variable Calc`
// vẫn hiện thống kê THÔ — ĐÃ XÁC NHẬN 2026-08-27 (y=a+b·ln(x) cho Σx=6 của
// {1,2,3} thô) / 2026-08-28 (bốn kiểu phi tuyến cũng vậy).
// Trình tự: khớp đường thẳng TY = A + B·TX với TX=tx(x), TY=ty(y), được
// intercept A và slope B; rồi `fromCoef(A,B)` suy ra a, b HIỂN THỊ (có kiểu
// lấy a=exp(A), b=exp(B)); ước lượng dùng `yhat`/`xhat` với chính a, b đó.
//   tx/ty:      biến đổi x, y trước khi khớp.
//   fromCoef:   (A intercept, B slope) → [a, b] hiển thị.
//   yhat/xhat:  ŷ(x) và x̂(y) — nghịch đảo đại số của header.
//   header:     dòng tiêu đề màn hình Regression Calc.
// tx/ty trả giá trị không hữu hạn (ln(≤0), 1/0) → a,b,r null: máy báo Math
// ERROR — ĐÃ XÁC NHẬN 2026-08-27 (log x≤0) / 2026-08-28 (inverse x=0), còn
// 2-Variable Calc thô vẫn chạy.
//
// Toàn bộ tx/ty/fromCoef và a,b,r ĐÃ XÁC NHẬN 2026-08-28 bằng (1,3)(2,5)(3,8),
// khớp node từng chữ số (xem test). Ước lượng: inverse ŷ/x̂ và exp-ab x̂ đã bấm.
// Ước lượng `yhat`/`xhat` nhận (vars, value) — đọc vars.a/b(/c) — để statEstimate
// dispatch đồng nhất qua model[func]. Kiểu bậc 2 có hai nghiệm x̂₁/x̂₂ và không
// có x̂ đơn; các kiểu kia có x̂ đơn và không có x̂₁/x̂₂ — nên gọi nhầm sẽ ra hàm
// undefined và statEstimate báo lỗi, đúng như máy (menu mỗi kiểu chỉ đưa đúng
// các mục của nó).
const IDENT = (v) => v;
const COEF_AB = (A, B) => [A, B];
// Một nghiệm của cx²+bx+(a−y)=0, sign = +1 (x̂₁) hoặc −1 (x̂₂).
function statQuadRoot(v, y, sign) {
  const disc = v.b * v.b - 4 * v.c * (v.a - y);
  return (-v.b + sign * Math.sqrt(disc)) / (2 * v.c);
}
const STAT_REGRESSION_MODELS = {
  linear: {
    header: 'y=a+bx', tx: IDENT, ty: IDENT, fromCoef: COEF_AB,
    yhat: (v, x) => v.a + v.b * x,
    xhat: (v, y) => (y - v.a) / v.b
  },
  log: {
    header: 'y=a+b·ln(x)', tx: Math.log, ty: IDENT, fromCoef: COEF_AB,
    yhat: (v, x) => v.a + v.b * Math.log(x),
    xhat: (v, y) => Math.exp((y - v.a) / v.b)
  },
  'exp-e': {
    header: 'y=a·e^(bx)', tx: IDENT, ty: Math.log,
    fromCoef: (A, B) => [Math.exp(A), B],
    yhat: (v, x) => v.a * Math.exp(v.b * x),
    xhat: (v, y) => (Math.log(y) - Math.log(v.a)) / v.b
  },
  'exp-ab': {
    header: 'y=a·b^x', tx: IDENT, ty: Math.log,
    fromCoef: (A, B) => [Math.exp(A), Math.exp(B)],
    yhat: (v, x) => v.a * Math.pow(v.b, x),
    xhat: (v, y) => (Math.log(y) - Math.log(v.a)) / Math.log(v.b)
  },
  power: {
    header: 'y=a·x^b', tx: Math.log, ty: Math.log,
    fromCoef: (A, B) => [Math.exp(A), B],
    yhat: (v, x) => v.a * Math.pow(x, v.b),
    xhat: (v, y) => Math.exp((Math.log(y) - Math.log(v.a)) / v.b)
  },
  inverse: {
    header: 'y=a+b/x', tx: (x) => 1 / x, ty: IDENT, fromCoef: COEF_AB,
    yhat: (v, x) => v.a + v.b / x,
    xhat: (v, y) => v.b / (y - v.a)
  },
  // Bậc 2: ba hệ số a,b,c (không dùng tx/ty/fromCoef — giải hệ chuẩn tắc 3×3,
  // xem computeQuadratic). Regression Calc hiện a,b,c KHÔNG r. Nghịch đảo cho
  // hai nghiệm x̂₁ (+√) và x̂₂ (−√) — ĐÃ XÁC NHẬN 2026-08-28.
  quad: {
    header: 'y=a+bx+cx²', quadratic: true,
    yhat: (v, x) => v.a + v.b * x + v.c * x * x,
    xhat1: (v, y) => statQuadRoot(v, y, 1),
    xhat2: (v, y) => statQuadRoot(v, y, -1)
  }
};

function statRegressionModel(typeId) {
  return STAT_REGRESSION_MODELS[typeId] || STAT_REGRESSION_MODELS.linear;
}

// ===== Menu con OPTN ở màn hình tính =====
// Chọn một mục KHÔNG hiện kết quả ngay — nó chèn một TOKEN vào biểu thức đang
// gõ, rồi tính như phép tính thường: `Med+1 =` cho ra 4 với dữ liệu 1..5.
// Nhờ vậy bộ tính biểu thức sẵn có dùng lại được nguyên vẹn, chỉ thêm token.
//
// `token` là chuỗi đưa vào biểu thức; `key` là phím tắt; `field` là tên trường
// trong kết quả compute; `func` (nếu có) đánh dấu token HÀM HẬU TỐ (x̂, ŷ) ăn
// số đứng trước, khác token hằng số đứng một mình.

// -- Một biến --
const STAT_SUMMATION_MENU = [
  { key: '1', token: 'Σx', field: 'sumX' },
  { key: '2', token: 'Σx²', field: 'sumX2' }
];

const STAT_VARIABLE_MENU = [
  { key: '1', token: 'x̄', field: 'meanX' },
  { key: '2', token: 'σ²x', field: 'popVarX' },
  { key: '3', token: 'σx', field: 'popSdX' },
  { key: '4', token: 's²x', field: 'sampVarX' },
  { key: '5', token: 'sx', field: 'sampSdX' },
  { key: '6', token: 'n', field: 'n' }
];

const STAT_MINMAX_MENU = [
  { key: '1', token: 'min(x)', field: 'minX' },
  { key: '2', token: 'Q₁', field: 'q1' },
  { key: '3', token: 'Med', field: 'med' },
  { key: '4', token: 'Q₃', field: 'q3' },
  { key: '5', token: 'max(x)', field: 'maxX' }
];

// -- Hai biến (nội dung menu lấy từ manual tr.131-133) --
const STAT_TWOVAR_SUMMATION_MENU = [
  { key: '1', token: 'Σx', field: 'sumX' },
  { key: '2', token: 'Σx²', field: 'sumX2' },
  { key: '3', token: 'Σy', field: 'sumY' },
  { key: '4', token: 'Σy²', field: 'sumY2' },
  { key: '5', token: 'Σxy', field: 'sumXY' },
  { key: '6', token: 'Σx³', field: 'sumX3' },
  { key: '7', token: 'Σx²y', field: 'sumX2Y' },
  { key: '8', token: 'Σx⁴', field: 'sumX4' }
];

// ĐÃ XÁC NHẬN 2026-10-01: Variable hai biến chia 8 + 3 mục, hai cột.
const STAT_TWOVAR_VARIABLE_MENU = [
  { key: '1', token: 'x̄', field: 'meanX' },
  { key: '2', token: 'σ²x', field: 'popVarX' },
  { key: '3', token: 'σx', field: 'popSdX' },
  { key: '4', token: 's²x', field: 'sampVarX' },
  { key: '5', token: 'sx', field: 'sampSdX' },
  { key: '6', token: 'n', field: 'n' },
  { key: '7', token: 'ȳ', field: 'meanY' },
  { key: '8', token: 'σ²y', field: 'popVarY' },
  { key: '1', token: 'σy', field: 'popSdY' },
  { key: '2', token: 's²y', field: 'sampVarY' },
  { key: '3', token: 'sy', field: 'sampSdY' }
];

const STAT_TWOVAR_MINMAX_MENU = [
  { key: '1', token: 'min(x)', field: 'minX' },
  { key: '2', token: 'max(x)', field: 'maxX' },
  { key: '3', token: 'min(y)', field: 'minY' },
  { key: '4', token: 'max(y)', field: 'maxY' }
];

// x̂, ŷ là HÀM ước lượng ăn số đứng trước (`3ŷ`=a+b·3, `4x̂`=(4−a)/b) — ĐÃ XÁC
// NHẬN 2026-08-27. a, b, r là hằng số như mọi biến thống kê khác.
const STAT_REGRESSION_MENU = [
  { key: '1', token: 'a', field: 'a' },
  { key: '2', token: 'b', field: 'b' },
  { key: '3', token: 'r', field: 'r' },
  { key: '4', token: 'x̂', func: 'xhat' },
  { key: '5', token: 'ŷ', func: 'yhat' }
];

// Menu Regression của kiểu BẬC 2 — sáu mục, hai nghiệm x̂₁/x̂₂ — ĐÃ XÁC NHẬN
// 2026-08-28 (manual tr.137). `c` là hệ số bậc hai; `x̂₁`/`x̂₂` là hàm.
const STAT_QUAD_REGRESSION_MENU = [
  { key: '1', token: 'a', field: 'a' },
  { key: '2', token: 'b', field: 'b' },
  { key: '3', token: 'c', field: 'c' },
  { key: '4', token: 'x̂₁', func: 'xhat1' },
  { key: '5', token: 'x̂₂', func: 'xhat2' },
  { key: '6', token: 'ŷ', func: 'yhat' }
];

// Token → tên trường. Bộ tách token trong engine.js đọc bảng này, nên thêm
// biến mới chỉ phải khai một chỗ (ở menu bên trên). Cùng một token (vd 'x̄')
// dùng CHUNG một field ('meanX') cho cả một biến lẫn hai biến — nhờ đã đặt
// tên trường thống nhất — nên bảng phẳng này không có xung đột.
const STAT_TOKEN_FIELDS = {};
[
  STAT_SUMMATION_MENU, STAT_VARIABLE_MENU, STAT_MINMAX_MENU,
  STAT_TWOVAR_SUMMATION_MENU, STAT_TWOVAR_VARIABLE_MENU, STAT_TWOVAR_MINMAX_MENU,
  STAT_REGRESSION_MENU, STAT_QUAD_REGRESSION_MENU
].forEach((menu) => {
  menu.forEach((item) => {
    if (item.field) STAT_TOKEN_FIELDS[item.token] = item.field;
  });
});

// Menu con `Norm Dist` (OPTN màn hình tính MỘT BIẾN, trang 2 mục 4) — ĐÃ XÁC
// NHẬN 2026-08-28. Bốn mục: P(/Q(/R( là HÀM có ngoặc (chèn như sin/log, xem
// engine.js); ►t là hàm HẬU TỐ chuẩn hoá một giá trị theo dữ liệu. Menu này
// khai ở ui.js (mỗi mục chèn kiểu khác nhau), bảng đây chỉ để STAT_FUNC_TOKENS
// biết ►t là hàm 'tconv'.
const STAT_NORMDIST_FUNCS = [
  { token: '►t', func: 'tconv' }
];

// Token → tên hàm ('xhat'|'yhat'|'xhat1'|'xhat2'|'tconv'), riêng x̂/ŷ/x̂₁/x̂₂/►t.
const STAT_FUNC_TOKENS = {};
[STAT_REGRESSION_MENU, STAT_QUAD_REGRESSION_MENU, STAT_NORMDIST_FUNCS].forEach((menu) => {
  menu.forEach((item) => {
    if (item.func) STAT_FUNC_TOKENS[item.token] = item.func;
  });
});

// ===== Phân phối chuẩn (menu Norm Dist) =====
// CDF chuẩn tắc bằng xấp xỉ A&S 26.2.17 (sai số < 7,5×10⁻⁸). ĐÃ XÁC NHẬN
// 2026-08-28: bốn hàm P(/Q(/R(/►t. P/Q/R làm tròn kết quả về ĐÚNG 5 CHỮ SỐ
// THẬP PHÂN (giá trị nội bộ, không chỉ hiển thị — kiểm bằng phép trừ trên máy);
// xấp xỉ này sau khi tròn 5 khớp máy ở cả năm ca đã bấm (P(1)=0.84134,
// P(2)=0.97725, Q(1)=0.34134, R(1)=0.15866, R(3)=0.00135). ►t KHÔNG tròn.
function statNormPdf(x) {
  return Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
}
function statNormCDF(x) {
  const neg = x < 0;
  const z = Math.abs(x);
  const k = 1 / (1 + 0.2316419 * z);
  const poly = statNormPdf(z) * (0.319381530 * k - 0.356563782 * k * k +
    1.781477937 * k * k * k - 1.821255978 * k * k * k * k +
    1.330274429 * k * k * k * k * k);
  const cdf = 1 - poly;
  return neg ? 1 - cdf : cdf;
}
// Làm tròn về 5 chữ số thập phân — dùng cho P/Q/R.
function statNormRound5(v) {
  return Math.round(v * 1e5) / 1e5;
}
function statNormP(z) { return statNormRound5(statNormCDF(z)); }
function statNormQ(z) { return statNormRound5(statNormCDF(z) - 0.5); }
function statNormR(z) { return statNormRound5(1 - statNormCDF(z)); }

// ===== Tính toán =====

// Số chữ số thập phân của một tần suất. Chỉ dùng để biết phải nhân bao nhiêu
// cho tần suất thành số nguyên, nên chặn ở 9 chữ số là quá đủ.
const STAT_FREQ_MAX_DECIMALS = 9;

function statFreqDecimals(value) {
  if (Number.isInteger(value)) return 0;
  const text = value.toFixed(STAT_FREQ_MAX_DECIMALS).replace(/0+$/, '');
  const dot = text.indexOf('.');
  return dot < 0 ? 0 : text.length - dot - 1;
}

// min, max và ba tứ phân vị (theo cột `coord`, mặc định 'x') — năm giá trị
// DUY NHẤT phụ thuộc vào THỨ TỰ chứ không phải vào tổng.
//
// Cách máy làm (dò ra 2026-08-26 bằng bảy bộ dữ liệu, xem test): nhân MỌI tần
// suất với 10^d (d = số chữ số thập phân nhiều nhất) cho thành số nguyên,
// trải dãy ra, rồi áp đúng quy tắc LOẠI TRỪ trung vị. Ở đây không trải mảng ra
// thật — tần suất có thể rất lớn — mà tính thẳng "giá trị đứng ở vị trí thứ k".
//
// Quy tắc LOẠI TRỪ: nửa dưới là `half = ⌊N/2⌋` vị trí đầu, nửa trên là `half`
// vị trí cuối; số phần tử lẻ thì phần tử giữa KHÔNG thuộc nửa nào.
// ĐÃ XÁC NHẬN 2026-08-25 bằng dãy 1..7 — ca phân biệt được: quy tắc loại trừ
// cho Q₁ = trung vị của {1,2,3} = 2, quy tắc BAO GỒM cho 2.5. Máy hiện 2.
//
// Ba mô hình khác đã thử và BỊ BÁC BỎ khi bấm máy 2026-08-26:
//   • lấy giá trị ở vị trí n/4, (n+1)/4 hay (n−1)/4 trên tần suất THẬT —
//     sai ở ca (1,f2)(2,f1)(3,f0.5), máy cho Q₃ = 2 chứ không phải 2.5;
//   • cắt phần thập phân của tần suất — sai ở ca (1,f0.5)(2,f1): máy vẫn cho
//     min(x) = 1, tức dòng tần suất 0.5 KHÔNG bị bỏ đi;
//   • nội suy tuyến tính giữa hai giá trị kề — sai ở ca (1,f5.6)(2,f5)(0,f9),
//     máy cho Med = 1 đúng một giá trị có thật chứ không phải 0.726.
//
// Tần suất 0: dòng đó biến mất hoàn toàn khỏi năm giá trị này — ĐÃ XÁC NHẬN
// 2026-08-26, bảng (1,f0.5)(2,f1)(0,f0) vẫn cho min(x) = 1 chứ không phải 0.
function statOrderValues(rows, coord) {
  const key = coord || 'x';
  const used = rows.filter((row) => row.f > 0).sort((a, b) => a[key] - b[key]);
  const blank = { min: null, max: null, q1: null, med: null, q3: null };
  if (used.length === 0) return blank;

  let decimals = 0;
  used.forEach((row) => { decimals = Math.max(decimals, statFreqDecimals(row.f)); });
  const scale = Math.pow(10, decimals);
  const weights = used.map((row) => Math.round(row.f * scale));
  const total = weights.reduce((sum, w) => sum + w, 0);

  // Giá trị đứng ở vị trí thứ k (đếm từ 1) của dãy đã trải ra.
  function valueAt(k) {
    let seen = 0;
    for (let i = 0; i < used.length; i++) {
      seen += weights[i];
      if (k <= seen) return used[i][key];
    }
    return used[used.length - 1][key];
  }

  // Trung vị của đoạn vị trí [a, b] (đếm từ 1, tính cả hai đầu).
  function medianOfRange(a, b) {
    const len = b - a + 1;
    if (len % 2 === 1) return valueAt(a + (len - 1) / 2);
    return (valueAt(a + len / 2 - 1) + valueAt(a + len / 2)) / 2;
  }

  const med = medianOfRange(1, total);
  const half = Math.floor(total / 2);
  // Đúng một phần tử: cả ba tứ phân vị bằng chính nó — ĐÃ XÁC NHẬN
  // 2026-08-25, dãy chỉ có 5 thì Q₁ = Med = Q₃ = 5.
  return {
    min: used[0][key],
    max: used[used.length - 1][key],
    med,
    q1: half === 0 ? med : medianOfRange(1, half),
    q3: half === 0 ? med : medianOfRange(total - half + 1, total)
  };
}

// Tổng có trọng số f và các mômen của MỘT cột (x hoặc y). Phương sai tính
// bằng tổng bình phương ĐỘ LỆCH, không dùng Σx²/n − x̄²: công thức kia trừ hai
// số gần bằng nhau nên mất chính xác nặng khi số liệu lớn mà phân tán ít.
// Mẫu số n−1 dùng TỔNG TẦN SUẤT thật, kể cả khi nó là số lẻ — ĐÃ XÁC NHẬN
// 2026-08-26: bảng (1,f0.5)(2,f1) có n=1.5 và s²x=0.6666666667.
function statMoments(rows, n, key) {
  let sum = 0;
  rows.forEach((row) => { sum += row.f * row[key]; });
  const mean = sum / n;
  let sumSq = 0;
  rows.forEach((row) => { sumSq += row.f * (row[key] - mean) * (row[key] - mean); });
  const popVar = sumSq / n;
  const sampVar = n > 1 ? sumSq / (n - 1) : null;
  return {
    sum,
    mean,
    dev2: sumSq,
    popVar,
    popSd: Math.sqrt(popVar),
    sampVar,
    sampSd: sampVar === null ? null : Math.sqrt(sampVar)
  };
}

// Chuẩn hoá đầu vào: một phần tử SỐ TRẦN được hiểu là { x, f:1 } (tiện cho
// chỗ gọi và cho test một biến).
function statNormalizeRows(data) {
  return data.map((row) => (typeof row === 'number' ? { x: row, y: 0, f: 1 } : row));
}

// Toàn bộ giá trị thống kê MỘT BIẾN của một bảng số liệu { x, f }.
//
// n là TỔNG TẦN SUẤT, không phải số dòng — ĐÃ XÁC NHẬN 2026-08-26.
//
// `null` = "có tên nhưng không có giá trị", tức máy BỎ TRỐNG phần giá trị trên
// màn hình danh sách (không phải 0, cũng không phải lỗi), còn dùng token đó
// trong biểu thức rồi bấm "=" thì Math ERROR. Hai cảnh sinh null:
//   • s²x/sx khi n = 1 — ĐÃ XÁC NHẬN 2026-08-25.
//   • mọi giá trị trừ Σx, Σx², n khi tổng tần suất = 0 — ĐÃ XÁC NHẬN
//     2026-08-26: bảng (5, f0) mở được, hiện Σx=0, Σx²=0, n=0, bỏ trống phần
//     còn lại. Đây KHÁC bảng rỗng.
//
// Bảng rỗng thì throw — ĐÃ XÁC NHẬN 2026-08-25.
function computeStatistics(data) {
  if (data.length === 0) {
    throw new EngineError('Math ERROR');
  }
  const rows = statNormalizeRows(data);
  let n = 0;
  let sumX = 0;
  let sumX2 = 0;
  rows.forEach((row) => {
    n += row.f;
    sumX += row.f * row.x;
    sumX2 += row.f * row.x * row.x;
  });
  const order = statOrderValues(rows, 'x');
  if (n <= 0) {
    return {
      n, sumX, sumX2,
      meanX: null, popVarX: null, popSdX: null, sampVarX: null, sampSdX: null,
      minX: order.min, maxX: order.max, q1: order.q1, med: order.med, q3: order.q3
    };
  }
  const mx = statMoments(rows, n, 'x');
  return {
    n,
    sumX,
    sumX2,
    meanX: mx.mean,
    popVarX: mx.popVar,
    popSdX: mx.popSd,
    sampVarX: mx.sampVar,
    sampSdX: mx.sampSd,
    minX: order.min,
    maxX: order.max,
    q1: order.q1,
    med: order.med,
    q3: order.q3
  };
}

// Khớp đường thẳng từ các tổng độ lệch. Trả { A, B, r }:
//   B = Sxy/Sxx (slope), A = ȳ − B·x̄ (intercept), r = Sxy/√(Sxx·Syy).
// Sxx = 0 (mọi x bằng nhau, kể cả n=1) → KHÔNG khớp được: trả cả ba null để
// Regression Calc báo Math ERROR — ĐÃ XÁC NHẬN 2026-08-27 (n=1 và cùng x lỗi).
// Syy = 0 (mọi y bằng nhau) → A, B vẫn có (B=0) nhưng r là 0/0: máy để r BỎ
// TRỐNG chứ KHÔNG báo lỗi — ĐÃ XÁC NHẬN 2026-08-27 ((1,5)(3,5): a=5,b=0,r trống).
function statLinearFit(Sxx, Sxy, Syy, meanX, meanY) {
  if (!(Sxx > 0)) {
    return { A: null, B: null, r: null };
  }
  const B = Sxy / Sxx;
  const A = meanY - B * meanX;
  const r = Syy > 0 ? Sxy / Math.sqrt(Sxx * Syy) : null;
  return { A, B, r };
}

// Hồi quy trên dữ liệu ĐÃ BIẾN ĐỔI theo `model`. Trả { a, b, r } hiển thị —
// null cả ba khi có điểm biến đổi ra không hữu hạn (ln(≤0), 1/0) hoặc mọi
// tx(x) bằng nhau. a, b suy từ intercept/slope qua model.fromCoef (có kiểu
// lấy exp), nên hai kiểu exp/power cho a=exp(A) chứ không phải A.
function statTransformedRegression(rows, n, model) {
  const tx = rows.map((row) => model.tx(row.x));
  const ty = rows.map((row) => model.ty(row.y));
  if (tx.some((v) => !Number.isFinite(v)) || ty.some((v) => !Number.isFinite(v))) {
    return { a: null, b: null, r: null };
  }
  let sumTx = 0, sumTy = 0;
  rows.forEach((row, i) => { sumTx += row.f * tx[i]; sumTy += row.f * ty[i]; });
  const mtx = sumTx / n, mty = sumTy / n;
  let Stt = 0, Sty = 0, Syy = 0;
  rows.forEach((row, i) => {
    Stt += row.f * (tx[i] - mtx) * (tx[i] - mtx);
    Sty += row.f * (tx[i] - mtx) * (ty[i] - mty);
    Syy += row.f * (ty[i] - mty) * (ty[i] - mty);
  });
  const fit = statLinearFit(Stt, Sty, Syy, mtx, mty);
  if (fit.A === null) {
    return { a: null, b: null, r: null };
  }
  const [a, b] = model.fromCoef(fit.A, fit.B);
  return { a, b, r: fit.r };
}

// Giải hệ 3×3 M·[x0,x1,x2] = V bằng khử Gauss có chọn trụ. Trả mảng nghiệm,
// hoặc null nếu ma trận suy biến.
function statSolve3x3(M, V) {
  const a = [
    [M[0][0], M[0][1], M[0][2], V[0]],
    [M[1][0], M[1][1], M[1][2], V[1]],
    [M[2][0], M[2][1], M[2][2], V[2]]
  ];
  for (let col = 0; col < 3; col++) {
    let piv = col;
    for (let r = col + 1; r < 3; r++) {
      if (Math.abs(a[r][col]) > Math.abs(a[piv][col])) piv = r;
    }
    if (a[piv][col] === 0) return null;
    if (piv !== col) { const t = a[piv]; a[piv] = a[col]; a[col] = t; }
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const factor = a[r][col] / a[col][col];
      for (let k = col; k < 4; k++) a[r][k] -= factor * a[col][k];
    }
  }
  return [a[0][3] / a[0][0], a[1][3] / a[1][1], a[2][3] / a[2][2]];
}

// Hồi quy BẬC 2 y=a+bx+cx²: giải hệ chuẩn tắc 3×3 từ các tổng có trọng số f.
// Trả { a, b, c } — null cả ba khi có DƯỚI BA giá trị x khác nhau (ma trận suy
// biến) — ĐÃ XÁC NHẬN 2026-08-28: 2 điểm → Regression Calc Math ERROR. (Ba giá
// trị x khác nhau là điều kiện đúng-và-đủ để {1,x,x²} độc lập trên dữ liệu.)
function statQuadraticRegression(rows) {
  const used = rows.filter((row) => row.f > 0);
  const distinctX = new Set(used.map((row) => row.x));
  if (distinctX.size < 3) {
    return { a: null, b: null, c: null };
  }
  let n = 0, Sx = 0, Sx2 = 0, Sx3 = 0, Sx4 = 0, Sy = 0, Sxy = 0, Sx2y = 0;
  used.forEach((row) => {
    const x = row.x, y = row.y, f = row.f, x2 = x * x;
    n += f; Sx += f * x; Sx2 += f * x2; Sx3 += f * x2 * x; Sx4 += f * x2 * x2;
    Sy += f * y; Sxy += f * x * y; Sx2y += f * x2 * y;
  });
  const sol = statSolve3x3(
    [[n, Sx, Sx2], [Sx, Sx2, Sx3], [Sx2, Sx3, Sx4]],
    [Sy, Sxy, Sx2y]
  );
  if (sol === null) {
    return { a: null, b: null, c: null };
  }
  return { a: sol[0], b: sol[1], c: sol[2] };
}

// Toàn bộ giá trị thống kê HAI BIẾN + hồi quy của bảng { x, y, f }.
// `typeId` chọn phép biến đổi hồi quy (mặc định tuyến tính). Màn hình
// `2-Variable Calc` LUÔN là thống kê THÔ; chỉ a/b/r và x̂/ŷ theo phép biến đổi.
// Bảng rỗng → throw. Tổng tần suất = 0 → theo đúng khuôn một biến: giữ các
// tổng, bỏ trống phần dẫn xuất (CHƯA bấm riêng ca này ở hai biến, suy từ
// khuôn một biến đã xác nhận).
function computeTwoVariable(data, typeId) {
  if (data.length === 0) {
    throw new EngineError('Math ERROR');
  }
  const rows = statNormalizeRows(data);
  const model = statRegressionModel(typeId);
  let n = 0;
  let sumX = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0;
  let sumY = 0, sumY2 = 0, sumXY = 0, sumX2Y = 0;
  rows.forEach((row) => {
    const x = row.x, y = row.y, f = row.f;
    const x2 = x * x;
    n += f;
    sumX += f * x;
    sumX2 += f * x2;
    sumX3 += f * x2 * x;
    sumX4 += f * x2 * x2;
    sumY += f * y;
    sumY2 += f * y * y;
    sumXY += f * x * y;
    sumX2Y += f * x2 * y;
  });
  const orderX = statOrderValues(rows, 'x');
  const orderY = statOrderValues(rows, 'y');
  const sums = { n, sumX, sumX2, sumX3, sumX4, sumY, sumY2, sumXY, sumX2Y };
  const minmax = {
    minX: orderX.min, maxX: orderX.max, minY: orderY.min, maxY: orderY.max
  };
  // Hệ số hồi quy: bậc 2 giải hệ 3×3 (trả a,b,c); còn lại khớp tuyến tính trên
  // dữ liệu biến đổi (trả a,b,r). `reg` mang đúng các trường của kiểu, spread
  // vào kết quả — nên bậc 2 có `c`, các kiểu kia có `r`.
  const reg = model.quadratic
    ? statQuadraticRegression(rows)
    : (n <= 0 ? { a: null, b: null, r: null } : statTransformedRegression(rows, n, model));
  // `_model` để statEstimate biết dùng công thức ước lượng nào cho x̂/ŷ.
  if (n <= 0) {
    return {
      ...sums, ...minmax, _model: model,
      meanX: null, popVarX: null, popSdX: null, sampVarX: null, sampSdX: null,
      meanY: null, popVarY: null, popSdY: null, sampVarY: null, sampSdY: null,
      ...reg
    };
  }
  const mx = statMoments(rows, n, 'x');
  const my = statMoments(rows, n, 'y');
  return {
    ...sums,
    ...minmax,
    _model: model,
    meanX: mx.mean, popVarX: mx.popVar, popSdX: mx.popSd,
    sampVarX: mx.sampVar, sampSdX: mx.sampSd,
    meanY: my.mean, popVarY: my.popVar, popSdY: my.popSd,
    sampVarY: my.sampVar, sampSdY: my.sampSd,
    ...reg
  };
}

// Giá trị ước lượng từ hệ số hiển thị (trong bảng biến `vars`), theo công thức
// của kiểu đang chọn: gọi `model[func](vars, value)` với func ∈ {yhat, xhat,
// xhat1, xhat2}. Mỗi kiểu chỉ khai đúng các hàm của nó (bậc 2 có yhat/xhat1/
// xhat2, các kiểu kia có yhat/xhat), nên gọi nhầm func → hàm undefined → Math
// ERROR, đúng như máy (menu mỗi kiểu chỉ đưa đúng mục của nó).
//   a null (kể cả bậc 2 suy biến) → Math ERROR.
//   Kết quả không hữu hạn → Math ERROR (b=0 chia 0; ŷ inverse tại v=0; x̂
//   exp/power tại v≤0; x̂₁/x̂₂ khi biệt thức < 0).
// ĐÃ XÁC NHẬN 2026-08-27/28: tuyến tính `3ŷ`=4, log `2ŷ`=3.930123331, inverse
// `2ŷ`=6.076923077 & `6x̂`=1.95505618, exp-ab `5x̂`=2.027746586, bậc 2 `2ŷ`=4.4
// & `7x̂₁`=2.834119409 & `7x̂₂`=-4.234119409, `0x̂₁`→lỗi.
function statEstimate(func, value, vars) {
  // ►t: chuẩn hoá một giá trị theo dữ liệu MỘT BIẾN — t = (x − x̄)/σx (σx là
  // độ lệch chuẩn TỔNG THỂ, popSdX). ĐÃ XÁC NHẬN 2026-08-28 (5►t=1.414213562
  // với dữ liệu 1..5). Không đi qua hệ số hồi quy nên xét TRƯỚC.
  if (func === 'tconv') {
    const result = (value - vars.meanX) / vars.popSdX;
    if (!Number.isFinite(result)) {
      throw new EngineError('Math ERROR');
    }
    return result;
  }
  if (vars.a === null || vars.a === undefined || vars.b === null || vars.b === undefined) {
    throw new EngineError('Math ERROR');
  }
  const model = vars._model || STAT_REGRESSION_MODELS.linear;
  const fn = model[func];
  if (typeof fn !== 'function') {
    throw new EngineError('Math ERROR');
  }
  const result = fn(vars, value);
  if (!Number.isFinite(result)) {
    throw new EngineError('Math ERROR');
  }
  return result;
}
