// UI Tầng 0-4: nắm DOM, gọi engine, rồi vẽ lại màn hình.
// Không chứa logic tính toán — mọi thay đổi dữ liệu đều đi qua engine.
// SHIFT/MENU là khái niệm thuộc UI (đổi UI gọi hàm engine nào khi bấm một
// phím vật lý), không đụng tới engine — khác với ALPHA/STO vốn là trạng
// thái tính toán thật sự, đã nằm sẵn trong engine.js.

// ===== Cuộn ngang dòng kết quả =====
// ĐÃ XÁC NHẬN 2026-08-23 trên bản giả lập chính hãng, bằng ca 1÷17 rồi S⇔D.
// Chuỗi đầy đủ là "0.⟨0588235294117647⟩" — 20 ký tự, đánh số từ 0.
// Bốn màn hình đọc được, và chỉ số ký tự tương ứng:
//   bấm 0 lần ▶:  0.⟨0588235294117▸    ký tự 0-15  (16 ký tự, KHÔNG có ◂)
//   bấm 1 lần:    ◂⟨05882352941176▸    ký tự 2-16  (15 ký tự)
//   bấm 2 lần:    ◂058823529411764▸    ký tự 3-17
//   bấm 4 lần:    ◂588235294117647⟩    ký tự 4-19  (16 ký tự, hết ▸)
//
// Rút ra: màn hình rộng 17 Ô. Mũi tên CHIẾM MỘT Ô mỗi khi xuất hiện, nên
// phần chữ khi thì 16 ô (chỉ một mũi tên) khi thì 15 ô (cả hai). Mỗi lần bấm
// ▶ đẩy MÉP PHẢI đi đúng một ký tự — đó mới là đại lượng chạy đều, chứ không
// phải mép trái (mép trái nhảy từ 0 sang 2 ở lần bấm đầu, vì lúc đó ◂ mọc ra
// và ăn mất một ô).
//
// Tới hai đầu thì bấm thêm KHÔNG làm gì: không quay vòng, và quan trọng hơn
// là KHÔNG rơi xuống hành vi "◀▶ mở kết quả ra sửa" của engine (đã bấm riêng
// hai ca ở mép trái và mép phải, màn hình đứng yên).
//
// Bản trước cắt lấy 15 ký tự CUỐI rồi thêm dấu "<": hiện phần ĐUÔI thay vì
// phần ĐẦU, và không cuộn được. Sai cả chỗ hiện lẫn chỗ bấm phím.
const SCREEN_COLUMNS = 17;

// Vị trí cuộn, lưu bằng CHỈ SỐ KÝ TỰ CUỐI CÙNG đang hiện. Thuộc về UI chứ
// không phải engine: đây thuần tuý là chuyện phần nào của chuỗi lọt vào khung
// nhìn, không đụng tới giá trị tính toán.
let resultScrollEnd = 0;
// Chuỗi đang được cuộn. Khác đi thì vị trí cuộn phải đặt lại — nếu không, bấm
// = ra kết quả mới sẽ thừa hưởng vị trí cuộn của kết quả cũ.
let resultScrollText = null;
// Structured inequalities retain radical/fraction nodes while scrolling the
// rendered viewport. Position is display state only, never a numeric value.
let inequalityScrollKey = null;
let inequalityScrollOffset = 0;
function syncInequalityScroll(key) {
  if (key !== inequalityScrollKey) { inequalityScrollKey = key; inequalityScrollOffset = 0; }
}
function positionInequalityScroll(line) {
  const viewport = line.querySelector('.inequality-scroll-viewport');
  if (!viewport || typeof viewport.scrollWidth !== 'number') return;
  const content = viewport.querySelector('.inequality-scroll-content');
  if (!viewport.clientWidth || !content.offsetWidth) return;
  const max = Math.max(0, content.offsetWidth - viewport.clientWidth);
  const offset = Math.max(0, Math.min(inequalityScrollOffset, max));
  // A temporarily hidden/resized tab must not erase the user's position.
  viewport.dataset.offset = String(offset);
  content.style.transform = 'translateX(' + (-offset) + 'px)';
  line.dataset.left = String(offset > .5);
  line.dataset.right = String(offset < max - .5);
}
function isScrollable(text) {
  return typeof text === 'string' && text.length > SCREEN_COLUMNS;
}

// Mép phải nhỏ nhất: lúc chưa cuộn, chữ chiếm 16 ô rồi tới ▸.
function minScrollEnd() {
  return SCREEN_COLUMNS - 2;
}

function syncResultScroll(text) {
  if (text !== null) syncInequalityScroll(null);
  if (text !== resultScrollText) {
    resultScrollText = text;
    resultScrollEnd = minScrollEnd();
  }
  if (isScrollable(text)) {
    resultScrollEnd = Math.max(minScrollEnd(), Math.min(resultScrollEnd, text.length - 1));
  }
}

// Dựng dòng kết quả kèm mũi tên. Chuỗi vừa màn hình thì trả nguyên văn.
function scrollWindow(text) {
  if (!isScrollable(text)) return text;
  const last = Math.max(minScrollEnd(), Math.min(resultScrollEnd, text.length - 1));
  const hasRight = last < text.length - 1;
  // Bề rộng phần chữ = 17 ô trừ đi các ô mà mũi tên chiếm. Mũi tên trái có
  // mặt khi phần chữ chưa bắt đầu từ ký tự đầu tiên; tính ngược từ mép phải.
  // Thử TRƯỚC với giả định không có mũi tên trái. Nếu tính ra vẫn còn ký tự
  // nằm ngoài bên trái thì mới cần ◂, và lúc đó phần chữ hụt đi một ô.
  // Làm ngược lại (giả định CÓ ◂ rồi kiểm) là sai: ở vị trí chưa cuộn nó
  // cho ra ◂ thừa, trong khi máy không hiện mũi tên trái lúc đó.
  const widthWithoutLeft = SCREEN_COLUMNS - (hasRight ? 1 : 0);
  const hasLeft = last - widthWithoutLeft + 1 > 0;
  const width = widthWithoutLeft - (hasLeft ? 1 : 0);
  const first = Math.max(0, last - width + 1);
  return (hasLeft ? '◂' : '') + text.slice(first, last + 1) + (hasRight ? '▸' : '');
}

// Cuộn dòng kết quả. Trả về true nếu phím đã được DÙNG cho việc cuộn — lúc đó
// bộ bắt phím không chuyển ◀▶ xuống engine nữa, kể cả khi đang ở mép và không
// cuộn thêm được.
function scrollResult(direction) {
  const richLine = inequalityScrollKey !== null && resultScrollText === null
    ? screenEl.querySelector('.inequality-result') : null;
  if (richLine) {
    const viewport = richLine.querySelector('.inequality-scroll-viewport');
    const step = viewport && typeof getComputedStyle === 'function'
      ? parseFloat(getComputedStyle(viewport).fontSize) * 11 / 16 : 16;
    inequalityScrollOffset = Math.max(0, Number(viewport.dataset.offset || 0) + (direction === 'right' ? step : -step));
    positionInequalityScroll(richLine);
    return true;
  }
  if (!isScrollable(resultScrollText)) return false;
  const next = resultScrollEnd + (direction === 'right' ? 1 : -1);
  if (next >= minScrollEnd() && next <= resultScrollText.length - 1) {
    resultScrollEnd = next;
    render();
  }
  return true;
}
// Thứ tự 12 mode lấy từ manual (docs/manual-plain.txt, PDF trang 8-9) — CHÚ Ý
// thứ tự này từng bị sai: Table đứng TRƯỚC Equation/Func, không phải sau.
//
// Phím tắt 1–9 bấm thẳng; A/B/C nhận (-) / °′″ / x⁻¹ có hoặc không ALPHA.
// Đã bấm lại A trần trên CASIO ngày 2026-10-01; không bắt buộc ALPHA.
//
// `id` chỉ có ở mode đã làm — mode chưa làm để trống nên không chọn được.
const MODE_LIST = [
  { key: '1', name: 'Calculate', id: 'calculate' },
  { key: '2', name: 'Complex', id: 'complex' },
  { key: '3', name: 'Base-N', id: 'base-n' },
  { key: '4', name: 'Matrix', id: 'matrix' },
  { key: '5', name: 'Vector', id: 'vector' },
  { key: '6', name: 'Statistics', id: 'statistics' },
  { key: '7', name: 'Distribution', id: 'distribution' },
  { key: '8', name: 'Table', id: 'table' },
  { key: '9', name: 'Equation/Func', id: 'equation' },
  { key: 'A', name: 'Inequality', id: 'inequality' },
  { key: 'B', name: 'Verify', id: 'verify' },
  { key: 'C', name: 'Ratio', id: 'ratio' }
];

// ĐÃ XÁC NHẬN 2026-09-29 trực tiếp trên MENU của CASIO tiếng Việt.
// Giữ MODE_LIST làm nguồn tên tiếng Anh/ID duy nhất; lớp này chỉ đổi chữ hiển thị.
const MODE_LABELS_VI = {
  'Calculate': 'Ptính thường',
  'Complex': 'Số phức',
  'Base-N': 'Hệ đếm cơ số N',
  'Matrix': 'Ma trận',
  'Vector': 'Vecto',
  'Statistics': 'Thống kê',
  'Distribution': 'Phân phối',
  'Table': 'Bảng giá trị',
  'Equation/Func': 'Ptrình/HệPtrình',
  'Inequality': 'Bất Ptrình',
  'Verify': 'Đúng/Sai',
  'Ratio': 'Tỉ lệ thức'
};

// Mode có menu OPTN riêng. Mode không nằm ở đây thì phím OPTN để mờ.
const OPTN_MODES = ['calculate', 'complex', 'verify', 'ratio', 'equation', 'inequality', 'statistics', 'distribution', 'base-n', 'matrix', 'vector'];

// ĐÃ XÁC NHẬN 2026-09-11: OPTN Complex có hai trang, trang đầu bốn hàm,
// trang sau hai hậu tố ép dạng kết quả. C2 nối từng mục vào engine; tên và
// thứ tự vẫn giữ tách riêng để test canh đúng menu máy thật.
const COMPLEX_OPTN_PAGES = [
  ['Argument', 'Conjugate', 'Real Part', 'Imaginary Part'],
  ['▶r∠θ', '▶a+bi']
];
const COMPLEX_OPTN_PAGES_VI = [
  ['Acgumen', 'Sốphức liên hợp', 'Phần thực', 'Phần ảo'],
  ['▶r∠θ', '▶a+bi']
];

// Menu OPTN ở mode Verify — ĐÃ XÁC NHẬN bằng ảnh chụp máy thật 2026-08-17:
// đúng là phím OPTN, và menu có HAI TRANG, cuộn bằng ▲▼.
//   Trang 1: sáu toán tử quan hệ, đánh số 1-6 (máy xếp hai cột, ta xếp một
//            cột — chỉ khác cách trình bày, chuỗi phím vẫn y hệt).
//   Trang 2: Hyperbolic Func / Angle Unit / Engineer Symbol — chưa làm trong Verify.
// Lưu ý: sáu mục trên MỘT trang bác bỏ ghi chú của Excel "Key Sequence
// Legend" rằng menu phụ chỉ dùng số 1-4 mỗi trang.
const VERIFY_OPTN_PAGE1 = ['=', '≠', '>', '<', '≥', '≤'];
const VERIFY_OPTN_PAGE2 = ['Hyperbolic Func', 'Angle Unit', 'Engineer Symbol'];

// Menu "Select Type" của mode Ratio (manual trang 178 bước 2). Lấy nhãn và
// thứ tự từ RATIO_TYPES trong ratio.js để không phải khai báo hai nơi.
const RATIO_TYPE_MENU = RATIO_TYPES;

const RECALL_VARIABLE_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'M', 'x', 'y', 'z'];

const engine = createEngine();
const screenEl = document.getElementById('screen');
const angleUnitBadgeEl = document.getElementById('angle-unit-badge');
const ioBadgeEl = document.getElementById('io-badge');
const memoryBadgeEl = document.getElementById('memory-badge');
const shiftBadgeEl = document.getElementById('shift-badge');
const alphaBadgeEl = document.getElementById('alpha-badge');
const storeBadgeEl = document.getElementById('store-badge');
const scrollBadgeEl = document.getElementById('scroll-badge');
const modeOverlayEl = document.getElementById('mode-overlay');
const modeListEl = document.getElementById('mode-list');
const recallOverlayEl = document.getElementById('recall-overlay');
const recallListEl = document.getElementById('recall-list');
const numberFormatBadgeEl = document.getElementById('number-format-badge');
const engineerBadgeEl = document.getElementById('engineer-badge');
const complexBadgeEl = document.getElementById('complex-badge');
const modeCornerEl = document.getElementById('mode-corner');
const setupOverlayEl = document.getElementById('setup-overlay');
const setupListEl = document.getElementById('setup-list');
const optnOverlayEl = document.getElementById('optn-overlay');
const optnListEl = document.getElementById('optn-list');
const optnKeyEl = document.getElementById('optn-key');
const calcKeyEl = document.getElementById('calc-key');
const shiftKeyEl = document.getElementById('shift-key');
const alphaKeyEl = document.getElementById('alpha-key');
const screenWrapEl = document.getElementById('screen-wrap');

let shiftActive = false;
let uiLanguage = 'en';
let contrastAdjusting = false;
let contrastLevel = 3;
const CONTRAST_MIN = 0;
const CONTRAST_MAX = 6;

// ALPHA/STO đều cần bấm phím biến (A-F hoặc x) ngay sau đó để hoàn tất — engine
// đã tự xử lý việc đó (pendingRegister trong engine.js), pendingVariableMode
// ở đây chỉ là bản UI dùng để quyết định CÓ gọi engine.inputVariable() hay
// không khi phím kế tiếp được bấm; không cần đọc lại state từ engine.
let pendingVariableMode = null; // null | 'sto' | 'alpha'

function setShiftActive(value) {
  shiftActive = value;
  shiftKeyEl.classList.toggle('active', shiftActive);
  shiftBadgeEl.textContent = shiftActive ? 'S' : '';
}

function setAlphaActive(value) {
  alphaKeyEl.classList.toggle('active', value);
  alphaBadgeEl.textContent = value ? 'A' : '';
}

function isOverlayOpen() {
  return !modeOverlayEl.hidden || !recallOverlayEl.hidden || !setupOverlayEl.hidden
    || !optnOverlayEl.hidden;
}

function closeOverlays() {
  modeOverlayEl.hidden = true;
  recallOverlayEl.hidden = true;
  setupOverlayEl.hidden = true;
  optnOverlayEl.hidden = true;
  modeMenuActive = false;
  openMenuPages = null;
  openMenuBack = null;
  openMenuEls = null;
  openMenuPageIndex = 0;
  pendingDigitPrompt = null;
  contrastAdjusting = false;
  resetDialog = null;
  setupListEl.classList.remove('contrast-list');
  if (menuAlphaActive) setMenuAlphaActive(false);
}

// ===== Menu chọn bằng phím =====
// Manual trang 7: "chọn một mục menu bằng cách nhấn phím số tương ứng với số
// ở bên trái của mục". Menu chính còn dùng thêm (-) / °′″ / x⁻¹ làm nhãn
// A/B/C. Đây là cơ chế dùng chung cho MENU, SETUP và OPTN — mỗi mode mới của
// Tầng 7 chỉ việc gọi openMenu() thay vì tự dựng overlay riêng.
//
// Vẫn giữ click chuột song song vì phần mềm chạy trên web, nhưng phím mới là
// đường đúng với máy thật.
// Menu đang mở, dạng nhiều trang: openMenuPages là mảng các trang, mỗi trang
// là mảng mục. Máy thật cuộn trang bằng ▲▼ (xác nhận qua ảnh menu OPTN hai
// trang, 2026-08-17). Menu một trang chỉ là trường hợp riêng có một phần tử.
let resetDialog = null; // { kind, phase: 'menu' | 'confirm' | 'done' }
let openMenuPages = null;
let openMenuPageIndex = 0;
let openMenuEls = null;
let openMenuCompactLabels = false;
let openMenuGlobalKeys = false;
let openMenuBack = null;
let openMenuLayouts = ['list'];
let modeMenuActive = false;
let modeMenuIndex = 0;
let modeMenuFirstRow = 0;
// Đã bấm ALPHA trong lúc menu đang mở — cần cho nhãn A/B/C ở menu chính.
let menuAlphaActive = false;
// Có mục không chọn xong ngay mà hỏi thêm một CHỮ SỐ. ĐÃ XÁC NHẬN
// 2026-08-21 trên bản giả lập chính hãng: ở Number Format, chọn 1:Fix thì
// danh sách "1:Fix 2:Sci 3:Norm" VẪN NGUYÊN trên màn hình, chỉ mọc thêm
// dòng thứ tư "Fix:Select 0~9"; tương tự "Sci:Select 0~9" và
// "Norm:Select 1~2". Vì vậy đây là một dòng phụ vẽ KÈM danh sách, không
// phải một màn hình khác.
// { label, min, max, apply(digit) }
let pendingDigitPrompt = null;

function openMenu(overlayEl, listEl, pages, title, options = {}) {
  closeOverlays();
  if (overlayEl === optnOverlayEl) options = { hideTitle: true, compactLabels: true, ...options };
  openMenuLayouts = options.layouts || ['list'];
  overlayEl.dataset.kind = options.kind || '';
  openMenuPages = pages;
  openMenuBack = options.onBack || null;
  openMenuPageIndex = 0;
  openMenuCompactLabels = Boolean(options.compactLabels);
  openMenuGlobalKeys = Boolean(options.globalKeys);
  openMenuEls = { overlayEl, listEl };
  // Một overlay được dùng lại cho nhiều menu khác nhau (OPTN đổi nội dung
  // theo mode), nên tiêu đề đặt lúc mở chứ không cố định trong HTML.
  const titleEl = overlayEl.querySelector('.overlay-title');
  titleEl.style.display = options.hideTitle ? 'none' : '';
  titleEl.style.whiteSpace = '';
  if (title) {
    titleEl.textContent = title;
  }
  overlayEl.hidden = false;
  drawMenuPage();
}

function drawMenuPage() {
  const { overlayEl, listEl } = openMenuEls;
  listEl.innerHTML = '';
  if(overlayEl.dataset.kind==='constants') overlayEl.dataset.scroll = openMenuBack ? '◀' : (openMenuPageIndex===0?'▼':openMenuPageIndex===openMenuPages.length-1?'▲':'▲▼');
  listEl.dataset.layout = openMenuLayouts[openMenuPageIndex] || openMenuLayouts[0];
  openMenuPages[openMenuPageIndex].forEach((item) => {
    const li = document.createElement('li');
    const disabled = !item.onSelect;
    li.dataset.disabled = String(disabled);
    li.textContent = item.key + (openMenuCompactLabels ? ':' : ': ') + (item.constant ? '' : item.name);
    if(item.constant) li.appendChild(renderScientificSymbol(item.constant));
    if (!disabled) {
      li.addEventListener('click', () => runMenuItem(item));
    }
    listEl.appendChild(li);
  });
  if (pendingDigitPrompt) {
    const li = document.createElement('li');
    li.dataset.disabled = 'true';
    li.textContent = pendingDigitPrompt.label;
    listEl.appendChild(li);
  }
}

function moveMenuPage(step) {
  if (!openMenuPages || openMenuPages.length < 2) return;
  const count = openMenuPages.length;
  openMenuPageIndex = (openMenuPageIndex + step + count) % count;
  drawMenuPage();
}

function setMenuAlphaActive(value) {
  menuAlphaActive = value;
  setAlphaActive(value);
}

function runMenuItem(item) {
  // Đóng TRƯỚC khi chạy: có mục lại mở tiếp một menu con (SETUP → Angle
  // Unit), đóng sau sẽ đóng nhầm menu con vừa mở.
  closeOverlays();
  item.onSelect();
  render();
}

function applyDigitPrompt(digit) {
  if (digit === undefined) return;
  const value = Number(digit);
  const { min, max, apply } = pendingDigitPrompt;
  // Ngoài khoảng thì bỏ qua, giữ nguyên dòng hỏi.
  if (!(value >= min && value <= max)) return;
  closeOverlays();
  apply(value);
  render();
}

function selectMenuByKey(key) {
  if (!openMenuPages || key === undefined) return false;
  const candidates = openMenuGlobalKeys
    ? openMenuPages.flat()
    : openMenuPages[openMenuPageIndex];
  const item = candidates
    .find((entry) => entry.key === key && entry.onSelect);
  if (!item) return false;
  runMenuItem(item);
  return true;
}

// MENU chính CASIO: lưới 4 cột, cửa sổ 2 hàng; ▲▼ ±4, ◀▶ ±1,
// quay vòng 12 mục. Đã bấm trên ClassPad ngày 2026-10-01.
// [ĐÃ XÁC NHẬN 2026-11-03] 12 ô menu và mặt nạ chọn từ LCD CASIO.
// Mỗi ô47×23, bước48×24; SVG chứa cả icon, nhãn phím và đường viền.
function openModeOverlay() {
  const current = engine.getCalcMode();
  const items = MODE_LIST.map((mode) => ({
    key: mode.key,
    name: uiLanguage === 'vi' ? MODE_LABELS_VI[mode.name] : mode.name,
    onSelect: () => enterCalcMode(mode.id)
  }));
  openMenu(modeOverlayEl, modeListEl, [items], '', { hideTitle: true, globalKeys: true });
  modeMenuActive = true;
  modeMenuIndex = Math.max(0, MODE_LIST.findIndex(mode => mode.id === current));
  modeMenuFirstRow = modeMenuIndex >= 8 ? 1 : 0;
  drawModeGrid();
}

function drawModeGrid() {
  modeListEl.innerHTML = '';
  modeOverlayEl.dataset.scroll = modeMenuFirstRow ? '▲' : '▼';
  const first = modeMenuFirstRow * 4;
  MODE_LIST.slice(first, first + 8).forEach((mode, offset) => {
    const index = first + offset;
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'mode-tile';
    button.dataset.selected = String(index === modeMenuIndex);
    const name = uiLanguage === 'vi' ? MODE_LABELS_VI[mode.name] : mode.name;
    button.setAttribute('aria-label', mode.key + ': ' + name);
    button.setAttribute('aria-pressed', String(index === modeMenuIndex));
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('class', 'mode-icon');
    icon.setAttribute('viewBox', '0 0 47 23');
    icon.setAttribute('aria-hidden', 'true');
    const artwork = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    artwork.setAttribute('href', 'assets/menu-tiles.svg#mode-' + index +
      (index === modeMenuIndex ? '-selected' : '-normal'));
    icon.appendChild(artwork);
    button.appendChild(icon);
    button.addEventListener('click', () => selectMenuByKey(mode.key));
    li.appendChild(button);
    modeListEl.appendChild(li);
  });
  const mode = MODE_LIST[modeMenuIndex];
  document.getElementById('mode-selection').textContent = mode.key + ':' +
    (uiLanguage === 'vi' ? MODE_LABELS_VI[mode.name] : mode.name);
}

function moveModeSelection(direction) {
  const steps = { up: -4, down: 4, left: -1, right: 1 };
  modeMenuIndex = (modeMenuIndex + steps[direction] + MODE_LIST.length) % MODE_LIST.length;
  const row = Math.floor(modeMenuIndex / 4);
  if (row < modeMenuFirstRow) modeMenuFirstRow = row;
  if (row > modeMenuFirstRow + 1) modeMenuFirstRow = row - 1;
  drawModeGrid();
}

// Vào mode Ratio là máy hỏi ngay kiểu tỷ lệ (manual trang 178 bước 2), nên
// việc chọn mode và việc mở menu con đi liền nhau.
function enterCalcMode(id) {
  engine.setCalcMode(id);
  if (id === 'ratio') {
    openRatioTypeOverlay();
  } else if (id === 'equation') {
    openEquationTypeOverlay();
  } else if (id === 'statistics') {
    openStatisticsTypeOverlay();
  } else if (id === 'distribution') {
    openDistributionTypeOverlay();
  }
}

function openRatioTypeOverlay() {
  openMenu(optnOverlayEl, optnListEl, [RATIO_TYPE_MENU.map((type, i) => ({
    key: String(i + 1),
    name: type.label,
    onSelect: () => engine.setRatioType(type.id)
  }))], uiText('Ratio — Select Type', 'Tỉ lệ thức — Chọn kiểu tính'), {
    hideTitle: true,
    compactLabels: true
  });
}

// Select Type của Equation/Func là menu HAI CẤP (manual trang 164):
// 1: Simul Equation → chọn số ẩn 2/3/4; 2: Polynomial → chọn bậc 2/3/4.
// Số phím của cấp hai chính là số ẩn/bậc, nên EQUATION_TYPES giữ sẵn `key`.
function openEquationTypeOverlay() {
  openMenu(optnOverlayEl, optnListEl, [[
    { key: '1', name: uiText('Simul Equation', 'Hệ phương trình'), onSelect: () => openEquationGroupOverlay('simul') },
    { key: '2', name: uiText('Polynomial', 'Phương trình'), onSelect: () => openEquationGroupOverlay('poly') }
  ]], uiText('Equation — Select Type', 'Ptrình/HệPtrình'), {
    hideTitle: true,
    compactLabels: true
  });
}

function equationGroupPrompt(group) {
  return group === 'simul'
    ? { title: uiText('Simul Equation\nNumber of\n     Unknowns?', 'Hệ phương trình\nSố lượng ẩn số?'), prompt: uiText('Select 2~4', 'Chọn 2~4') }
    : { title: uiText('Polynomial\nDegree?', 'Phương trình\nđa thức bậc?'), prompt: uiText('Select 2~4', 'Chọn 2~4') };
}

function openEquationGroupOverlay(group) {
  const localized = equationGroupPrompt(group);
  const items = EQUATION_TYPES.filter(type => type.group === group).map(type => ({
    key: type.key, name: type.label,
    onSelect: type.ready ? () => engine.setEquationType(type.id) : null
  }));
  openMenu(optnOverlayEl, optnListEl, [items], localized.title, { hideTitle: false });
  optnOverlayEl.querySelector('.overlay-title').style.whiteSpace = 'pre-wrap';
  optnListEl.innerHTML = '';
  const prompt = document.createElement('li');
  prompt.dataset.disabled = 'false';
  prompt.textContent = localized.prompt;
  optnListEl.appendChild(prompt);
}

// Bảng chọn ký hiệu kỹ thuật để GÕ VÀO biểu thức (khác mục SETUP cùng tên,
// vốn chỉ đổi cách HIỂN THỊ kết quả). Máy thật xếp 11 ký hiệu thành lưới 3
// cột với phím tắt 1-9 rồi A, B — UI xếp đúng ba cột và
// giữ NGUYÊN phím tắt để trình tự bấm không lệch. ENGINEER_SYMBOL_MENU nằm ở
// engine.js vì đó là dữ liệu của máy, không phải của giao diện.
function openEngineerSymbolPicker() {
  openMenu(optnOverlayEl, optnListEl, [ENGINEER_SYMBOL_MENU.map((item) => ({
    key: item.key,
    name: item.symbol,
    onSelect: () => engine.inputEngineerSymbol(item.symbol)
  }))], uiText('OPTN — Engineer Symbol', 'OPTN — Ký hiệu kĩ thuật'), { kind: 'engineering', layouts: ['three-column'], onBack: reopenCommonOptnPage });
}

// Select Type của Statistics: 8 kiểu chia HAI TRANG, mỗi trang đánh số 1-4
// (▲▼ lật trang) — ĐÃ XÁC NHẬN 2026-08-25. Mới làm 1-Variable, bảy kiểu hồi
// quy để mờ nhưng vẫn liệt kê đủ để số thứ tự khớp máy.
function openStatisticsTypeOverlay() {
  const pages = [0, 1].map((page) => STATISTICS_TYPES
    .filter((type) => type.page === page)
    .map((type) => ({
      key: type.key,
      name: type.ready
        ? (uiLanguage === 'vi' && type.id === '1var' ? 'Tính tkê 1-biến' : type.label)
        : type.label + ' (chưa làm)',
      onSelect: type.ready ? () => engine.setStatisticsType(type.id) : null
    })));
  openMenu(optnOverlayEl, optnListEl, pages,
    uiText('Statistics — Select Type', 'Thống kê — Chọn kiểu tính'), {
      hideTitle: true,
      compactLabels: true
    });
}

// Distribution có bảy loại. Trang hai đánh số lại 1-3 đúng bản giả lập.
// Ba loại chuẩn đi thẳng tới form; bốn loại rời rạc hỏi List/Variable trước.
function openDistributionTypeOverlay() {
  const pages = [0, 1].map((page) => DISTRIBUTION_TYPES
    .filter((type) => type.page === page)
    .map((type) => ({
      key: type.key,
      name: type.ready ? distributionTypeLabel(type) : type.label + ' (chưa làm)',
      onSelect: type.ready ? () => {
        if (type.needsInputMethod) openDistributionInputOverlay(type.id);
        else engine.setDistributionType(type.id);
      } : null
    })));
  openMenu(optnOverlayEl, optnListEl, pages,
    uiText('Distribution — Select Type', 'Phân phối — Chọn kiểu tính'), {
      hideTitle: true,
      compactLabels: true
    });
}

const DISTRIBUTION_LABELS_VI = {
  'normal-pd': 'Mđộ xsuất chuẩn',
  'normal-cd': 'Pp tlũy chuẩn',
  'inverse-normal': 'Ngược pptl chuẩn',
  'binomial-pd': 'Xsuất nhị thức',
  'binomial-cd': 'Pp tlũy nhị thức',
  'poisson-pd': 'Xsuất Poisson',
  'poisson-cd': 'Pp tlũy Poisson'
};

function distributionTypeLabel(type) {
  return uiLanguage === 'vi' ? DISTRIBUTION_LABELS_VI[type.id] : type.label;
}

function localizeDistributionTypeLabel(label) {
  if (uiLanguage !== 'vi') return label;
  const type = DISTRIBUTION_TYPES.find((item) => item.label === label);
  return type ? DISTRIBUTION_LABELS_VI[type.id] : label;
}

// Bốn phân phối rời rạc hỏi cách nhập List/Variable trước khi mở màn hình.
// ĐÃ XÁC NHẬN 2026-09-11: cả bốn loại đều dùng đúng hai mục này.
function openDistributionInputOverlay(typeId) {
  const type = DISTRIBUTION_TYPES.find((item) => item.id === typeId);
  if (!type || !type.ready || !type.needsInputMethod) return;
  openMenu(optnOverlayEl, optnListEl, [[
    { key: '1', name: uiText('List', 'Danh sách'), onSelect: () => engine.setDistributionType(type.id, 'list') },
    { key: '2', name: uiText('Variable', 'Biến'), onSelect: () => engine.setDistributionType(type.id, 'variable') }
  ]], distributionTypeLabel(type) + uiText(' — Input', ' — Cách nhập'), {
    hideTitle: true,
    compactLabels: true
  });
}

// Editor của Distribution List giống Statistics nhưng chỉ có hai lệnh.
// ĐÃ XÁC NHẬN 2026-09-11: OPTN → 2:Editor → Insert Row/Delete All.
function openDistributionEditorOverlay() {
  openMenu(optnOverlayEl, optnListEl, [[
    { key: '1', name: uiText('Insert Row', 'Chèn dòng'), onSelect: () => engine.distributionCommand('insert-row') },
    { key: '2', name: uiText('Delete All', 'Xóa tất cả'), onSelect: () => engine.distributionCommand('delete-all') }
  ]], uiText('OPTN — Editor', 'OPTN — Chỉnh sửa'));
}

// Menu con Editor của bảng dữ liệu (manual trang 120).
function openStatisticsEditorOverlay() {
  openMenu(optnOverlayEl, optnListEl, [[
    { key: '1', name: uiText('Insert Row', 'Chèn dòng'), onSelect: () => engine.statisticsCommand('insert-row') },
    { key: '2', name: uiText('Delete All', 'Xóa tất cả'), onSelect: () => engine.statisticsCommand('delete-all') }
  ]], uiText('OPTN — Editor', 'OPTN — Chỉnh sửa'));
}

// Menu con CHÈN BIẾN/HÀM vào biểu thức (chỉ có ở màn hình tính). Nhận một
// hoặc nhiều TRANG (mỗi trang một mảng mục) — menu Variable của hai biến có
// hai trang (8 mục rồi 3 mục).
function openStatTokenOverlay(pages, title) {
  const asPages = Array.isArray(pages[0]) ? pages : [pages];
  openMenu(optnOverlayEl, optnListEl, asPages.map((items) => items.map((item) => ({
    key: item.key,
    name: item.token,
    onSelect: () => engine.inputStatVariable(item.token)
  }))), title, { layouts: ['two-column'] });
}

// Cắt menu Variable phẳng (11 mục) thành hai trang đúng như máy.
function statVariablePages() {
  return [STAT_TWOVAR_VARIABLE_MENU.slice(0, 8), STAT_TWOVAR_VARIABLE_MENU.slice(8)];
}

// Menu con Norm Dist — ĐÃ XÁC NHẬN 2026-08-28: bốn mục P(/Q(/R(/►t, mỗi mục
// chèn kiểu khác nhau (P/Q/R là hàm mở ngoặc như sin; ►t là token hậu tố).
function openNormDistOverlay() {
  openMenu(optnOverlayEl, optnListEl, [[
    { key: '1', name: 'P(', onSelect: () => engine.inputFunction('P(') },
    { key: '2', name: 'Q(', onSelect: () => engine.inputFunction('Q(') },
    { key: '3', name: 'R(', onSelect: () => engine.inputFunction('R(') },
    { key: '4', name: '►t', onSelect: () => engine.inputStatVariable('►t') }
  ]], 'OPTN — Norm Dist', { layouts: ['two-column'] });
}

// ĐÃ XÁC NHẬN 2026-09-14 trên giả lập chính hãng: sáu hàm nằm trên cùng
// một trang, theo thứ tự sinh/cosh/tanh rồi ba hàm nghịch đảo tương ứng.
function openHyperbolicOverlay() {
  openMenu(optnOverlayEl, optnListEl, [[
    { key: '1', name: 'sinh', onSelect: () => engine.inputFunction('sinh(') },
    { key: '2', name: 'cosh', onSelect: () => engine.inputFunction('cosh(') },
    { key: '3', name: 'tanh', onSelect: () => engine.inputFunction('tanh(') },
    { key: '4', name: 'sinh⁻¹', onSelect: () => engine.inputFunction('sinh⁻¹(') },
    { key: '5', name: 'cosh⁻¹', onSelect: () => engine.inputFunction('cosh⁻¹(') },
    { key: '6', name: 'tanh⁻¹', onSelect: () => engine.inputFunction('tanh⁻¹(') }
  ]], uiText('OPTN — Hyperbolic Func', 'OPTN — Hàm Hyperbolic'), { layouts: ['two-column'], onBack: reopenCommonOptnPage });
}

// Hậu tố đơn vị của GIÁ TRỊ đang nhập (khác SETUP — Angle Unit, nơi đổi
// đơn vị mặc định). Manual tr.56 dùng đúng ba ký hiệu °, r, g.
function openAngleUnitInputOverlay() {
  openMenu(optnOverlayEl, optnListEl, [[
    { key: '1', name: '°', onSelect: () => engine.inputAngleUnit('deg') },
    { key: '2', name: 'r', onSelect: () => engine.inputAngleUnit('rad') },
    { key: '3', name: 'g', onSelect: () => engine.inputAngleUnit('grad') }
  ]], uiText('OPTN — Angle Unit', 'OPTN — Đơn vị góc'), { layouts: ['two-column'], onBack: reopenCommonOptnPage });
}

// OPTN đổi nội dung theo mode đang chọn (Excel SYS-016: "Functions depend on
// mode"). Mode chưa làm thì phím OPTN để mờ, xem syncModeChrome().
// RESET không thay đổi Engine trước dấu bằng trên màn xác nhận.
const RESET_KINDS = ['setup', 'memory', 'all'];
function resetKindLabel(kind) {
  const index = RESET_KINDS.indexOf(kind);
  return uiLanguage === 'vi'
    ? ['Thiết lập dữ liệu', 'Bộ nhớ', 'Khởi tạo tất cả'][index]
    : ['Setup Data', 'Memory', 'Initialize All'][index];
}

function openResetMenu() {
  if (engine.getState().mode === 'error') return;
  openMenu(optnOverlayEl, optnListEl, [RESET_KINDS.map((kind, index) => ({
    key: String(index + 1), name: resetKindLabel(kind),
    onSelect: () => openResetConfirmation(kind)
  }))], uiText('Reset?', 'Cài đặt lại?'), { kind: 'reset', hideTitle: false });
  optnOverlayEl.dataset.phase = 'menu';
  resetDialog = { kind: null, phase: 'menu' };
}

function drawResetDialog(kind, phase) {
  openMenu(optnOverlayEl, optnListEl, [[]], phase === 'confirm'
    ? uiText('Reset OK?', 'Đgý cài đặt lại?')
    : uiText('Reset!', 'Đã cài đặt lại!'), { kind: 'reset', hideTitle: false });
  resetDialog = { kind, phase };
  optnOverlayEl.dataset.phase = phase;
  const lines = phase === 'confirm'
    ? [resetKindLabel(kind), uiText('[=] :Yes', '[=] :Có'), uiText('[AC] :Cancel', '[AC] :Hủy')]
    : [resetKindLabel(kind), '', uiText('Press [AC] key', 'Nhấn phím [AC]')];
  lines.forEach((text, index) => {
    const li = document.createElement('li');
    li.className = 'reset-line';
    li.textContent = text || '\u00a0';
    if (phase === 'done' && index === 2) li.className += ' reset-finish';
    optnListEl.appendChild(li);
  });
}

function openResetConfirmation(kind) {
  drawResetDialog(kind, 'confirm');
}

function handleResetDialogAction(action, button) {
  if (!resetDialog) return false;
  const {kind, phase} = resetDialog;
  if (phase === 'menu' && button && button.dataset.digit !== undefined) {
    selectMenuByKey(button.dataset.digit);
    return true;
  }
  if (action === 'clear' || (phase === 'done' && action === 'equals')) {
    closeOverlays();
    render();
  } else if (phase === 'confirm' && action === 'equals') {
    engine.resetCalculator(kind);
    drawResetDialog(kind, 'done');
    render();
  }
  return true;
}

// CONST: hai trang nhóm; mỗi nhóm dùng lưới ba cột.
// A-F/M/x nhận đúng các phím vật lý có nhãn biến tương ứng.
function openScientificConstantsOverlay(page=0) {
  if(!engine.canInputScientificConstant()) return;
  const pages=[SCIENTIFIC_CONSTANT_GROUPS.slice(0,4),SCIENTIFIC_CONSTANT_GROUPS.slice(4)];
  openMenu(optnOverlayEl,optnListEl,pages.map((groups,pageIndex)=>groups.map((group,i)=>({
    key:String(i+1),name:group[uiLanguage],
    onSelect:()=>openScientificConstantGroup(group,pageIndex)
  }))), 'CONST',{kind:'constants'});
  openMenuPageIndex=page;drawMenuPage();
}
function openScientificConstantGroup(group,page) {
  const keys=['1','2','3','4','5','6','7','8','9','A','B','C','D','E','F','M','x'];
  openMenu(optnOverlayEl,optnListEl,[group.items.map(([id,symbol],i)=>({
    key:keys[i],name:symbol,constant:id,onSelect:()=>engine.inputScientificConstant(id)
  }))],'CONST',{kind:'constants',layouts:['scientific-grid'],onBack:()=>openScientificConstantsOverlay(page)});
}

function openUnitConversionsOverlay(page=0) {
  if(!engine.canInputUnitConversion()) return;
  const pages=[UNIT_CONVERSION_GROUPS.slice(0,4),UNIT_CONVERSION_GROUPS.slice(4,8),UNIT_CONVERSION_GROUPS.slice(8)];
  openMenu(optnOverlayEl,optnListEl,pages.map((groups,pageIndex)=>groups.map((group,i)=>({
    key:String(i+1),name:group[uiLanguage],onSelect:()=>openUnitConversionGroup(group,pageIndex)
  }))),'CONV',{kind:'constants'});
  openMenuPageIndex=page;drawMenuPage();
}
function openUnitConversionGroup(group,page) {
  const keys=['1','2','3','4','5','6','7','8','9','A','B','C'];
  openMenu(optnOverlayEl,optnListEl,[group.items.map((item,i)=>({
    key:keys[i],name:item.label,onSelect:()=>engine.inputUnitConversion(item.id)
  }))],'CONV',{kind:'constants',layouts:['conversion-grid'],onBack:()=>openUnitConversionsOverlay(page)});
}

// [ĐÃ XÁC NHẬN 2026-11-07] ◀ trong ba menu con chung về đúng
// trang cuối OPTN của màn hiện tại; không thoát editor hoặc đổi draft.
function reopenCommonOptnPage() {
  openOptnOverlay();
  moveMenuPage(-1);
}

function openOptnOverlay() {
  const calcMode = engine.getCalcMode();
  // CASIO 2026-10-20: trang chung đứng cuối cả editor và màn tính.
  const commonPage=[
    {key:'1',name:uiText('Hyperbolic Func','Hàm Hyperbolic'),onSelect:openHyperbolicOverlay},
    {key:'2',name:uiText('Angle Unit','Đơn vị góc'),onSelect:openAngleUnitInputOverlay},
    {key:'3',name:uiText('Engineer Symbol','Ký hiệu kĩ thuật'),onSelect:openEngineerSymbolPicker}
  ];
  if (calcMode === 'vector') {
    const state = engine.getState();
    if (state.mode === 'vector' && state.screen === 'editor') {
      openMenu(optnOverlayEl, optnListEl, [[
        { key: '1', name: uiText('Define Vector', 'Tạo vecto'), onSelect: () => engine.vectorCommand('define') },
        { key: '2', name: uiText('Edit Vector', 'Sửa vecto'), onSelect: () => engine.vectorCommand('edit') },
        { key: '3', name: uiText('Vector Calc', 'Tính toán vecto'), onSelect: () => engine.vectorCommand('calc') }
      ],commonPage], uiText('OPTN — Vector', 'OPTN — Vecto'));
      return;
    }
    if (state.mode === 'vector') return;
    openMenu(optnOverlayEl, optnListEl, [
      [
        { key: '1', name: uiText('Define Vector', 'Tạo vecto'), onSelect: () => engine.vectorCommand('define') },
        { key: '2', name: uiText('Edit Vector', 'Sửa vecto'), onSelect: () => engine.vectorCommand('edit') },
        { key: '3', name: 'VctA', onSelect: () => engine.inputVectorToken('VctA') },
        { key: '4', name: 'VctB', onSelect: () => engine.inputVectorToken('VctB') },
        { key: '5', name: 'VctC', onSelect: () => engine.inputVectorToken('VctC') },
        { key: '6', name: 'VctD', onSelect: () => engine.inputVectorToken('VctD') }
      ],
      [
        { key: '1', name: 'VctAns', onSelect: () => engine.inputVectorToken('VctAns') },
        { key: '2', name: uiText('Dot Product', 'Tích vô hướng'), onSelect: () => engine.inputVectorDot() },
        { key: '3', name: uiText('Angle', 'Góc giữa 2vecto'), onSelect: () => engine.inputVectorFunction('Angle') },
        { key: '4', name: uiText('Unit Vector', 'Vecto đơn vị'), onSelect: () => engine.inputVectorFunction('UnitV') }
      ],commonPage
    ], uiText('OPTN — Vector', 'OPTN — Vecto'), { layouts: ['matrix', 'list'] });
    return;
  }
  if (calcMode === 'matrix') {
    const state = engine.getState();
    if (state.mode === 'matrix' && state.screen === 'editor') {
      openMenu(optnOverlayEl, optnListEl, [[
        { key: '1', name: uiText('Define Matrix', 'Tạo ma trận'), onSelect: () => engine.matrixCommand('define') },
        { key: '2', name: uiText('Edit Matrix', 'Sửa ma trận'), onSelect: () => engine.matrixCommand('edit') },
        { key: '3', name: uiText('Matrix Calc', 'Tính toán mtrận'), onSelect: () => engine.matrixCommand('calc') }
      ],commonPage], uiText('OPTN — Matrix', 'OPTN — Ma trận'));
      return;
    }
    if (state.mode === 'matrix') return;
    openMenu(optnOverlayEl, optnListEl, [
      [
        { key: '1', name: uiText('Define Matrix', 'Tạo ma trận'), onSelect: () => engine.matrixCommand('define') },
        { key: '2', name: uiText('Edit Matrix', 'Sửa ma trận'), onSelect: () => engine.matrixCommand('edit') },
        { key: '3', name: 'MatA', onSelect: () => engine.inputMatrixToken('MatA') },
        { key: '4', name: 'MatB', onSelect: () => engine.inputMatrixToken('MatB') },
        { key: '5', name: 'MatC', onSelect: () => engine.inputMatrixToken('MatC') },
        { key: '6', name: 'MatD', onSelect: () => engine.inputMatrixToken('MatD') }
      ],
      [
        { key: '1', name: 'MatAns', onSelect: () => engine.inputMatrixToken('MatAns') },
        { key: '2', name: uiText('Determinant', 'Định thức'), onSelect: () => engine.inputMatrixFunction('Det') },
        { key: '3', name: uiText('Transposition', 'Mtrận chuyển vị'), onSelect: () => engine.inputMatrixFunction('Trn') },
        { key: '4', name: uiText('Identity', 'Ma trận đơn vị'), onSelect: () => engine.inputMatrixFunction('Identity') }
      ],commonPage
    ], uiText('OPTN — Matrix', 'OPTN — Ma trận'), { layouts: ['matrix', 'list'] });
    return;
  }
  if (calcMode === 'complex') {
    const actions = [
      [
        () => engine.inputFunction('Arg('),
        () => engine.inputFunction('Conjg('),
        () => engine.inputFunction('ReP('),
        () => engine.inputFunction('ImP(')
      ],
      [
        () => engine.inputComplexOutput('polar'),
        () => engine.inputComplexOutput('rect')
      ]
    ];
    const pages = uiLanguage === 'vi' ? COMPLEX_OPTN_PAGES_VI : COMPLEX_OPTN_PAGES;
    openMenu(optnOverlayEl, optnListEl, pages.map((page, pageIndex) =>
      page.map((name, i) => ({ key: String(i + 1), name, onSelect: actions[pageIndex][i] }))
    ), uiText('OPTN — Complex', 'OPTN — Số phức'));
    return;
  }
  if (calcMode === 'distribution') {
    const onList = engine.getState().screen === 'list';
    openMenu(optnOverlayEl, optnListEl, [[
      { key: '1', name: uiText('Select Type', 'Chọn kiểu tính'), onSelect: openDistributionTypeOverlay },
      ...(onList ? [{ key: '2', name: uiText('Editor', 'Chỉnh sửa'), onSelect: openDistributionEditorOverlay }] : [])
    ]], uiText('OPTN — Distribution', 'OPTN — Phân phối'));
    return;
  }
  if (calcMode === 'ratio') {
    openMenu(optnOverlayEl, optnListEl, [[
      { key: '1', name: uiText('Select Type', 'Chọn kiểu tính'), onSelect: openRatioTypeOverlay }
    ]], uiText('OPTN — Ratio', 'OPTN — Tỉ lệ thức'));
    return;
  }
  if (calcMode === 'equation') {
    // ĐÃ XÁC NHẬN 2026-09-29: OPTN mở thẳng hai kiểu, không có bước
    // trung gian `Select Type` như bản BITEX cũ.
    openEquationTypeOverlay();
    return;
  }
  if (calcMode === 'inequality') {
    openMenu(optnOverlayEl, optnListEl, [[
      { key: '1', name: uiText('Polynomial', 'Bất Ptrình'), onSelect: () => engine.inequalityCommand('polynomial') }
    ]], uiText('OPTN — Inequality', 'OPTN — Bất Ptrình'));
    return;
  }
  // Mode Statistics: menu OPTN KHÁC NHAU giữa hai màn hình VÀ giữa một/hai
  // biến — ĐÃ XÁC NHẬN 2026-08-25 (một biến) / 2026-08-27 (hai biến), manual
  // tr.121-123.
  //   Một biến, bảng:  1:Select Type 2:Editor 3:1-Variable Calc 4:Statistics Calc
  //   Một biến, tính:  1:Select Type 2:1-Variable Calc 3:Data | 1:Summation
  //                    2:Variable 3:Min/Max 4:Norm Dist
  //   Hai biến, bảng:  1:Select Type 2:Editor 3:2-Variable Calc 4:Regression Calc
  //                    | 1:Statistics Calc
  //   Hai biến, tính:  1:Select Type 2:2-Variable Calc 3:Regression Calc 4:Data
  //                    | 1:Summation 2:Variable 3:Min/Max 4:Regression
  if (calcMode === 'statistics') {
    const type = engine.getStatisticsType();
    const twoVar = !!(type && type.twoVar);
    const onEditor = engine.getState().screen === 'editor';
    const calcName = twoVar ? '2-Variable Calc' : '1-Variable Calc';
    if (onEditor) {
      if (twoVar) {
        openMenu(optnOverlayEl, optnListEl, [
          [
            { key: '1', name: uiText('Select Type', 'Chọn kiểu tính'), onSelect: openStatisticsTypeOverlay },
            { key: '2', name: uiText('Editor', 'Chỉnh sửa'), onSelect: openStatisticsEditorOverlay },
            { key: '3', name: uiText('2-Variable Calc', 'Tính 2-biến'), onSelect: () => engine.statisticsCommand('stats') },
            { key: '4', name: uiText('Regression Calc', 'Tính hồi quy'), onSelect: () => engine.statisticsCommand('regression') }
          ],
          [
            { key: '1', name: uiText('Statistics Calc', 'Tính toán tkê'), onSelect: () => engine.statisticsCommand('calc') }
          ],commonPage
        ], uiText('OPTN — Statistics', 'OPTN — Thống kê'));
        return;
      }
      openMenu(optnOverlayEl, optnListEl, [[
        { key: '1', name: uiText('Select Type', 'Chọn kiểu tính'), onSelect: openStatisticsTypeOverlay },
        { key: '2', name: uiText('Editor', 'Chỉnh sửa'), onSelect: openStatisticsEditorOverlay },
        { key: '3', name: uiText('1-Variable Calc', 'Tính 1-biến'), onSelect: () => engine.statisticsCommand('stats') },
        { key: '4', name: uiText('Statistics Calc', 'Tính toán tkê'), onSelect: () => engine.statisticsCommand('calc') }
      ],commonPage], uiText('OPTN — Statistics', 'OPTN — Thống kê'));
      return;
    }
    const page1 = twoVar
      ? [
          { key: '1', name: uiText('Select Type', 'Chọn kiểu tính'), onSelect: openStatisticsTypeOverlay },
          { key: '2', name: uiText('2-Variable Calc', 'Tính 2-biến'), onSelect: () => engine.statisticsCommand('stats') },
          { key: '3', name: uiText('Regression Calc', 'Tính hồi quy'), onSelect: () => engine.statisticsCommand('regression') },
          { key: '4', name: uiText('Data', 'Dữ liệu'), onSelect: () => engine.statisticsCommand('data') }
        ]
      : [
          { key: '1', name: uiText('Select Type', 'Chọn kiểu tính'), onSelect: openStatisticsTypeOverlay },
          { key: '2', name: uiText('1-Variable Calc', 'Tính 1-biến'), onSelect: () => engine.statisticsCommand('stats') },
          { key: '3', name: uiText('Data', 'Dữ liệu'), onSelect: () => engine.statisticsCommand('data') }
        ];
    const page2 = twoVar
      ? [
          { key: '1', name: uiText('Summation', 'Phép tính tổng'), onSelect: () => openStatTokenOverlay(STAT_TWOVAR_SUMMATION_MENU, uiText('OPTN — Summation', 'OPTN — Phép tính tổng')) },
          { key: '2', name: uiText('Variable', 'Biến thống kê'), onSelect: () => openStatTokenOverlay(statVariablePages(), uiText('OPTN — Variable', 'OPTN — Biến thống kê')) },
          { key: '3', name: uiText('Min/Max', 'Nhỏ nhất/Lớn nhất'), onSelect: () => openStatTokenOverlay(STAT_TWOVAR_MINMAX_MENU, uiText('OPTN — Min/Max', 'OPTN — Nhỏ nhất/Lớn nhất')) },
          { key: '4', name: uiText('Regression', 'Hồi quy'), onSelect: () => openStatTokenOverlay(type && type.id === 'quad' ? STAT_QUAD_REGRESSION_MENU : STAT_REGRESSION_MENU, uiText('OPTN — Regression', 'OPTN — Hồi quy')) }
        ]
      : [
          { key: '1', name: uiText('Summation', 'Phép tính tổng'), onSelect: () => openStatTokenOverlay(STAT_SUMMATION_MENU, uiText('OPTN — Summation', 'OPTN — Phép tính tổng')) },
          { key: '2', name: uiText('Variable', 'Biến thống kê'), onSelect: () => openStatTokenOverlay(STAT_VARIABLE_MENU, uiText('OPTN — Variable', 'OPTN — Biến thống kê')) },
          { key: '3', name: uiText('Min/Max', 'Nhỏ nhất/Lớn nhất'), onSelect: () => openStatTokenOverlay(STAT_MINMAX_MENU, uiText('OPTN — Min/Max', 'OPTN — Nhỏ nhất/Lớn nhất')) },
          { key: '4', name: uiText('Norm Dist', 'Phân phối chuẩn'), onSelect: openNormDistOverlay }
        ];
    openMenu(optnOverlayEl, optnListEl, [page1, page2, commonPage],
      uiText('OPTN — Statistics', 'OPTN — Thống kê'));
    return;
  }

  // Mode Base-N: menu OPTN hai trang — ĐÃ XÁC NHẬN 2026-08-31.
  //   Trang 1: 1:Neg 2:Not 3:and 4:or 5:xor 6:xnor  (toán tử logic)
  //   Trang 2: 1:d 2:h 3:b 4:o                       (tiền tố ép cơ số literal)
  // Neg/Not là hàm mở ngoặc (inputFunction); các mục còn lại chèn chuỗi thẳng.
  if (calcMode === 'base-n') {
    openMenu(optnOverlayEl, optnListEl, [
      [
        { key: '1', name: 'Neg', onSelect: () => engine.inputFunction('Neg(') },
        { key: '2', name: 'Not', onSelect: () => engine.inputFunction('Not(') },
        { key: '3', name: 'and', onSelect: () => engine.inputBaseNToken('and') },
        { key: '4', name: 'or', onSelect: () => engine.inputBaseNToken('or') },
        { key: '5', name: 'xor', onSelect: () => engine.inputBaseNToken('xor') },
        { key: '6', name: 'xnor', onSelect: () => engine.inputBaseNToken('xnor') }
      ],
      [
        { key: '1', name: 'd', onSelect: () => engine.inputBaseNToken('d') },
        { key: '2', name: 'h', onSelect: () => engine.inputBaseNToken('h') },
        { key: '3', name: 'b', onSelect: () => engine.inputBaseNToken('b') },
        { key: '4', name: 'o', onSelect: () => engine.inputBaseNToken('o') }
      ]
    ], uiText('OPTN — Base-N', 'OPTN — Hệ đếm cơ số N'), { layouts: ['two-column'] });
    return;
  }

  // Mode Calculate: menu OPTN có đúng 3 mục — ĐÃ XÁC NHẬN 2026-08-24.
  // Hyperbolic Func và Angle Unit đã hoàn tất.
  if (calcMode === 'calculate') {
    openMenu(optnOverlayEl, optnListEl, [commonPage], uiText('OPTN — Calculate', 'OPTN — Ptính thường'));
    return;
  }
  const verifyPage2Actions = [
    openHyperbolicOverlay,
    openAngleUnitInputOverlay,
    openEngineerSymbolPicker
  ];
  openMenu(optnOverlayEl, optnListEl, [
    VERIFY_OPTN_PAGE1.map((op, i) => ({
      key: String(i + 1),
      name: op,
      onSelect: () => engine.inputRelational(op)
    })),
    VERIFY_OPTN_PAGE2.map((name, i) => ({
      key: String(i + 1),
      name: uiLanguage === 'vi'
        ? ['Hàm Hyperbolic', 'Đơn vị góc', 'Ký hiệu kĩ thuật'][i]
        : name,
      onSelect: verifyPage2Actions[i]
    }))
  ], uiText('OPTN — Verify', 'OPTN — Đúng/Sai'), { layouts: ['two-column', 'list'] });
}

function openRecallOverlay() {
  const variables = engine.getRecallValues();
  recallListEl.innerHTML = '';
  RECALL_VARIABLE_NAMES.forEach((name) => {
    const li = document.createElement('li');
    li.dataset.disabled = 'true';
    li.textContent = name + '=' + localizedNumberText(variables[name]);
    recallListEl.appendChild(li);
  });
  closeOverlays();
  recallOverlayEl.hidden = false;
}

// SETUP (SHIFT+MENU) — ĐÃ XÁC NHẬN 2026-08-21 trên bản giả lập chính hãng,
// bấm sau "Initialize All" nên là trạng thái gốc của máy: 14 mục chia làm
// 4 TRANG, mỗi trang ĐÁNH SỐ LẠI TỪ 1, và ▼ ở trang cuối quay vòng về trang
// đầu.
//   trang 1: 1:Input/Output  2:Angle Unit  3:Number Format  4:Engineer Symbol
//   trang 2: 1:Fraction Result  2:Complex  3:Statistics  4:Equation/Func
//   trang 3: 1:Table  2:Recurring Dec  3:Decimal Mark  4:Digit Separator
//   trang 4: 1:Language  2:Contrast
//
// Bản trước dựng từ Excel "Setup Matrix": 13 mục trong MỘT trang đánh số
// 1-13, thiếu hẳn "Contrast". Hệ quả là chuỗi phím vào Angle Unit thì vẫn
// đúng (trang 1, mục 2) nhưng vào bất cứ mục nào từ "Fraction Result" trở
// đi đều lệch máy thật. Đây là chỗ sai thứ ba do file Excel gây ra — nó là
// bản tổng hợp lại PDF, không phải dữ liệu lấy từ máy.
//
// Máy KHÔNG đánh dấu mục đang chọn: menu Angle Unit chỉ có "1:Degree
// 2:Radian 3:Gradian", không có dấu nào cạnh mục đang dùng, và Number
// Format cũng vậy. Người dùng đọc thiết lập hiện hành ở THANH TRẠNG THÁI
// (ô D/R/G, chữ FIX/SCI). Bản trước tự thêm " ✓" — nay bỏ.
const SETUP_PAGES = [
  ['Input/Output', 'Angle Unit', 'Number Format', 'Engineer Symbol'],
  ['Fraction Result', 'Complex', 'Statistics', 'Equation/Func'],
  ['Table', 'Recurring Dec', 'Decimal Mark', 'Digit Separator'],
  ['Language', 'Contrast']
];

const SETUP_LABELS_VI = {
  'Input/Output': 'Nhập/Xuất',
  'Angle Unit': 'Đơn vị góc',
  'Number Format': 'Định dạng số',
  'Engineer Symbol': 'Ký hiệu kthuật',
  'Fraction Result': 'Kết quả phân số',
  'Complex': 'Số phức',
  'Statistics': 'Thống kê',
  'Equation/Func': 'Ptrình/HệPtrình',
  'Table': 'Bảng giá trị',
  'Recurring Dec': 'Số tphân thoàn',
  'Decimal Mark': 'Dấu thập phân',
  'Digit Separator': 'Dấu cách 3 chsố',
  'Language': 'Ngôn ngữ',
  'Contrast': 'Sáng/tối Mhình'
};

function uiText(english, vietnamese) {
  return uiLanguage === 'vi' ? vietnamese : english;
}

function setupLabel(name) {
  return uiLanguage === 'vi' ? SETUP_LABELS_VI[name] : name;
}

function localizeErrorMessage(message) {
  if (uiLanguage !== 'vi') return message;
  // ĐÃ XÁC NHẬN 2026-09-29 trực tiếp trên CASIO tiếng Việt: 1÷0, `3+`,
  // và Table 1..31 với hai hàm (vượt trần 30 dòng).
  return {
    'Math ERROR': 'Lỗi phép tính',
    'Syntax ERROR': 'Lỗi cú pháp',
    'Range ERROR': 'Lỗi phạm vi',
    'Variable ERROR': 'Lỗi biến số',
    'Cannot Solve': 'Không giải được',
    'Dimension ERROR': 'Lỗi kích thước',
    'Argument ERROR': 'Lỗi đối số',
    'Time Out': 'Hết thời gian'
  }[message] || message;
}

function localizeResultMessage(message) {
  if (uiLanguage !== 'vi') return message;
  return {
    'No Solution': 'Vô nghiệm',
    'All Real Numbers': 'Tất cả số thực',
    'Infinite Solution': 'Vô số nghiệm',
    'No Real Roots': 'Vô nghiệm',
    'No Local Max/Min': 'Không có CĐ/CT'
  }[message] || message;
}

function localizeVerifyResult(value) {
  return value ? uiText('True', 'Đúng') : uiText('False', 'Sai');
}

function localizeModeCorner(lines) {
  if (uiLanguage !== 'vi' || !lines) return lines;
  return lines.map((line) => ({
    'Statistics': 'Thống kê',
    'Verify': 'Đúng/Sai',
    '1-Variable': 'Tính tkê 1-biến'
  })[line] || line);
}

// Mục nào đã làm thì trỏ sang menu con của nó; còn lại để mờ nhưng VẪN LIỆT
// KÊ, để số thứ tự của mọi mục khớp máy thật.
const SETUP_HANDLERS = {
  'Input/Output': openInputOutputOverlay,
  'Angle Unit': openAngleUnitOverlay,
  'Number Format': openNumberFormatOverlay,
  'Engineer Symbol': openEngineerSymbolOverlay,
  'Fraction Result': openFractionResultOverlay,
  'Complex': openComplexFormatOverlay,
  'Statistics': openStatisticsFrequencyOverlay,
  'Equation/Func': openEquationComplexOverlay,
  'Table': openTableFunctionsOverlay,
  'Recurring Dec': openRecurringDecimalOverlay,
  'Decimal Mark': openDecimalMarkOverlay,
  'Digit Separator': openDigitSeparatorOverlay,
  'Language': openLanguageOverlay,
  'Contrast': openContrastOverlay
};

function openSetupOverlay() {
  openMenu(setupOverlayEl, setupListEl, SETUP_PAGES.map((page) =>
    page.map((name, i) => ({
      key: String(i + 1),
      name: SETUP_HANDLERS[name] ? setupLabel(name) : setupLabel(name) + ' (chưa làm)',
      onSelect: SETUP_HANDLERS[name] || null
    }))), uiText('SETUP', 'CÀI ĐẶT'), { hideTitle: true, compactLabels: true });
}

// ĐÃ XÁC NHẬN 2026-08-21: đúng ba mục, không đánh dấu mục hiện hành.
function openAngleUnitOverlay() {
  openMenu(setupOverlayEl, setupListEl, [[
    { key: '1', name: uiText('Degree', 'Độ'), onSelect: () => engine.setAngleUnit('deg') },
    { key: '2', name: 'Radian', onSelect: () => engine.setAngleUnit('rad') },
    { key: '3', name: uiText('Gradian', 'Grad'), onSelect: () => engine.setAngleUnit('grad') }
  ]], uiText('SETUP — Angle Unit', 'CÀI ĐẶT — Đơn vị góc'), {
    hideTitle: true,
    compactLabels: true
  });
}

// Number Format. Nhãn tiếng Việt và ba dòng hỏi đã đo lại trên CASIO chính
// thức 2026-10-01; ý nghĩa từng lựa chọn nằm ở engine.js.
function openNumberFormatOverlay() {
  const ask = (enLabel, viLabel, min, max, kind) => () =>
    askDigit(uiText(enLabel, viLabel), min, max,
      (digits) => engine.setNumberFormat({ kind, digits }));
  openMenu(setupOverlayEl, setupListEl, [[
    { key: '1', name: uiText('Fix', 'Chọn số tp(Fix)'),
      onSelect: ask('Fix:Select 0~9', 'Chọn stp:chọn 0~9', 0, 9, 'fix') },
    { key: '2', name: uiText('Sci', 'Dạng a×10ⁿ(Sci)'),
      onSelect: ask('Sci:Select 0~9', 'a×10ⁿ:chọn 0~9', 0, 9, 'sci') },
    { key: '3', name: uiText('Norm', 'Viết sbt (Norm)'),
      onSelect: ask('Norm:Select 1~2', 'Viết sbt:chọn 1~2', 1, 2, 'norm') }
  ]], 'SETUP — Number Format', {
    hideTitle: true,
    compactLabels: true
  });
}

// Input/Output. Bốn lựa chọn, mặc định mục 1. Hai chế độ LineI/LineO được
// đo lại 2026-09-29; tên tiếng Việt dưới đây là chuỗi CASIO chính thức.
function openInputOutputOverlay() {
  openMenu(setupOverlayEl, setupListEl, [[
    { key: '1', name: uiText('MathI/MathO', 'Stn vào/ra'), onSelect: () => engine.setInputOutput('mathio') },
    { key: '2', name: uiText('MathI/DecimalO', 'Stn vào/Stp ra'), onSelect: () => engine.setInputOutput('mathido') },
    { key: '3', name: uiText('LineI/LineO', 'Dòng vào/ra'), onSelect: () => engine.setInputOutput('lineio') },
    { key: '4', name: uiText('LineI/DecimalO', 'Dòng vào/Stp ra'), onSelect: () => engine.setInputOutput('lineido') }
  ]], uiText('SETUP — Input/Output', 'CÀI ĐẶT — Nhập/Xuất'), {
    hideTitle: true,
    compactLabels: true
  });
}

// Engineer Symbol. CASIO tiếng Việt 2026-10-01 dùng tiêu đề rút gọn
// "BẬT ký hiệu kth?" và hai lựa chọn gọn "1:Mở" / "2:Tắt".
function openEngineerSymbolOverlay() {
  openMenu(setupOverlayEl, setupListEl, [[
    { key: '1', name: uiText('On', 'Mở'), onSelect: () => engine.setEngineerSymbol(true) },
    { key: '2', name: uiText('Off', 'Tắt'), onSelect: () => engine.setEngineerSymbol(false) }
  ]], uiText('Engineer Symbol?', 'BẬT ký hiệu kth?'), {
    compactLabels: true
  });
}

// Fraction Result. Manual tr.14 và CASIO chính thức 2026-09-28: ab/c vẽ
// phân số không đúng thành hỗn số; d/c (mặc định) giữ phân số không đúng.
function openFractionResultOverlay() {
  openMenu(setupOverlayEl, setupListEl, [[
    { key: '1', name: 'ab/c', onSelect: () => engine.setFractionResult('mixed') },
    { key: '2', name: 'd/c', onSelect: () => engine.setFractionResult('improper') }
  ]], 'SETUP — Fraction Result', {
    hideTitle: true,
    compactLabels: true
  });
}

// Complex. ĐÃ XÁC NHẬN 2026-09-11: đúng hai lựa chọn 1:a+bi và 2:r∠θ;
// chọn r∠θ làm 1+i tự hiện √2∠45 và đổi chỉ báo trạng thái từ i sang ∠.
function openComplexFormatOverlay() {
  openMenu(setupOverlayEl, setupListEl, [[
    { key: '1', name: 'a+bi', onSelect: () => engine.setComplexFormat('rect') },
    { key: '2', name: 'r∠θ', onSelect: () => engine.setComplexFormat('polar') }
  ]], 'SETUP — Complex', {
    hideTitle: true,
    compactLabels: true
  });
}

// Statistics. ĐÃ XÁC NHẬN 2026-08-26: mục này hỏi "Frequency?" rồi hai lựa
// chọn "1:On" "2:Off" — cùng khuôn với Engineer Symbol. Ý nghĩa của thiết lập
// nằm ở engine.js chỗ khai báo `statisticsFrequency`.
function openStatisticsFrequencyOverlay() {
  openMenu(setupOverlayEl, setupListEl, [[
    { key: '1', name: uiText('On', 'Mở'), onSelect: () => engine.setStatisticsFrequency(true) },
    { key: '2', name: uiText('Off', 'Tắt'), onSelect: () => engine.setStatisticsFrequency(false) }
  ]], uiText('Frequency?', 'BẬT tần số?'), {
    compactLabels: true
  });
}

// Equation/Func. Manual tr.15 và CASIO chính thức 2026-09-29: menu hỏi
// `Complex Result?`, mặc định On; Off chỉ giữ nghiệm thực của đa thức.
function openEquationComplexOverlay() {
  openMenu(setupOverlayEl, setupListEl, [[
    { key: '1', name: uiText('On', 'Mở'), onSelect: () => engine.setEquationComplexResults(true) },
    { key: '2', name: uiText('Off', 'Tắt'), onSelect: () => engine.setEquationComplexResults(false) }
  ]], uiText('Complex Result?', 'BẬT kquả số phức?'), {
    compactLabels: true
  });
}

// Table. Manual tr.14: chọn chỉ dùng f(x), hoặc dùng cả f(x),g(x).
// Thiết lập này còn quyết định trần số dòng (45/30); engine giữ luật đó để UI
// chỉ làm nhiệm vụ chuyển lựa chọn.
function openTableFunctionsOverlay() {
  openMenu(setupOverlayEl, setupListEl, [[
    { key: '1', name: 'f(x)', onSelect: () => engine.setTableFunctions('f') },
    { key: '2', name: 'f(x),g(x)', onSelect: () => engine.setTableFunctions('fg') }
  ]], 'SETUP — Table', {
    hideTitle: true,
    compactLabels: true
  });
}

// Recurring Dec. Manual tr.16 và CASIO chính thức 2026-09-28: menu hỏi
// `Recurring Dec?`, mặc định On; Off làm S⇔D bỏ qua dạng tuần hoàn.
function openRecurringDecimalOverlay() {
  openMenu(setupOverlayEl, setupListEl, [[
    { key: '1', name: uiText('On', 'Mở'), onSelect: () => engine.setRecurringDecimal(true) },
    { key: '2', name: uiText('Off', 'Tắt'), onSelect: () => engine.setRecurringDecimal(false) }
  ]], uiText('Recurring Dec?', 'BẬT số tp hoàn?'), {
    compactLabels: true
  });
}

// Decimal Mark. Manual tr.15 và CASIO chính thức 2026-09-29: dấu chấm là
// mặc định; Comma chỉ đổi dấu thập phân ở kết quả, phía nhập vẫn dùng dấu chấm.
function openDecimalMarkOverlay() {
  openMenu(setupOverlayEl, setupListEl, [[
    { key: '1', name: uiText('Dot', 'Chấm'), onSelect: () => engine.setDecimalMark('dot') },
    { key: '2', name: uiText('Comma', 'Phẩy'), onSelect: () => engine.setDecimalMark('comma') }
  ]], uiText('SETUP — Decimal Mark', 'CÀI ĐẶT — Dấu thập phân'), {
    hideTitle: true,
    compactLabels: true
  });
}

// Digit Separator. Manual tr.16 và CASIO chính thức 2026-09-29: menu hỏi
// `Digit Separator?`, mặc định Off; On nhóm mỗi ba chữ số bằng khoảng trắng.
function openDigitSeparatorOverlay() {
  openMenu(setupOverlayEl, setupListEl, [[
    { key: '1', name: uiText('On', 'Mở'), onSelect: () => engine.setDigitSeparator(true) },
    { key: '2', name: uiText('Off', 'Tắt'), onSelect: () => engine.setDigitSeparator(false) }
  ]], uiText('Digit Separator?', 'BẬT dcách 3 chữ?'), {
    compactLabels: true
  });
}

function openLanguageOverlay() {
  openMenu(setupOverlayEl, setupListEl, [[
    { key: '1', name: 'English', onSelect: () => { uiLanguage = 'en'; } },
    { key: '2', name: 'Tiếng Việt', onSelect: () => { uiLanguage = 'vi'; } }
  ]], uiText('SETUP — Language', 'CÀI ĐẶT — Ngôn ngữ'), {
    hideTitle: true,
    compactLabels: true
  });
}

// Contrast. Manual tr.5 và CASIO chính thức 2026-09-29: màn hình chỉ hiện
// `Contrast`, `Light [◀]` và `Dark [▶]`; ◀/▶ đổi ngay, AC thoát. Giả lập
// chính thức không cho đọc giá trị số nên biên 7 mức của giao diện BITEX là
// [CHƯA XÁC NHẬN]; chuỗi phím và hướng thay đổi đã đối chiếu.
function openContrastOverlay() {
  closeOverlays();
  contrastAdjusting = true;
  setupOverlayEl.querySelector('.overlay-title').style.display = '';
  setupOverlayEl.querySelector('.overlay-title').textContent = uiText('Contrast', 'Sáng/tối M.hình');
  setupListEl.classList.add('contrast-list');
  setupListEl.innerHTML = '';
  const li = document.createElement('li');
  li.dataset.disabled = 'true';
  const light = document.createElement('span');
  light.textContent = uiText('Light [◀]', 'Sáng [◀]');
  const dark = document.createElement('span');
  dark.textContent = uiText('Dark [▶]', 'Tối [▶]');
  li.appendChild(light);
  li.appendChild(dark);
  setupListEl.appendChild(li);
  setupOverlayEl.hidden = false;
}

function adjustContrast(step) {
  contrastLevel = Math.max(CONTRAST_MIN, Math.min(CONTRAST_MAX, contrastLevel + step));
  const ratio = (0.7 + contrastLevel * 0.1).toFixed(1);
  if (typeof screenWrapEl.style.setProperty === 'function') {
    screenWrapEl.style.setProperty('--lcd-contrast', ratio);
    screenWrapEl.style.setProperty('--lcd-filter', ratio === '1.0' ? 'none' : `contrast(${ratio})`);
  } else {
    screenWrapEl.style['--lcd-contrast'] = ratio;
    screenWrapEl.style['--lcd-filter'] = ratio === '1.0' ? 'none' : `contrast(${ratio})`;
  }
}

// runMenuItem đóng menu TRƯỚC khi chạy mục (xem chú thích ở đó), mà dòng hỏi
// chữ số lại phải hiện KÈM danh sách vừa đóng — nên mở lại chính danh sách
// đó rồi mới gắn dòng hỏi.
function askDigit(label, min, max, apply) {
  openNumberFormatOverlay();
  pendingDigitPrompt = { label, min, max, apply };
  drawMenuPage();
}

// ===== Vẽ cây node ra màn hình (Tầng 5) =====
// Engine trả về biểu thức đang gõ dưới dạng cây; phần dưới đây dựng DOM
// tương ứng — phân số thành hai tầng có vạch ngang. Không có logic tính
// toán ở đây, chỉ thuần việc vẽ.
// cursorList là chính mảng đang chứa con trỏ nên so sánh bằng tham chiếu
// (===) khi duyệt tới đúng vùng nhập đó.

function usesLineInput() {
  const setting = engine.getInputOutput();
  return setting === 'lineio' || setting === 'lineido';
}

// LineI nhập phân số bằng dấu ┘ trên dòng, theo phép đo06/11/2026.
// Các mẫu có cấu trúc khác được tuần tự hóa; không đổi cây MathI.
// Chỉ số dưới CONST giữ N/B/P và chữ Hy Lạp.
const SCIENTIFIC_SYMBOL_PARTS = {
  c0:['c','0'],eps0:['ε','0'],mu0:['μ','0'],Z0:['Z','0'],lP:['l','P'],tP:['t','P'],
  muN:['μ','N'],muB:['μ','B'],phi0:['Φ','0'],G0:['G','0'],KJ:['K','J'],RK:['R','K'],
  mp:['m','p'],mn:['m','n'],me:['m','e'],mmu:['m','μ'],a0:['a','0'],re:['r','e'],
  lambdaC:['λ','c'],gammaP:['γ','p'],lambdaCp:['λ','cp'],lambdaCn:['λ','cn'],Rinf:['R','∞'],
  mup:['μ','p'],mue:['μ','e'],mun:['μ','n'],mumu:['μ','μ'],mtau:['m','τ'],
  NA:['N','A'],Vm:['V','m'],c1:['c','1'],c2:['c','2'],RK90:['R','K-90'],KJ90:['K','J-90']
};
function renderScientificSymbol(id) {
  const span=document.createElement('span');span.className='scientific-symbol';
  const parts=SCIENTIFIC_SYMBOL_PARTS[id];
  span.textContent=parts?parts[0]:SCIENTIFIC_CONSTANTS[id].symbol;
  if(parts){const sub=document.createElement('sub');sub.textContent=parts[1];span.appendChild(sub);}
  return span;
}

// Vẽ góc dưới-phải của dấu phân số, không phụ thuộc glyph fallback.
function appendLineText(parent, value) {
  const parts = String(value).split('┘');
  parts.forEach((part, index) => {
    if (index) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'line-fraction-separator');
      svg.setAttribute('viewBox', '0 0 9 17');
      svg.setAttribute('aria-label', 'phân số');
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = '┘'; svg.appendChild(title);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', 'M1 13H7V7H8V14H1Z');
      path.setAttribute('fill', 'currentColor'); svg.appendChild(path); parent.appendChild(svg);
    }
    if (part) parent.appendChild(document.createTextNode(part));
  });
}

function renderLineNodes(nodes, cursorList, cursorIndex) {
  const frag = document.createDocumentFragment();
  const cursorHere = nodes === cursorList;
  const text = value => appendLineText(frag, value);
  const child = list => frag.appendChild(renderLineNodes(list, cursorList, cursorIndex));

  if (nodes.length === 0) {
    appendTouchPoint(frag, nodes, 0, cursorList);
    const slot = document.createElement('span');
    slot.className = cursorHere ? 'cursor' : 'slot-empty';
    slot.textContent = cursorHere ? '|' : '□';
    frag.appendChild(slot);
    return frag;
  }

  for (let i = 0; i <= nodes.length; i++) {
    appendTouchPoint(frag, nodes, i, cursorList);
    if (cursorHere && i === cursorIndex) {
      const cursor = document.createElement('span');
      cursor.className = 'cursor';
      cursor.textContent = '|';
      frag.appendChild(cursor);
    }
    if (i === nodes.length) break;

    const node = nodes[i];
    switch (node.type) {
      case 'frac':
        child(node.num); text('┘'); child(node.den);
        break;
      case 'mixed':
        child(node.int); text('┘'); child(node.num); text('┘'); child(node.den);
        break;
      case 'recurring':
        text('‹'); child(node.digits); text('›');
        break;
      case 'sqrt':
        text('√('); child(node.arg); text(')');
        break;
      case 'cbrt':
        text('∛('); child(node.arg); text(')');
        break;
      case 'abs':
        text('Abs('); child(node.arg); text(')');
        break;
      case 'sup':
        text('^('); child(node.exp); text(')');
        break;
      case 'pow10':
        text('10^('); child(node.exp); text(')');
        break;
      case 'times10':
        text('×10^('); child(node.exp); text(')');
        break;
      case 'epow':
        text('e^('); child(node.exp); text(')');
        break;
      case 'nthroot':
        child(node.idx); text('√('); child(node.arg); text(')');
        break;
      case 'logn':
        text('log'); child(node.base); text('('); child(node.arg); text(')');
        break;
      case 'sum':
        text('Σ('); child(node.body); text(',x='); child(node.lower); text(','); child(node.upper); text(')');
        break;
      case 'product':
        text('Π('); child(node.body); text(',x='); child(node.lower); text(','); child(node.upper); text(')');
        break;
      case 'integral':
        text('∫('); child(node.body); text(','); child(node.lower); text(','); child(node.upper); text(')dx');
        break;
      case 'derivative':
        text('d/dx('); child(node.body); text(')|x='); child(node.point);
        break;
      case 'angle':
        child(node.arg); text(ANGLE_UNIT_SYMBOLS[node.unit]);
        break;
      default:
        if(node.constant) frag.appendChild(renderScientificSymbol(node.constant));
        else if(node.negative) frag.appendChild(renderUnaryNegative(node));
        else text(mathCharacterText(node));
    }
  }
  return frag;
}

// Các hàm dựng MathI gọi lại renderNodes cho vùng lồng nhau. Biến độ sâu
// giữ toàn bộ một cây ở cùng một kiểu vẽ; chỉ lời gọi ngoài cùng mới chọn
// giữa MathI và LineI.
let renderMathNodeDepth = 0;
const touchPositions = new WeakMap();
const touchListOrigins = new WeakMap();
function appendTouchPoint(frag, list, index, cursorList) {
  if (!cursorList) return;
  while (touchListOrigins.has(list)) { const origin = touchListOrigins.get(list); index += origin.offset; list = origin.list; }
  const point = document.createElement('span'); point.className = 'touch-point';
  point.setAttribute('aria-hidden', 'true');
  touchPositions.set(point, {list, index}); frag.appendChild(point);
}
function renderNodes(nodes, cursorList, cursorIndex) {
  if (renderMathNodeDepth === 0 && usesLineInput()) {
    return renderLineNodes(nodes, cursorList, cursorIndex);
  }
  renderMathNodeDepth++;
  try {
    return renderMathNodes(nodes, cursorList, cursorIndex);
  } finally {
    renderMathNodeDepth--;
  }
}

// Chỉ kéo ngoặc khi bên trong có cấu trúc nhiều tầng. Cây Engine và
// con trỏ không đổi; ánh xạ con trỏ của danh sách gốc vào lát cắt để vẽ.
function mathParenthesisGroup(nodes, start) {
  let depth=1,end=nodes.length;
  for(let j=start+1;j<nodes.length;j++) {
    if(nodes[j].type!=='char') continue;
    for(const ch of nodes[j].ch) {
      if(ch==='(') depth++;
      else if(ch===')') depth--;
    }
    if(depth===0){end=j;break;}
  }
  const children=nodes.slice(start+1,end);
  const hasStack=list=>list.some(node=>
    ['frac','mixed','sum','product','integral','derivative'].includes(node.type) || templateSlots(node).some(hasStack));
  return hasStack(children)?{children,end,closed:end<nodes.length}:null;
}

function mathCharacterText(node) {
  // CASIO dùng dấu tròn cho cả ba phím DMS ở biểu thức nhập.
  return node.ch==='′' || node.ch==='″' ? '°' : node.ch;
}

function renderUnaryNegative(node) {
  const sign=document.createElement('span');
  sign.className='unary-negative';
  sign.textContent=node.ch;
  return sign;
}

function renderMathCharacter(node) {
  const text = mathCharacterText(node);
  const superscripts = {'²':'2', '³':'3', '⁻':'−', '¹':'1'};
  if (![...text].some(ch => superscripts[ch])) return document.createTextNode(text);
  const frag = document.createDocumentFragment();
  for (const part of text.match(/[²³⁻¹]+|[^²³⁻¹]+/g)) {
    if (!superscripts[part[0]]) frag.appendChild(document.createTextNode(part));
    else {
      const sup = document.createElement('span'); sup.className = 'sup';
      sup.textContent = [...part].map(ch => superscripts[ch]).join('');
      frag.appendChild(sup);
    }
  }
  return frag;
}

function renderMathNodes(nodes, cursorList, cursorIndex) {
  const frag = document.createDocumentFragment();
  const isCursorHere = nodes === cursorList;

  // Vùng nhập còn trống hiện một ô vuông báo chỗ phải gõ; nếu con trỏ đang
  // ở đúng ô đó thì chính ô vuông nhấp nháy (giống máy thật, xem ảnh chụp
  // docs/giao-dien-may-tinh.png) thay vì vẽ thêm dấu "|" riêng.
  if (nodes.length === 0) {
    appendTouchPoint(frag, nodes, 0, cursorList);
    const slot = document.createElement('span');
    slot.className = isCursorHere ? 'slot-empty cursor' : 'slot-empty';
    frag.appendChild(slot);
    return frag;
  }

  for (let i = 0; i <= nodes.length; i++) {
    appendTouchPoint(frag, nodes, i, cursorList);
    if (isCursorHere && i === cursorIndex) {
      const cursor = document.createElement('span');
      cursor.className = 'cursor';
      cursor.textContent = '|';
      frag.appendChild(cursor);
    }
    if (i === nodes.length) break;

    const node = nodes[i];
    const group=node.type==='char' && node.ch==='('?mathParenthesisGroup(nodes,i):null;
    if(group) {
      touchListOrigins.set(group.children, {list:nodes, offset:i+1});
      const wrap=document.createElement('span');wrap.className='math-parentheses';
      const open=document.createElement('span');open.className='math-parenthesis paren-open';open.textContent='(';
      const body=document.createElement('span');body.className='paren-body';
      const mapped=isCursorHere && cursorIndex>i && cursorIndex<=group.end;
      body.appendChild(renderNodes(group.children,mapped?group.children:cursorList,mapped?cursorIndex-i-1:cursorIndex));
      wrap.appendChild(open);wrap.appendChild(body);
      if(group.closed) {const close=document.createElement('span');close.className='math-parenthesis paren-close';close.textContent=')';wrap.appendChild(close);}
      frag.appendChild(wrap);i=group.end;
    } else if (node.type === 'frac') {
      frag.appendChild(renderFraction(node, cursorList, cursorIndex));
    } else if (node.type === 'recurring') {
      const wrap = document.createElement('span');
      wrap.className = 'recurring-input';
      wrap.appendChild(document.createTextNode('‹'));
      wrap.appendChild(renderNodes(node.digits, node.digits.length ? cursorList : null, cursorIndex));
      wrap.appendChild(document.createTextNode('›'));
      frag.appendChild(wrap);
    } else if (node.type === 'sqrt' || node.type === 'cbrt') {
      frag.appendChild(renderRadical(node, cursorList, cursorIndex));
    } else if (node.type === 'abs') {
      const wrap = document.createElement('span');
      wrap.appendChild(document.createTextNode('|'));
      wrap.appendChild(renderNodes(node.arg, cursorList, cursorIndex));
      wrap.appendChild(document.createTextNode('|'));
      frag.appendChild(wrap);
    } else if (node.type === 'sup') {
      frag.appendChild(renderSuperscript(node, cursorList, cursorIndex));
    } else if (node.type === 'pow10' || node.type === 'times10' || node.type === 'epow') {
      frag.appendChild(renderPowPrefix(node, cursorList, cursorIndex));
    } else if (node.type === 'nthroot') {
      frag.appendChild(renderNthRoot(node, cursorList, cursorIndex));
    } else if (node.type === 'logn') {
      frag.appendChild(renderLogN(node, cursorList, cursorIndex));
    } else if (node.type === 'mixed') {
      frag.appendChild(renderMixed(node, cursorList, cursorIndex));
    } else if (node.type === 'sum') {
      frag.appendChild(renderSum(node, cursorList, cursorIndex));
    } else if (node.type === 'product') {
      frag.appendChild(renderProduct(node, cursorList, cursorIndex));
    } else if (node.type === 'integral') {
      frag.appendChild(renderIntegral(node, cursorList, cursorIndex));
    } else if (node.type === 'derivative') {
      frag.appendChild(renderDerivative(node, cursorList, cursorIndex));
    } else if (node.type === 'angle') {
      const wrap = document.createElement('span');
      wrap.appendChild(renderNodes(node.arg, cursorList, cursorIndex));
      wrap.appendChild(document.createTextNode(ANGLE_UNIT_SYMBOLS[node.unit]));
      frag.appendChild(wrap);
    } else if(node.constant) {
      frag.appendChild(renderScientificSymbol(node.constant));
    } else if(node.negative) {
      frag.appendChild(renderUnaryNegative(node));
    } else {
      frag.appendChild(renderMathCharacter(node));
    }
  }

  return frag;
}

function renderFraction(node, cursorList, cursorIndex) {
  const wrap = document.createElement('span');
  wrap.className = 'frac';

  const num = document.createElement('span');
  num.className = 'frac-num';
  num.appendChild(renderNodes(node.num, cursorList, cursorIndex));

  const den = document.createElement('span');
  den.className = 'frac-den';
  den.appendChild(renderNodes(node.den, cursorList, cursorIndex));

  wrap.appendChild(num);
  wrap.appendChild(den);
  return wrap;
}

// Hỗn số (SHIFT+phím phân số): phần nguyên là chữ thường đứng trước, rồi
// tái dùng đúng cấu trúc .frac/.frac-num/.frac-den ở trên cho phần tử/mẫu.
function renderMixed(node, cursorList, cursorIndex) {
  const wrap = document.createElement('span');
  wrap.className = 'mixed';

  const intPart = document.createElement('span');
  intPart.appendChild(renderNodes(node.int, cursorList, cursorIndex));
  wrap.appendChild(intPart);

  const frac = document.createElement('span');
  frac.className = 'frac';

  const num = document.createElement('span');
  num.className = 'frac-num';
  num.appendChild(renderNodes(node.num, cursorList, cursorIndex));

  const den = document.createElement('span');
  den.className = 'frac-den';
  den.appendChild(renderNodes(node.den, cursorList, cursorIndex));

  frac.appendChild(num);
  frac.appendChild(den);
  wrap.appendChild(frac);
  return wrap;
}

// Σ (SHIFT+x) — ĐÃ XÁC NHẬN với máy thật (ảnh chụp màn hình 2026-08-14):
// cận trên xếp NGAY TRÊN ký hiệu Σ, cận dưới xếp NGAY DƯỚI kèm chữ "x="
// tĩnh, rồi thân biểu thức nằm trong CẶP NGOẶC TĨNH "(...)" ngay sau Σ —
// khác ∫ ở đúng điểm này (∫ không có ngoặc quanh thân, xem renderIntegral).
// Ngoặc là chữ tĩnh, không phải node, không gõ/xoá được rời.
function renderSum(node, cursorList, cursorIndex) {
  return renderIteratedOperation(node, 'Σ', cursorList, cursorIndex);
}

// Π (ALPHA+x) dùng đúng cấu trúc MathI của Σ: cận trên/dưới xếp giữa quanh
// ký hiệu và thân biểu thức nằm trong ngoặc tĩnh. ĐÃ XÁC NHẬN trực tiếp trên
// giả lập CASIO chính thức 2026-09-15.
function renderProduct(node, cursorList, cursorIndex) {
  return renderIteratedOperation(node, 'Π', cursorList, cursorIndex);
}

function renderIteratedOperation(node, symbolText, cursorList, cursorIndex) {
  const wrap = document.createElement('span');
  wrap.className = 'calc-op';

  const stack = document.createElement('span');
  stack.className = 'calc-op-stack';

  const upper = document.createElement('span');
  upper.className = 'calc-op-upper';
  upper.appendChild(renderNodes(node.upper, cursorList, cursorIndex));

  const symbol = document.createElement('span');
  symbol.className = 'calc-op-symbol';
  symbol.textContent = symbolText;

  const lower = document.createElement('span');
  lower.className = 'calc-op-lower';
  lower.appendChild(document.createTextNode('x='));
  lower.appendChild(renderNodes(node.lower, cursorList, cursorIndex));

  stack.appendChild(upper);
  stack.appendChild(symbol);
  stack.appendChild(lower);
  wrap.appendChild(stack);

  wrap.appendChild(document.createTextNode('('));
  const body = document.createElement('span');
  body.className = 'calc-op-body';
  body.appendChild(renderNodes(node.body, cursorList, cursorIndex));
  wrap.appendChild(body);
  wrap.appendChild(document.createTextNode(')'));

  return wrap;
}

// ∫ (trần) — ĐÃ XÁC NHẬN với máy thật (ảnh chụp màn hình 2026-08-14): cận
// trên/dưới bám sát góc trên-phải/dưới-phải của ký hiệu ∫ (kiểu số mũ/số
// dưới của chính ký hiệu, KHÁC Σ vốn xếp chồng CĂN GIỮA phía trên/dưới),
// thân biểu thức đứng ngay sau — KHÔNG có ngoặc quanh thân — rồi "dx" tĩnh
// đóng cuối. Engine tính Gauss-Kronrod độc lập; hàm này chỉ dựng giao diện.
function renderIntegral(node, cursorList, cursorIndex) {
  const wrap = document.createElement('span');
  wrap.className = 'integral-op';

  const symbol = document.createElement('span');
  symbol.className = 'integral-symbol';
  symbol.textContent = '∫';
  wrap.appendChild(symbol);

  const bounds = document.createElement('span');
  bounds.className = 'integral-bounds';

  const upper = document.createElement('span');
  upper.className = 'integral-upper';
  upper.appendChild(renderNodes(node.upper, cursorList, cursorIndex));

  const lower = document.createElement('span');
  lower.className = 'integral-lower';
  lower.appendChild(renderNodes(node.lower, cursorList, cursorIndex));

  bounds.appendChild(upper);
  bounds.appendChild(lower);
  wrap.appendChild(bounds);

  const body = document.createElement('span');
  body.className = 'integral-body';
  body.appendChild(renderNodes(node.body, cursorList, cursorIndex));
  wrap.appendChild(body);

  const suffix = document.createElement('span');
  suffix.className = 'integral-suffix';
  suffix.textContent = 'dx';
  wrap.appendChild(suffix);

  return wrap;
}

// d/dx (SHIFT+∫dx) — mẫu MathI trên giả lập chính thức: phân số d/dx đứng
// trước thân f(x), sau thân là vạch thế giá trị với x=a nằm ở chân. Hai ô
// nhập theo thứ tự body→point, engine giữ con trỏ và UI chỉ chịu trách nhiệm
// dựng bố cục 2D.
function renderDerivative(node, cursorList, cursorIndex) {
  const wrap = document.createElement('span');
  wrap.className = 'derivative-op';

  const fraction = document.createElement('span');
  fraction.className = 'derivative-fraction';
  const numerator = document.createElement('span');
  numerator.className = 'derivative-numerator';
  numerator.textContent = 'd';
  const denominator = document.createElement('span');
  denominator.className = 'derivative-denominator';
  denominator.textContent = 'dx';
  fraction.appendChild(numerator);
  fraction.appendChild(denominator);
  wrap.appendChild(fraction);

  wrap.appendChild(document.createTextNode('('));
  const body = document.createElement('span');
  body.className = 'derivative-body';
  body.appendChild(renderNodes(node.body, cursorList, cursorIndex));
  wrap.appendChild(body);
  wrap.appendChild(document.createTextNode(')'));

  const at = document.createElement('span');
  at.className = 'derivative-at';
  const bar = document.createElement('span');
  bar.className = 'derivative-at-bar';
  bar.textContent = '|';
  const point = document.createElement('span');
  point.className = 'derivative-point';
  point.appendChild(document.createTextNode('x='));
  point.appendChild(renderNodes(node.point, cursorList, cursorIndex));
  at.appendChild(bar);
  at.appendChild(point);
  wrap.appendChild(at);

  return wrap;
}

// Phân số của KẾT QUẢ (S⇔D) — cùng cấu trúc/class CSS với renderFraction ở
// trên, nhưng dựng thẳng từ chuỗi số (engine đã rút gọn), không phải từ cây
// tài liệu, nên không cần cursorList/cursorIndex.
function renderResultFraction(fraction) {
  const container = document.createDocumentFragment();
  if (usesLineInput()) {
    const sign = fraction.negative ? '−' : '';
    const body = fraction.int !== undefined
      ? fraction.int + '┘' + fraction.num + '┘' + fraction.den
      : fraction.num + '┘' + fraction.den;
    appendLineText(container, sign + body);
    return container;
  }
  if (fraction.negative) {
    container.appendChild(document.createTextNode('−'));
  }

  const wrap = document.createElement('span');
  wrap.className = 'frac';

  const num = document.createElement('span');
  num.className = 'frac-num';
  num.textContent = fraction.num;

  const den = document.createElement('span');
  den.className = 'frac-den';
  den.textContent = fraction.den;

  wrap.appendChild(num);
  wrap.appendChild(den);
  if (fraction.int !== undefined) {
    const mixed = document.createElement('span');
    mixed.className = 'mixed';
    const integer = document.createElement('span');
    integer.textContent = fraction.int;
    mixed.appendChild(integer);
    mixed.appendChild(wrap);
    container.appendChild(mixed);
  } else {
    container.appendChild(wrap);
  }
  return container;
}

// Số nguyên/phân số thuần (chuỗi) → mảng node char/frac. charNodes() là
// hàm toàn cục có sẵn trong engine.js (cùng trang, không phải module).
function surdNumberNodes(numStr, denStr) {
  if (denStr === '1') return charNodes(numStr);
  return [{ type: 'frac', num: charNodes(numStr), den: charNodes(denStr) }];
}

// Kết quả dạng căn thức (SurdValue, S⇔D) — dựng một mảng node thuần rồi
// TÁI DÙNG renderNodes/renderRadical đã có cho phần nhập (xem lời gọi ở
// updateScreen), để dấu căn của KẾT QUẢ trông giống hệt lúc gõ thay vì vẽ
// lại từ đầu. state.exactSurd chỉ là dữ liệu số thuần từ engine (không
// DOM) — mọi quyết định hiển thị nằm ở đây, phía UI.
//
// ĐÃ XÁC NHẬN với máy thật (ảnh chụp 2026-08-14, sin(60)=√3/2): khi hệ số
// căn có mẫu số ≠1, máy gộp căn vào TỬ của một phân số DUY NHẤT (căn nằm
// trên, mẫu số dưới) — KHÔNG vẽ một phân số hệ số đứng cạnh dấu căn riêng
// như bản trước. Hệ số mẫu=1 (vd 3√2) thì vẫn phẳng như cũ, không đổi.
function buildSurdNodes(surd) {
  const nodes = [];
  const hasRational = surd.rationalNum !== '0';
  if (hasRational) {
    if (surd.rationalNegative) nodes.push({ type: 'char', ch: '−' });
    nodes.push(...surdNumberNodes(surd.rationalNum, surd.rationalDen));
    nodes.push({ type: 'char', ch: surd.coeffNegative ? '−' : '+' });
  } else if (surd.coeffNegative) {
    nodes.push({ type: 'char', ch: '−' });
  }
  const sqrtNode = { type: 'sqrt', arg: charNodes(surd.radicand) };
  if (surd.coeffDen === '1') {
    if (surd.coeffNum !== '1') nodes.push(...charNodes(surd.coeffNum));
    nodes.push(sqrtNode);
  } else {
    const numNodes = surd.coeffNum === '1' ? [sqrtNode] : [...charNodes(surd.coeffNum), sqrtNode];
    nodes.push({ type: 'frac', num: numNodes, den: charNodes(surd.coeffDen) });
  }
  return nodes;
}

// Kết quả dạng bội số π (bước 3, lượng giác ngược ở Rad) — cùng tinh thần
// buildSurdNodes ở trên, nhưng không có phần "rational +" (một PiFraction
// luôn thuần ±(num/den)×π, không cộng thêm số hạng hữu tỉ nào).
//
// ĐÃ XÁC NHẬN với máy thật (ảnh chụp 2026-08-14, sin⁻¹(0,5)=1/6 π): KHÁC
// với căn thức (căn nằm TRONG tử số phân số) — ở đây π đứng RIÊNG, SAU
// phân số thuần số học (1/6), không phải π nằm trong tử. "π/6" (π ở tử)
// như bản trước là SAI.
function buildPiMultipleNodes(pi) {
  const nodes = [];
  if (pi.negative) nodes.push({ type: 'char', ch: '−' });
  if (pi.den === '1') {
    if (pi.num !== '1') nodes.push(...charNodes(pi.num));
  } else {
    nodes.push({ type: 'frac', num: charNodes(pi.num), den: charNodes(pi.den) });
  }
  nodes.push({ type: 'char', ch: 'π' });
  return nodes;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

// CASIO Capture Screen, 03-11-2026, √5+√6: móc căn nằm trong ô 10×16.
// Vạch ngang cách đỉnh chữ số 3 hàng, chân căn thấp hơn chữ số 1 hàng.
// Phần móc giữ kích thước khi thân cao (phân số/căn lồng); chỉ nối dài trụ trên.
function createRadicalSign() {
  const wrap = document.createElement('span');
  wrap.className = 'radical-sign';
  wrap.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 10 16');
  svg.setAttribute('preserveAspectRatio', 'none');
  const path = document.createElementNS(SVG_NS, 'path');
  // Các cột pixel đã đo, ghép thành hình kín để không có đường nối mờ.
  path.setAttribute('d', 'M8 0h1v4H8z M7 4h1v7H7z M4 7h1v2H4z M3 8h1v2H3z M5 9h1v4H5z M6 11h1v5H6z');
  path.setAttribute('fill', 'currentColor');
  svg.appendChild(path); wrap.appendChild(svg);
  return wrap;
}

// Dấu căn: nét căn đứng trước, phần thân mang vạch ngang bên trên nên vạch
// tự dài đúng bằng biểu thức nằm trong căn. Căn bậc ba thêm số 3 nhỏ ở góc
// trên bên trái, đúng cách viết trong sách giáo khoa.
function renderRadical(node, cursorList, cursorIndex) {
  const wrap = document.createElement('span');
  wrap.className = 'radical';

  if (node.type === 'cbrt') {
    const index = document.createElement('span');
    index.className = 'radical-index';
    index.textContent = '3';
    wrap.appendChild(index);
  }

  const body = document.createElement('span');
  body.className = 'radical-body';
  body.appendChild(renderNodes(node.arg, cursorList, cursorIndex));

  wrap.appendChild(createRadicalSign());
  wrap.appendChild(body);
  return wrap;
}

// ˣ√ (SHIFT+^): giống renderRadical nhưng số bậc ở góc trên-trái GÕ ĐƯỢC
// (dùng lại .radical-index, chỉ khác cbrt ở chỗ nội dung là renderNodes
// thay vì chữ "3" tĩnh, nên con trỏ đi vào được).
function renderNthRoot(node, cursorList, cursorIndex) {
  const wrap = document.createElement('span');
  wrap.className = 'radical';

  const index = document.createElement('span');
  index.className = 'radical-index';
  index.appendChild(renderNodes(node.idx, cursorList, cursorIndex));
  wrap.appendChild(index);

  const body = document.createElement('span');
  body.className = 'radical-body';
  body.appendChild(renderNodes(node.arg, cursorList, cursorIndex));

  wrap.appendChild(createRadicalSign());
  wrap.appendChild(body);
  return wrap;
}

// log cơ số bất kỳ: chữ "log" + ô cơ số (chỉ số DƯỚI, nhỏ) + "(" + ô đối + ")".
// Con trỏ đi vào được cả hai ô (nội dung là renderNodes, giống nthroot).
// ĐÃ XÁC NHẬN 2026-08-28 cách máy vẽ: log₂(8).
function renderLogN(node, cursorList, cursorIndex) {
  const wrap = document.createElement('span');
  wrap.className = 'logn';

  const name = document.createElement('span');
  name.textContent = 'log';
  wrap.appendChild(name);

  const base = document.createElement('span');
  base.className = 'log-base';
  base.appendChild(renderNodes(node.base, cursorList, cursorIndex));
  wrap.appendChild(base);

  const open = document.createElement('span');
  open.textContent = '(';
  const argument = document.createElement('span'); argument.className = 'log-argument';
  argument.appendChild(open);
  argument.appendChild(renderNodes(node.arg, cursorList, cursorIndex));
  const close = document.createElement('span');
  close.textContent = ')';
  argument.appendChild(close);
  wrap.appendChild(argument);
  return wrap;
}

// Ô mũ: chữ nhỏ nâng lên cao. Mũ lồng mũ tự nhỏ dần vì cỡ chữ tính theo em
// của phần bao ngoài.
function renderSuperscript(node, cursorList, cursorIndex) {
  const wrap = document.createElement('span');
  wrap.className = 'sup';
  wrap.appendChild(renderNodes(node.exp, cursorList, cursorIndex));
  return wrap;
}

// 10^ / e^ (SHIFT+log, SHIFT+ln): tiền tố "10" hoặc "e" cố định, không phải
// char rời, rồi tới ô mũ y hệt renderSuperscript. Tiền tố cố định vì DEL khi
// ô mũ rỗng phải gỡ nguyên cụm kể cả tiền tố (đã xác nhận máy thật).
function renderPowPrefix(node, cursorList, cursorIndex) {
  const wrap = document.createElement('span');
  wrap.className = 'pow-prefix';

  const base = document.createElement('span');
  base.textContent = node.type === 'pow10' ? '10' : node.type === 'times10' ? '×10' : 'e';
  wrap.appendChild(base);

  const sup = document.createElement('span');
  sup.className = 'sup';
  sup.appendChild(renderNodes(node.exp, cursorList, cursorIndex));
  wrap.appendChild(sup);

  return wrap;
}

// Cuộn dòng đang gõ sao cho con trỏ luôn nhìn thấy được.
function keepCursorVisible(lineEl) {
  const cursor = lineEl.querySelector('.cursor');
  if (!cursor) return;
  const overflowRight = cursor.offsetLeft - lineEl.clientWidth + cursor.offsetWidth + 8;
  if (overflowRight > 0) {
    lineEl.scrollLeft = overflowRight;
  }
}

// Những thứ trên bàn phím/màn hình đổi theo mode đang chọn. Tách riêng để
// mỗi mode mới của Tầng 7 chỉ cần thêm vào đây.
function syncModeChrome() {
  const calcMode = engine.getCalcMode();
  optnKeyEl.classList.toggle('key-locked', !OPTN_MODES.includes(calcMode));
  if (calcKeyEl) {
    // Verify dùng nhãn đỏ ALPHA+= trên chính phím CALC. Không được làm mờ
    // hoặc công bố aria-disabled cho cả phím chỉ vì CALC trần không áp dụng.
    const enabled = ['calculate', 'complex', 'verify'].includes(calcMode);
    calcKeyEl.classList.toggle('key-locked', !enabled);
    calcKeyEl.setAttribute('aria-disabled', String(!enabled));
  }
  complexBadgeEl.textContent = calcMode === 'complex'
    ? (engine.getComplexFormat() === 'polar' ? '∠' : 'i')
    // CASIO 2026-10-20: Polynomial bật Complex Result hiện i; hệ ẩn không có.
    : (calcMode === 'equation' && engine.getEquationComplexResults() && engine.getState().header ? 'i' : '');
}

// Engine giữ biểu thức gốc, chọn biến cần nhập và cung cấp giá trị hiển thị.
// Trình tự biểu thức trên/biến dưới và vùng chọn đã đối chiếu 2026-09-17.
function renderCalc(state) {
  syncResultScroll(null);
  screenEl.innerHTML = '';
  const expression = document.createElement('div');
  expression.className = 'screen-line screen-line-expr math-expression';
  expression.appendChild(renderNodes(state.expressionNodes || [], null, -1));
  screenEl.appendChild(expression);

  const field = document.createElement('div');
  field.className = 'screen-line calc-field math-field';
  const label = document.createElement('span');
  label.textContent = state.variable + '=';
  field.appendChild(label);
  const value = document.createElement('span');
  const hasDraft = state.draftNodes && state.draftNodes.length > 0;
  field.className += ' calc-input-field' + (hasDraft ? '' : ' calc-field-selected');
  value.className = 'calc-value' + (hasDraft ? ' screen-input' : ' calc-selected');
  if (hasDraft) {
    value.appendChild(renderNodes(state.draftNodes, state.cursorList, state.cursorIndex));
  } else {
    value.textContent = state.selectedText;
    field.style.setProperty('--lcd-field-columns', String(state.variable.length + String(state.selectedText).length + 1.8));
  }
  field.appendChild(value);
  screenEl.appendChild(field);
  if (hasDraft) keepCursorVisible(value);
}

// SOLVE trả nghiệm thập phân và sai lệch L−R riêng; không đi qua S⇔D.
// Engine tìm nghiệm, UI chỉ vẽ dữ liệu đã định dạng từ Engine.
function renderSolve(state) {
  syncResultScroll(null);
  screenEl.innerHTML = '';
  const expression = document.createElement('div');
  expression.className = 'screen-line screen-line-expr' + (state.continue ? ' solve-title' : ' math-expression');
  if (state.continue) {
    expression.classList.add('lcd-text');
    const title = state.title || 'Continue:[=]';
    expression.textContent = title === 'Continue:[=]'
      ? uiText('Continue:[=]', 'Tiếp tục:[=]') : title;
  } else {
    expression.appendChild(renderNodes(state.expressionNodes || [], null, -1));
  }
  screenEl.appendChild(expression);

  [[state.variable + '=', state.result], ['L−R=', state.residual]].forEach(([label, text]) => {
    const field = document.createElement('div');
    field.className = 'screen-line calc-field solve-field math-field';
    field.style.setProperty('--lcd-field-columns', String(label.length + text.length + 0.5));
    const name = document.createElement('span');
    name.textContent = label;
    const value = document.createElement('span');
    value.className = 'calc-value';
    value.textContent = text;
    field.appendChild(name);
    field.appendChild(value);
    screenEl.appendChild(field);
  });
}

// Màn hình Bộ soạn thảo hệ số: dòng tiêu đề kiểu tỷ lệ, mỗi ô một dòng, và
// dòng nghiệm khi đã tính xong.
// ĐÃ XÁC NHẬN 2026-08-17 cách máy thật xếp màn hình này cho cả ba kiểu:
// Ratio một dòng `0:0 = X:0`, đa thức một dòng kèm tiêu đề `ax²+bx+c`, hệ
// phương trình n dòng gom trong dấu ngoặc nhọn. Bố cục do engine mô tả bằng
// `template`, chỗ này chỉ vẽ theo nên đổi cách vẽ không đụng tới engine.
// Số dòng bảng dữ liệu hiện cùng lúc — ĐÃ XÁC NHẬN 2026-08-25: máy luôn vẽ
// ĐỦ BỐN dòng, kể cả khi chưa có số liệu nào (bảng rỗng vẫn thấy 1 2 3 4), và
// cửa sổ trượt theo con trỏ (con trỏ ở dòng 6 thì thấy 3-4-5-6).
const STAT_EDITOR_VISIBLE_ROWS = 4;

// Bảng dữ liệu của mode Statistics.
function renderStatisticsEditor(state) {
  screenEl.innerHTML = '';

  const table = document.createElement('div');
  table.className = 'stat-table';

  // Engine đưa xuống mảng cột (một cột x; hoặc x + Freq; hoặc x + y) — mỗi cột
  // có nhãn và các ô, chung dòng tiêu đề và chung số thứ tự dòng. ĐÃ XÁC NHẬN
  // 2026-08-26/27.
  const columns = state.columns;
  table.style.setProperty('--data-columns', String(columns.length));

  const head = document.createElement('div');
  head.className = 'stat-row stat-head';
  head.appendChild(makeCell('stat-index', ''));
  columns.forEach((col) => head.appendChild(makeCell('stat-cell', col.label)));
  table.appendChild(head);

  const top = Math.max(0, state.cursor - (STAT_EDITOR_VISIBLE_ROWS - 1));
  for (let i = 0; i < STAT_EDITOR_VISIBLE_ROWS; i++) {
    const row = document.createElement('div');
    row.className = 'stat-row';
    row.appendChild(makeCell('stat-index', String(top + i + 1)));
    columns.forEach((col) => {
      const cell = col.cells[top + i];
      row.appendChild(makeCell('stat-cell' + (cell && cell.selected ? ' stat-selected' : ''),
        cell ? cell.text : ''));
    });
    table.appendChild(row);
  }
  screenEl.appendChild(table);

  // Dòng dưới cùng: giá trị ĐẦY ĐỦ của ô đang chọn, hoặc biểu thức đang gõ dở.
  const bottom = document.createElement('div');
  bottom.className = 'screen-line screen-line-result data-value';
  if (state.draftNodes && state.draftNodes.length > 0) {
    bottom.classList.add('screen-input', 'data-draft');
    bottom.appendChild(renderNodes(state.draftNodes, state.cursorList, state.cursorIndex));
  } else {
    bottom.textContent = state.selectedText;
  }
  screenEl.appendChild(bottom);
  keepCursorVisible(bottom);
}

// Distribution List dùng cùng editor bốn dòng với Statistics, nhưng có thêm
// tên loại phân phối ở mép phải như bản giả lập chính thức. Cột P bị xoá toàn
// bộ ngay khi sửa x; engine chịu trách nhiệm trạng thái đó, UI chỉ vẽ dữ liệu.
function renderDistributionList(state) {
  renderStatisticsEditor(state);
  const table = screenEl.querySelector('.stat-table');
  if (table) table.classList.add('distribution-list-table');

  const title = document.createElement('div');
  title.className = 'distribution-list-title';
  title.textContent = localizeDistributionTypeLabel(state.typeLabel);
  screenEl.appendChild(title);
}

function localizeMatrixText(text) {
  if (uiLanguage !== 'vi') return text;
  return ({
    'Define Matrix': 'Tạo ma trận',
    'Edit Matrix': 'Sửa ma trận',
    'Number of Rows?': 'Số dòng?',
    'Number of Columns?': 'Số cột?',
    'Select 1~4': 'Chọn 1~4'
  })[text] || text;
}

// Matrix M1+M2: các màn chọn MatA-D/kích thước, editor và lưới kết quả 4x4.
// Dữ liệu và con trỏ do matrix.js quyết định; UI chỉ vẽ đúng cấu trúc LCD.
function renderMatrix(state) {
  screenEl.innerHTML = '';
  if (state.screen === 'select' || state.screen === 'edit-select') {
    const box = document.createElement('div');
    box.className = 'matrix-menu';
    box.appendChild(makeCell('matrix-menu-title', localizeMatrixText(state.title)));
    const list = document.createElement('div');
    list.className = 'matrix-menu-options';
    state.options.forEach((name, i) => {
      list.appendChild(makeCell('matrix-menu-item', String(i + 1) + ':' + name));
    });
    box.appendChild(list);
    screenEl.appendChild(box);
    return;
  }
  if (state.screen === 'dimension') {
    const box = document.createElement('div');
    box.className = 'matrix-dimension';
    box.appendChild(makeCell('matrix-dimension-title', localizeMatrixText(state.title)));
    box.appendChild(makeCell('matrix-dimension-prompt', localizeMatrixText(state.prompt)));
    box.appendChild(makeCell('matrix-dimension-select', localizeMatrixText(state.selectText)));
    screenEl.appendChild(box);
    return;
  }
  if (state.screen === 'editor' || state.screen === 'result') {
    const wrap = document.createElement('div');
    wrap.className = 'matrix-editor';
    wrap.appendChild(makeCell('matrix-editor-title', state.title));
    const grid = document.createElement('div');
    grid.className = 'matrix-grid';
    grid.style.gridTemplateColumns = `repeat(${state.cols}, minmax(0, 1fr))`;
    state.values.forEach((row, rowIndex) => row.forEach((value, colIndex) => {
      grid.appendChild(makeCell(
        'matrix-cell' + (rowIndex === state.cursor.row && colIndex === state.cursor.col ? ' matrix-cell-selected' : ''),
        localizedNumberText(value)
      ));
    }));
    wrap.appendChild(grid);
    screenEl.appendChild(wrap);
    const bottom = document.createElement('div');
    bottom.className = 'screen-line screen-line-result matrix-selected-value data-value';
    if (state.draftNodes && state.draftNodes.length > 0) {
      bottom.classList.add('screen-input', 'data-draft');
      bottom.appendChild(renderNodes(state.draftNodes, state.cursorList, state.cursorIndex));
    } else {
      bottom.textContent = localizedNumberText(state.selectedText);
    }
    screenEl.appendChild(bottom);
    keepCursorVisible(bottom);
  }
}

function localizeVectorText(text) {
  if (uiLanguage !== 'vi') return text;
  return ({
    'Define Vector': 'Tạo vecto',
    'Edit Vector': 'Sửa vecto',
    'Dimension?': 'Kích thước?',
    'Select 2~3': 'Chọn 2~3'
  })[text] || text;
}

// Vector dùng cùng ngôn ngữ hình ảnh với Matrix nhưng chỉ có một cột 2/3 ô.
function renderVector(state) {
  screenEl.innerHTML = '';
  if (state.screen === 'select' || state.screen === 'edit-select') {
    const box = document.createElement('div');
    box.className = 'matrix-menu';
    box.appendChild(makeCell('matrix-menu-title', localizeVectorText(state.title)));
    const list = document.createElement('div');
    list.className = 'matrix-menu-options';
    state.options.forEach((name, i) => {
      list.appendChild(makeCell('matrix-menu-item', String(i + 1) + ':' + name));
    });
    box.appendChild(list);
    screenEl.appendChild(box);
    return;
  }
  if (state.screen === 'dimension') {
    const box = document.createElement('div');
    box.className = 'matrix-dimension';
    box.appendChild(makeCell('matrix-dimension-title', localizeVectorText(state.title)));
    box.appendChild(makeCell('matrix-dimension-prompt', localizeVectorText(state.prompt)));
    box.appendChild(makeCell('matrix-dimension-select', localizeVectorText(state.selectText)));
    screenEl.appendChild(box);
    return;
  }
  if (state.screen === 'editor' || state.screen === 'result') {
    const wrap = document.createElement('div');
    wrap.className = 'matrix-editor vector-editor';
    wrap.appendChild(makeCell('matrix-editor-title', state.title));
    const grid = document.createElement('div');
    grid.className = 'matrix-grid vector-grid';
    grid.style.gridTemplateColumns = 'minmax(0, 1fr)';
    state.values.forEach((value, index) => {
      grid.appendChild(makeCell(
        'matrix-cell vector-cell' + (index === state.cursor ? ' matrix-cell-selected' : ''),
        localizedNumberText(value)
      ));
    });
    wrap.appendChild(grid);
    screenEl.appendChild(wrap);
    const bottom = document.createElement('div');
    bottom.className = 'screen-line screen-line-result matrix-selected-value data-value';
    if (state.draftNodes && state.draftNodes.length > 0) {
      bottom.classList.add('screen-input', 'data-draft');
      bottom.appendChild(renderNodes(state.draftNodes, state.cursorList, state.cursorIndex));
    } else {
      bottom.textContent = localizedNumberText(state.selectedText);
    }
    screenEl.appendChild(bottom);
    keepCursorVisible(bottom);
  }
}

function localizedNumberText(value) {
  let text = String(value).replace(/^-/, '−');
  if (engine.getDigitSeparator()) {
    text = text.replace(/(^|[^\d.,])(\d{4,})(?=([.,]\d+)?(?:[^\d]|$))/g,
      (_match, prefix, digits) => prefix + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' '));
  }
  if (engine.getDecimalMark() === 'comma') text = text.replace(/\./g, ',');
  return text;
}

function makeCell(className, text) {
  const el = document.createElement('div');
  el.className = className;
  el.textContent = text;
  return el;
}

// Số dòng bảng Table hiện cùng lúc (máy hiện 4 dòng dữ liệu — ĐÃ XÁC NHẬN
// 2026-08-31).
const TABLE_VISIBLE_ROWS = 4;

// Mode Table: ba màn hình.
//   'func'  — "f(x)=" / "g(x)=" + biểu thức đang gõ (cây node Tầng 5).
//   'range' — hộp thoại Start/End/Step, ô đang chọn tô đậm.
//   'table' — lưới [#] | x | f(x) | g(x); giá trị đầy đủ ô đang chọn ở dòng dưới.
function renderTable(state) {
  screenEl.innerHTML = '';

  if (state.screen === 'func') {
    const line = document.createElement('div');
    line.className = 'screen-line screen-input';
    const label = document.createElement('span');
    label.className = 'table-fn-prompt';
    label.textContent = state.prompt;
    line.appendChild(label);
    line.appendChild(renderNodes(state.draftNodes || [], state.cursorList, state.cursorIndex));
    screenEl.appendChild(line);
    keepCursorVisible(line);
    return;
  }

  if (state.screen === 'range') {
    // Bọc cả bốn dòng vào MỘT container: #screen dùng space-between (neo dòng
    // đầu lên trên, dòng cuối xuống dưới) — với một con duy nhất thì cả cụm
    // neo lên trên và xếp khít, đúng kiểu hộp thoại của máy thật.
    const box = document.createElement('div');
    box.className = 'table-range';
    const title = document.createElement('div');
    title.className = 'table-range-title';
    title.textContent = uiText('Table Range', 'Phạm vi bảng');
    box.appendChild(title);
    state.fields.forEach((field, i) => {
      const row = document.createElement('div');
      row.className = 'table-range-row' + (i === state.active ? ' table-range-active' : '');
      const localizedLabel = uiLanguage === 'vi'
        ? ({ Start: 'Bđầu', End: 'Kthúc', Step: 'Bước' }[field.label] || field.label)
        : field.label;
      row.appendChild(makeCell('table-range-label', localizedLabel + ':'));
      const valueCell = document.createElement('div');
      valueCell.className = 'table-range-value';
      // Ô đang chọn mà có gõ dở thì hiện cây node đang gõ; ngược lại hiện giá trị.
      if (i === state.active && state.draftNodes && state.draftNodes.length > 0) {
        valueCell.appendChild(renderNodes(state.draftNodes, state.cursorList, state.cursorIndex));
      } else {
        valueCell.textContent = field.text;
      }
      row.appendChild(valueCell);
      box.appendChild(row);
    });
    screenEl.appendChild(box);
    return;
  }

  // screen === 'table': lưới.
  const table = document.createElement('div');
  table.className = 'stat-table';

  const columns = state.columns;
  table.style.setProperty('--data-columns', String(columns.length));
  const head = document.createElement('div');
  head.className = 'stat-row stat-head';
  head.appendChild(makeCell('stat-index', ''));
  columns.forEach((col) => head.appendChild(makeCell('stat-cell', col.label)));
  table.appendChild(head);

  const top = Math.max(0, state.cursor - (TABLE_VISIBLE_ROWS - 1));
  for (let i = 0; i < TABLE_VISIBLE_ROWS; i++) {
    const rowIndex = top + i;
    const row = document.createElement('div');
    row.className = 'stat-row';
    // Cột số thứ tự dòng chỉ hiện khi dòng đó có dữ liệu.
    row.appendChild(makeCell('stat-index', rowIndex < state.rowCount ? String(rowIndex + 1) : ''));
    columns.forEach((col) => {
      const cell = col.cells[rowIndex];
      row.appendChild(makeCell('stat-cell' + (cell && cell.selected ? ' stat-selected' : ''),
        cell ? cell.text : ''));
    });
    table.appendChild(row);
  }
  screenEl.appendChild(table);

  // Dòng dưới: đang gõ dở ô x thì hiện cây node đang gõ; ngược lại hiện giá trị
  // ĐẦY ĐỦ của ô đang chọn (như Bộ soạn thảo Statistics).
  const bottom = document.createElement('div');
  bottom.className = 'screen-line screen-line-result data-value';
  if (state.draftNodes && state.draftNodes.length > 0) {
    bottom.classList.add('screen-input', 'data-draft');
    bottom.appendChild(renderNodes(state.draftNodes, state.cursorList, state.cursorIndex));
  } else {
    bottom.textContent = state.selectedText;
  }
  screenEl.appendChild(bottom);
  keepCursorVisible(bottom);
}

// Màn hình Base-N: chỉ báo cơ số + dòng nhập/kết quả. Kết quả nhị phân dài
// (32 bit nhóm 4-bit) tự XUỐNG DÒNG trong ô — ĐÃ XÁC NHẬN 2026-08-28 máy vẽ
// hai dòng. Số hex/oct/dec một dòng, căn phải như kết quả thường.
function renderBaseN(state, baseN) {
  screenEl.innerHTML = '';
  const header = document.createElement('div');
  header.className = 'screen-line basen-header';
  header.textContent = '[' + (state.baseNLabel || (baseN ? baseN.label : 'Dec')) + ']';
  screenEl.appendChild(header);

  if (state.mode === 'result') {
    const exprLine = document.createElement('div');
    exprLine.className = 'screen-line screen-line-expr';
    exprLine.appendChild(renderNodes(state.expressionNodes || [], null, -1));
    screenEl.appendChild(exprLine);

    const resultLine = document.createElement('div');
    resultLine.className = 'screen-line screen-line-result basen-result';
    resultLine.textContent = state.result;
    screenEl.appendChild(resultLine);
    return;
  }

  const inputLine = document.createElement('div');
  inputLine.className = 'screen-line screen-input';
  inputLine.appendChild(renderNodes(state.nodes, state.cursorList, state.cursorIndex));
  screenEl.appendChild(inputLine);
  keepCursorVisible(inputLine);
}

// Danh sách 13 giá trị của `1-Variable Calc`, sáu dòng một trang.
function renderStatisticsList(state) {
  screenEl.innerHTML = '';
  const list = document.createElement('div');
  list.className = 'stat-list';
  state.rows.slice(state.statsTop, state.statsTop + STAT_ROWS_PER_PAGE).forEach((row) => {
    const line = document.createElement('div');
    line.className = 'stat-list-row';
    line.appendChild(makeCell('stat-list-label', row.label));
    line.appendChild(makeCell('stat-list-value', '=' + row.text));
    list.appendChild(line);
  });
  screenEl.appendChild(list);
}

// Màn hình `Regression Calc` của kiểu hai biến: dòng tiêu đề "y=a+bx" rồi ba
// dòng a, b, r — ĐÃ XÁC NHẬN 2026-08-27. r để trống khi mọi y bằng nhau.
function renderStatisticsRegression(state) {
  screenEl.innerHTML = '';
  const header = document.createElement('div');
  header.className = 'stat-list-row';
  header.appendChild(makeCell('stat-list-label', state.header));
  screenEl.appendChild(header);
  const list = document.createElement('div');
  list.className = 'stat-list';
  state.rows.forEach((row) => {
    const line = document.createElement('div');
    line.className = 'stat-list-row';
    line.appendChild(makeCell('stat-list-label', row.label));
    line.appendChild(makeCell('stat-list-value', '=' + row.text));
    list.appendChild(line);
  });
  screenEl.appendChild(list);
}

// Headers are display text only; keep the engine's result metadata intact.
// CASIO 2026-10-01: cubic extrema put the formula on a separate LCD line.
function localizeEquationHeader(header) {
  if (!header) return header;
  return header
    .replace(/^Local Max of /, uiText('Local Max of\n', 'Cực đại của\n'))
    .replace(/^Local Min of /, uiText('Local Min of\n', 'Cực tiểu của\n'))
    .replace(/^Min of /, uiText('Min of ', 'GTNN '))
    .replace(/^Max of /, uiText('Max of ', 'GTLN '));
}

// Follow the selected coefficient with ◀▶/▲▼. All equations share the
// horizontal viewport, while separate polynomial lines scroll independently.
function keepCoefficientVisible(root) {
  const selected = root.querySelector('.coef-slot-selected');
  if (!selected || typeof selected.getBoundingClientRect !== 'function') return;
  const row = selected.closest('.coef-template');
  if (!row) return;
  const cellRect = selected.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  let offset = row.scrollLeft;
  if (cellRect.right > rowRect.right) offset += cellRect.right - rowRect.right + 4;
  if (cellRect.left < rowRect.left) offset -= rowRect.left - cellRect.left + 4;
  const braced = row.closest('.coef-block-braced');
  const rows = braced ? braced.querySelectorAll('.coef-template') : [row];
  rows.forEach(line => { line.scrollLeft = Math.max(0, offset); });
}

// Form Phân phối dùng ba hàng nhìn thấy được; bản đang gõ ở trong ô,
// không dùng dòng draft lớn phía dưới của Equation/Ratio.
function renderDistributionForm(state) {
  syncResultScroll(null);screenEl.innerHTML='';
  const box=document.createElement('div');box.className='coefficient-top distribution-form';
  const heading=document.createElement('div');heading.className='coefficient-heading lcd-text';
  heading.textContent=localizeDistributionTypeLabel(state.header);box.appendChild(heading);
  const selected=Math.max(0,state.cells.findIndex(cell=>cell.selected));
  const first=Math.max(0,selected-2),last=Math.min(state.cells.length,first+3);
  scrollBadgeEl.textContent=(first>0?'▲':'')+(last<state.cells.length?'▼':'');
  const hasDraft=Boolean(state.draftNodes && state.draftNodes.length);
  for(const cell of state.cells.slice(first,last)) {
    const row=document.createElement('div');row.className='distribution-field'+(cell.selected && !hasDraft?' distribution-field-selected':'');
    const label=document.createElement('span');label.className='lcd-text';
    label.textContent=(uiLanguage==='vi'?({Lower:'Ldưới',Upper:'Ltrên'}[cell.label]||cell.label):cell.label)+':';
    const value=document.createElement('span');value.className='distribution-field-value';
    if(cell.selected && hasDraft) {value.className+=' screen-input';value.appendChild(renderNodes(state.draftNodes,state.cursorList,state.cursorIndex));}
    else value.textContent=localizedNumberText(cell.text);
    row.appendChild(label);row.appendChild(value);box.appendChild(row);
  }
  screenEl.appendChild(box);keepCursorVisible(box);
}

function renderCoefficientEditor(state) {
  if(state.mode==='distribution' && state.result===null) {renderDistributionForm(state);return;}
  // Nghiệm dạng số của bậc 3/4 có thể dài hơn màn hình (vd nghiệm phức
  // "−0.6299605249+1.091123636i"), nên màn hình này cũng phải cuộn được.
  // Nhãn nằm ở DÒNG RIÊNG nên không chiếm ô nào của cửa sổ cuộn.
  syncResultScroll(typeof state.result === 'string' ? null : plainRootText(state.result));
  screenEl.innerHTML = '';

  const top = document.createElement('div');
  top.className = 'coefficient-top' + (state.template && !state.braced && ['equation','inequality'].includes(state.mode) ? ' coefficient-polynomial' : '');

  const typeLine = document.createElement('div');
  typeLine.className = 'screen-line screen-line-expr coefficient-heading';
  // Dòng tiêu đề: màn hình nhập đa thức hiện "ax²+bx+c"; màn hình nghiệm đổi
  // sang "ax²+bx+c=0" rồi "Min of y=ax²+bx+c"; Ratio không có tiêu đề nào.
  // ĐÃ XÁC NHẬN 2026-08-17.
  // Ratio không có tiêu đề nhưng vẫn CHỪA dòng 1 trống — trên máy thật cái tỷ
  // lệ nằm ở dòng 2, không dính lên đỉnh màn hình.
  const resultHeader = state.result && state.result.header;
  // Màn hình chữ trần "No Local Max/Min" KHÔNG có tiêu đề và cũng không vẽ
  // lại dòng hệ số — ĐÃ XÁC NHẬN 2026-08-23: cả màn hình chỉ có mỗi dòng
  // chữ đó, dòng trên cùng để TRỐNG chứ không rơi về tiêu đề đa thức.
  const bareMessage = !!(state.result && state.result.form === 'message');
  const headerText = resultHeader || state.header;
  const localizedHeader = state.mode === 'distribution'
    ? localizeDistributionTypeLabel(headerText)
    : localizeEquationHeader(headerText);
  const headingText = bareMessage ? ' ' : (localizedHeader || ' ');
  // Style only the words; the polynomial keeps the LCD math font.
  const formulaStart = headingText.indexOf('y=');
  if (formulaStart > 0) {
    const words = document.createElement('span');
    words.className = 'lcd-text';
    words.textContent = headingText.slice(0, formulaStart);
    typeLine.appendChild(words);
    typeLine.appendChild(document.createTextNode(headingText.slice(formulaStart)));
  } else {
    typeLine.textContent = headingText;
    if (state.mode === 'distribution') typeLine.classList.add('lcd-text');
  }
  // Dòng trống ở trên chỉ dành cho màn hình NHẬP (máy đặt cái tỷ lệ ở dòng 2,
  // không dính đỉnh màn hình). Màn hình NGHIỆM mà không có tiêu đề thì nhãn
  // nằm ngay DÒNG ĐẦU — ĐÃ XÁC NHẬN 2026-08-23: Ratio hiện "X=" và hệ 2 ẩn
  // hiện "x=" sát mép trên, không chừa dòng nào.
  const showingResult = state.result !== null && !state.draftNodes;
  if ((!showingResult && !state.braced) || resultHeader || bareMessage) {
    top.appendChild(typeLine);
  }

  // ===== Màn hình NGHIỆM khác hẳn màn hình NHẬP =====
  // ĐÃ XÁC NHẬN 2026-08-23 trên bản giả lập, bấm lại cả bốn màn hình vì
  // đường vẽ này dùng chung:
  //   đa thức bậc 2  ax²+bx+c=0 / x₁= / (−3+√17)/4 canh phải
  //   đa thức bậc 3  ax³+bx²+cx+d=0 / x₁= / 1 canh phải
  //   Ratio          X= / 9/2 canh phải          (không có dòng tiêu đề)
  //   hệ 2 ẩn        x= / 2 canh phải            (không có dòng tiêu đề)
  // Hai điều rút ra, ĐỀU KHÁC bản trước:
  //   1. Màn hình nghiệm KHÔNG vẽ lại dòng hệ số / dòng tỷ lệ / hệ phương
  //      trình. Bản trước vẫn vẽ, nên thừa hẳn một dòng so với máy.
  //   2. Nhãn ("x₁=", "X=", "x=") đứng RIÊNG MỘT DÒNG, canh trái, ngay
  //      dưới tiêu đề; giá trị canh PHẢI ở dưới. Bản trước ghép nhãn và giá
  //      trị vào cùng một dòng.
  // Màn hình NHẬP thì giữ nguyên như cũ (đã đối chiếu 2026-08-17).
  if (!bareMessage && !showingResult) {
    top.appendChild(state.template ? buildTemplateBlock(state) : buildCoefficientGrid(state));
  }
  if (showingResult) {
    const labelLine = document.createElement('div');
    labelLine.className = 'screen-line screen-line-expr';
    labelLine.textContent = resultScreenLabel(state);
    top.appendChild(labelLine);
  }
  screenEl.appendChild(top);

  // Dòng dưới cùng, ba trạng thái — ĐÃ XÁC NHẬN 2026-08-17:
  //   đang gõ dở  → chính biểu thức đó, bên TRÁI, có con trỏ
  //   có nghiệm   → nghiệm, bên PHẢI
  //   còn lại     → giá trị ô đang chọn, bên PHẢI
  if (state.draftNodes) {
    const draft = buildDraftLine(state);
    screenEl.appendChild(draft);
    keepCursorVisible(draft);
  } else {
    screenEl.appendChild(
      state.result !== null ? buildCoefficientResultLine(state) : buildCellValueLine(state)
    );
  }
  keepCoefficientVisible(top);
}

// Inequality có hai màn chọn native, một Bộ soạn thảo hệ số và một màn hình
// tập nghiệm. Không dùng overlay cho hai bước đầu vì CASIO thật cũng vẽ chúng
// ngay trên LCD sau khi chọn mode.
function renderInequality(state) {
  syncInequalityScroll(state.screen === 'result' ? JSON.stringify(state.result) : null);
  syncResultScroll(null);
  if (state.screen === 'editor') {
    renderCoefficientEditor(state);
    return;
  }

  screenEl.innerHTML = '';
  if (state.screen === 'degree') {
    const titleLines = uiLanguage === 'vi'
      ? ['Bất Ptrình', 'đa thức bậc?'] : ['Polynomial', 'Degree?'];
    titleLines.forEach((text) => {
      const title = document.createElement('div');
      title.className = 'screen-line screen-line-expr lcd-menu-line';
      title.textContent = text;
      screenEl.appendChild(title);
    });
    const select = document.createElement('div');
    select.className = 'screen-line lcd-menu-line lcd-menu-select';
    select.textContent = state.selectText === 'Select 2~4'
      ? uiText('Select 2~4', 'Chọn 2~4') : state.selectText;
    screenEl.appendChild(select);
    return;
  }

  if (state.screen === 'relation') {
    // CASIO dùng bốn quan hệ không tiêu đề ở cả hai ngôn ngữ.
    state.options.forEach((option, index) => {
      const line = document.createElement('div');
      line.className = 'screen-line lcd-menu-line';
      line.textContent = (index + 1) + ':' + option;
      screenEl.appendChild(line);
    });
    return;
  }

  const result = state.result;
  if (result.kind === 'all' || result.kind === 'none') {
    const line = document.createElement('div');
    line.className = 'screen-line screen-line-result screen-terminal-message';
    line.classList.add('lcd-text');
    line.textContent = localizeResultMessage(
      result.kind === 'all' ? 'All Real Numbers' : 'No Solution');
    screenEl.appendChild(line);
    return;
  }

  const header = document.createElement('div');
  header.className = 'screen-line screen-line-expr';
  header.textContent = inequalitySolutionHeader(result.segments);
  const line = document.createElement('div');
  line.className = 'screen-line screen-line-result inequality-result';
  const viewport = document.createElement('span');
  viewport.className = 'inequality-scroll-viewport';
  const content = document.createElement('span');
  content.className = 'inequality-scroll-content';
  content.appendChild(renderNodes(buildInequalitySolutionNodes(result.segments), null, -1));
  viewport.appendChild(content); line.appendChild(viewport);
  screenEl.appendChild(header);
  screenEl.appendChild(line);
  positionInequalityScroll(line);
}

function inequalitySolutionHeader(segments) {
  const letters = ['a', 'b', 'c', 'd'];
  let letterIndex = 0;
  const separator = engine.getResultSeparator();
  return segments.map((segment) => {
    if (segment.low !== null && segment.high !== null &&
        segment.low.value === segment.high.value) {
      return 'x=' + letters[letterIndex++];
    }
    if (segment.low === null) {
      return 'x' + (segment.includeHigh ? '≤' : '<') + letters[letterIndex++];
    }
    if (segment.high === null) {
      return letters[letterIndex++] + (segment.includeLow ? '≤' : '<') + 'x';
    }
    const low = letters[letterIndex++];
    const high = letters[letterIndex++];
    return low + (segment.includeLow ? '≤' : '<') + 'x' +
      (segment.includeHigh ? '≤' : '<') + high;
  }).join(separator);
}

function buildInequalitySolutionNodes(segments) {
  const nodes = [];
  const addText = (text) => nodes.push(...textNodes(text));
  const addEndpoint = (endpoint) => nodes.push(...buildRootNodes(endpoint.display));
  const separator = engine.getResultSeparator();
  segments.forEach((segment, index) => {
    if (index > 0) addText(separator);
    if (segment.low !== null && segment.high !== null &&
        segment.low.value === segment.high.value) {
      addText('x=');
      addEndpoint(segment.low);
      return;
    }
    if (segment.low === null) {
      addText('x' + (segment.includeHigh ? '≤' : '<'));
      addEndpoint(segment.high);
      return;
    }
    if (segment.high === null) {
      addEndpoint(segment.low);
      addText((segment.includeLow ? '≤' : '<') + 'x');
      return;
    }
    addEndpoint(segment.low);
    addText((segment.includeLow ? '≤' : '<') + 'x' +
      (segment.includeHigh ? '≤' : '<'));
    addEndpoint(segment.high);
  });
  return nodes;
}

// Khối mẫu inline. Ratio và đa thức có MỘT dòng; hệ phương trình có n dòng
// gom trong một dấu ngoặc nhọn — ĐÃ XÁC NHẬN 2026-08-17.
function buildTemplateBlock(state) {
  const block = document.createElement('div');
  block.className = 'coef-block' + (state.braced ? ' coef-block-braced' : '');
  state.template.forEach((row) => block.appendChild(buildTemplateLine(state, row)));
  return block;
}

// Một mục của mẫu inline: chữ cố định, ô hệ số, hoặc dấu ± lấy từ dấu của ô.
function buildTemplateLine(state, row) {
  const line = document.createElement('div');
  line.className = 'screen-line coef-template';
  row.forEach((item) => {
    if (item.text !== undefined) {
      line.appendChild(document.createTextNode(item.text));
      return;
    }
    const cell = state.cells[item.signOf !== undefined ? item.signOf : item.cell];
    if (item.signOf !== undefined) {
      // Hệ số âm biến dấu thành toán tử: `3x − 1`, không phải `3x + −1`.
      // Đang gõ dở thì chưa biết dấu cuối cùng, giữ "+" cho khỏi nhảy chữ.
      line.appendChild(document.createTextNode(cell.negative ? ' − ' : ' + '));
      return;
    }
    const cellEl = document.createElement('span');
    cellEl.className = 'coef-slot';
    if (cell.selected && state.result === null) {
      cellEl.classList.add('coef-slot-selected');
    }
    cellEl.textContent = item.abs ? cell.absText : cell.text;
    line.appendChild(cellEl);
  });
  return line;
}

// Lưới ô có nhãn — không mode nào đang dùng nữa (cả ba kiểu đều đã có
// `template` đối chiếu từ máy thật). Giữ lại làm chỗ dựa cho mode Tầng 7 mới
// chưa kịp khai báo template, để nó vẫn hiện được gì đó thay vì trống trơn.
function buildCoefficientGrid(state) {
  const grid = document.createElement('div');
  grid.className = 'coef-grid';
  grid.style.gridTemplateColumns = 'repeat(' + (state.columns || 1) + ', auto)';
  state.cells.forEach((cell) => {
    const cellEl = document.createElement('div');
    cellEl.className = 'coef-cell';
    if (cell.selected && state.result === null) {
      cellEl.classList.add('coef-cell-selected');
    }
    const labelEl = document.createElement('span');
    labelEl.className = 'coef-label';
    labelEl.textContent = cell.label;
    const valueEl = document.createElement('span');
    valueEl.className = 'coef-value';
    valueEl.textContent = cell.text;
    cellEl.appendChild(labelEl);
    cellEl.appendChild(valueEl);
    grid.appendChild(cellEl);
  });
  return grid;
}

function buildCellValueLine(state) {
  const cell = state.cells.find((c) => c.selected) || state.cells[0];
  const line = document.createElement('div');
  line.className = 'screen-line screen-line-result';
  line.textContent = cell.text;
  return line;
}

// Biểu thức đang gõ dở trong ô hệ số. Vẽ bằng CHÍNH renderNodes của Tầng 5 nên
// phân số, căn, sin... trong ô hệ số trông giống hệt ngoài mode Calculate.
function buildDraftLine(state) {
  const line = document.createElement('div');
  line.className = 'screen-line screen-line-draft screen-input';
  line.appendChild(renderNodes(state.draftNodes, state.cursorList, state.cursorIndex));
  keepCursorVisible(line);
  return line;
}

// Dòng kết quả: Ratio trả về một chuỗi số, Equation trả về một object nghiệm
// (hoặc thông báo hệ suy biến).
function buildCoefficientResultLine(state) {
  const line = document.createElement('div');
  line.className = 'screen-line screen-line-result';

  // Ratio: nghiệm là chuỗi số, nhưng ĐÃ XÁC NHẬN 2026-08-17 máy thật hiện
  // dạng PHÂN SỐ CHÍNH XÁC trước (3:8=X:12 → 9/2 xếp tầng) rồi S⇔D mới đổi
  // sang 4.5 / thập phân tuần hoàn. Ba nhánh dưới đây dùng lại đúng các hàm
  // vẽ của mode Calculate nên nghiệm Ratio trông giống hệt kết quả thường.
  // Nhãn đã nằm ở dòng riêng phía trên (xem renderCoefficientEditor), nên
  // dòng này CHỈ còn giá trị.
  if (typeof state.result === 'string') {
    if (state.exactFraction) {
      line.appendChild(renderResultFraction(state.exactFraction));
    } else if (state.recurringDecimal) {
      line.appendChild(document.createTextNode(state.recurringDecimal));
    } else {
      line.appendChild(document.createTextNode(state.result));
    }
    return line;
  }
  if (state.result.kind === 'message') {
    line.classList.add('lcd-text');
    line.textContent = localizeResultMessage(state.result.message);
    return line;
  }

  // Màn hình chữ trần của cực trị bậc 3 khi đồ thị không có cực trị: không
  // nhãn, không dấu "=". ĐÃ XÁC NHẬN 2026-08-23.
  if (state.result.form === 'message') {
    line.classList.add('lcd-text');
    line.textContent = scrollWindow(localizeResultMessage(state.result.text));
    return line;
  }

  line.appendChild(renderNodes(buildRootNodes(state.result), null, -1));
  // KHÔNG có chỉ báo thứ tự nghiệm. ĐÃ XÁC NHẬN 2026-08-17 trên bản giả lập:
  // màn hình nghiệm của 2x²+3x−1=0 chỉ có nhãn "x₁="/"x₂=" và chỉ báo cuộn
  // ▼/▼▲/▲ ở góc phải trên — chỉ báo "1/2" là do ta tự nghĩ ra.
  return line;
}

// Nhãn của màn hình nghiệm: "x₁=" của đa thức, "X=" của Ratio, "x=" của hệ
// phương trình. Màn hình chữ trần ("No Local Max/Min") và màn hình thông báo
// ("No Solution") không có nhãn nào.
function resultScreenLabel(state) {
  const result = state.result;
  if (typeof result === 'string') return state.unknownLabel + '=';
  if (!result || result.kind === 'message' || result.form === 'message') return ' ';
  return result.label + '=';
}

// Một nghiệm → mảng node để renderNodes vẽ. Ba dạng dùng lại đúng các hàm
// dựng node đã có từ Tầng 5 nên nghiệm trông giống hệt kết quả ở mode
// Calculate, không vẽ lại từ đầu.
function textNodes(text) {
  return String(text).split('').map((ch) => ({ type: 'char', ch }));
}

// Chuỗi trần của một nghiệm, khi nghiệm đó là dạng SỐ. Dùng chung cho việc
// vẽ và cho việc quyết định có cuộn ngang hay không, nên hai chỗ không thể
// lệch nhau. Trả về null cho các dạng xếp tầng (phân số, căn thức) — những
// dạng đó không phải một dòng chữ nên không cuộn.
function plainRootText(root) {
  if (!root) return null;
  if (root.form === 'decimal' || root.form === 'message') return root.text;
  if (root.form === 'complexDecimal') return complexDecimalText(root);
  return null;
}

function complexDecimalText(root) {
  const magnitude = root.imIsOne ? '' : root.im;
  if (root.reIsZero) return (root.imNegative ? '−' : '') + magnitude + 'i';
  return root.re + (root.imNegative ? '−' : '+') + magnitude + 'i';
}

function buildRootNodes(root) {
  if (root.form === 'fraction') {
    const nodes = [];
    if (root.fraction.negative) nodes.push({ type: 'char', ch: '−' });
    if (root.fraction.int !== undefined) {
      nodes.push({
        type: 'mixed',
        int: textNodes(root.fraction.int),
        num: textNodes(root.fraction.num),
        den: textNodes(root.fraction.den)
      });
    } else {
      nodes.push(...surdNumberNodes(root.fraction.num, root.fraction.den));
    }
    return nodes;
  }
  if (root.form === 'surd') {
    return buildRootSurdNodes(root.surd);
  }
  // Nghiệm bậc 3/4 dạng số: chỉ là chuỗi chữ, không có tầng nào để xếp.
  if (root.form === 'decimal') {
    return textNodes(scrollWindow(root.text));
  }
  // Nghiệm phức dạng số. ĐÃ XÁC NHẬN 2026-08-23 trên bản giả lập, ba dạng:
  //   x⁴−1=0     → "i" và "−i"        (phần thực 0 và hệ số 1 đều không viết)
  //   x⁴+5x²+4=0 → "2i" và "−2i"
  //   x³−2=0     → "−0.6299605249+1.091123636i"
  if (root.form === 'complexDecimal') {
    return textNodes(scrollWindow(complexDecimalText(root)));
  }
  return buildComplexRootNodes(root);
}

// Nghiệm phức. ĐÃ XÁC NHẬN 2026-08-17 trên bản giả lập chính hãng, ba dạng:
//   x²+1=0    → "i"            (phần thực 0 thì KHÔNG viết "0+", hệ số 1 cũng
//                               không viết)
//   x²+4=0    → "2i"
//   2x²+2x+5=0 → (−1+3i)/2     (MỘT phân số, phần phức nằm trong tử —
//                               không phải "−1/2 + 3/2 i")
// Dạng thứ ba là đúng quy tắc đã gặp ở nghiệm căn thức: máy không tách mẫu
// số chung ra hai số hạng.
//
// Phần thực luôn thuần hữu tỉ (nằm ở rational, coeff = 0) nên KHÔNG đưa qua
// buildSurdNodes — hàm đó luôn vẽ một dấu căn, sẽ ra "√1".
function buildComplexRootNodes(root) {
  const re = root.re;
  const im = root.im;

  // Phần thực bằng 0: chỉ vẽ phần ảo, kèm dấu của nó.
  if (re.rationalNum === '0') {
    const nodes = [];
    if (im.coeffNegative) nodes.push({ type: 'char', ch: '−' });
    nodes.push(...buildImaginaryNodes(im));
    return nodes;
  }

  // Cùng mẫu số (nghiệm bậc 2 luôn cùng mẫu 2a): gộp thành một phân số.
  if (re.rationalDen === im.coeffDen && re.rationalDen !== '1') {
    const num = [];
    if (re.rationalNegative) num.push({ type: 'char', ch: '−' });
    num.push(...charNodes(re.rationalNum));
    num.push({ type: 'char', ch: im.coeffNegative ? '−' : '+' });
    num.push(...buildImaginaryNodes({ ...im, coeffDen: '1', coeffNegative: false }));
    return [{ type: 'frac', num, den: charNodes(re.rationalDen) }];
  }

  const nodes = [];
  if (re.rationalNegative) nodes.push({ type: 'char', ch: '−' });
  nodes.push(...surdNumberNodes(re.rationalNum, re.rationalDen));
  nodes.push({ type: 'char', ch: im.coeffNegative ? '−' : '+' });
  nodes.push(...buildImaginaryNodes(im));
  return nodes;
}

// Nghiệm vô tỉ của phương trình vẽ thành MỘT phân số, dấu căn nằm trong TỬ.
// ĐÃ XÁC NHẬN 2026-08-17 trên bản giả lập chính hãng: 2x²+3x−1=0 hiện
//   −3+√17
//   ──────      chứ KHÔNG phải  −3/4 + √17/4  như bản trước vẽ.
//      4
// Chỉ gộp khi hai mẫu bằng nhau — nghiệm bậc 2 luôn cùng mẫu 2a nên điều kiện
// này luôn đúng ở đây; khác mẫu thì trả về cách vẽ cũ cho an toàn.
//
// Cố ý KHÔNG sửa buildSurdNodes dùng chung: kết quả căn thức ở mode Calculate
// đã đối chiếu riêng từ trước, chưa bấm lại trong đợt này nên không đụng vào.
function buildRootSurdNodes(surd) {
  const sameDen = surd.rationalDen === surd.coeffDen && surd.rationalDen !== '1';
  if (!sameDen || surd.rationalNum === '0') {
    return buildSurdNodes(surd);
  }
  const num = [];
  if (surd.rationalNegative) num.push({ type: 'char', ch: '−' });
  num.push(...charNodes(surd.rationalNum));
  num.push({ type: 'char', ch: surd.coeffNegative ? '−' : '+' });
  if (surd.coeffNum !== '1') num.push(...charNodes(surd.coeffNum));
  num.push({ type: 'sqrt', arg: charNodes(surd.radicand) });
  return [{ type: 'frac', num, den: charNodes(surd.rationalDen) }];
}

// Phần ảo (đã bỏ dấu, dấu do buildRootNodes vẽ) + chữ "i".
function buildImaginaryNodes(im) {
  const nodes = [];
  if (im.radicand === '1') {
    // Phần ảo thuần hữu tỉ (vd x²+1=0 → ±i). Hệ số 1 thì không viết "1i".
    if (!(im.coeffNum === '1' && im.coeffDen === '1')) {
      nodes.push(...surdNumberNodes(im.coeffNum, im.coeffDen));
    }
  } else {
    nodes.push(...buildSurdNodes({
      rationalNum: '0',
      rationalDen: '1',
      rationalNegative: false,
      coeffNegative: false,
      coeffNum: im.coeffNum,
      coeffDen: im.coeffDen,
      radicand: im.radicand
    }));
  }
  nodes.push({ type: 'char', ch: 'i' });
  return nodes;
}

function render() {
  screenWrapEl.dataset.language = uiLanguage;
  screenEl.dataset.overwrite = String(engine.getOverwriteMode());
  // ĐÃ XÁC NHẬN 2026-08-17: đơn vị góc hiện bằng MỘT chữ trong ô — D/R/G,
  // không phải chữ "DEG"/"RAD".
  const angleBadges = { deg: 'D', rad: 'R', grad: 'G' };
  angleUnitBadgeEl.textContent = angleBadges[engine.getAngleUnit()] || 'D';
  angleUnitBadgeEl.dataset.unit = angleUnitBadgeEl.textContent;
  // LineI không hiện chỉ báo MathI. ĐÃ XÁC NHẬN 2026-09-29 khi chuyển cả
  // Dòng vào/ra và Dòng vào/Stp ra trên CASIO chính thức.
  ioBadgeEl.textContent = usesLineInput() ? '' : '√▸';
  // ĐÃ XÁC NHẬN 2026-08-21: bật Fix thì thanh trạng thái hiện chữ FIX, bật
  // Sci thì hiện SCI, Norm thì không hiện gì. Cả hai đứng SAU ô đơn vị góc.
  const fmt = engine.getNumberFormat();
  numberFormatBadgeEl.textContent = fmt.kind === 'fix' ? 'FIX' : fmt.kind === 'sci' ? 'SCI' : '';
  // Chỉ báo (E) khi bật Engineer Symbol — ĐÃ XÁC NHẬN 2026-08-23 (manual
  // trang 27 cũng ghi "Chỉ báo (E) sẽ hiển thị ở phía trên cùng của màn hình").
  engineerBadgeEl.textContent = engine.getEngineerSymbol() ? 'E' : '';
  // ĐÃ XÁC NHẬN 2026-08-20: chữ M sáng khi bộ nhớ độc lập khác 0, tắt khi = 0.
  memoryBadgeEl.textContent = engine.isMemoryActive() ? 'M' : '';
  storeBadgeEl.hidden = pendingVariableMode !== 'sto';
  syncModeChrome();

  if (isOverlayOpen()) {
    return;
  }

  const state = engine.getState();
  if (state.mode !== 'inequality') syncInequalityScroll(null);
  screenEl.dataset.inputWarning=String(['input','calc'].includes(state.mode) && engine.getInputUsage().remaining<=10);

  // Nhãn góc phải ("Statistics" / "1-Variable") chỉ có ở màn hình TÍNH của
  // mode Statistics — ĐÃ XÁC NHẬN 2026-08-25. Bảng dữ liệu và danh sách kết
  // quả KHÔNG có nhãn này, và nó chỉ hiện khi màn hình tính còn TRỐNG:
  // sau "Med+1 =" máy chỉ còn biểu thức và kết quả, không còn nhãn. Thiếu
  // vế "còn trống" thì nhãn ĐÈ LÊN chính dòng kết quả — bộ test không bắt
  // được vì đây là chuyện chồng hình, phải nhìn mới thấy (2026-08-25).
  const corner = engine.getModeCorner();
  const emptyCalcScreen = state.mode === 'input' && !state.buffer;
  screenEl.dataset.emptyVerify=String(engine.getCalcMode()==='verify' && emptyCalcScreen);
  modeCornerEl.dataset.kind=engine.getCalcMode();
  modeCornerEl.textContent = corner && state.mode !== 'statistics' && emptyCalcScreen
    ? localizeModeCorner(corner).join('\n')
    : '';

  // Chỉ báo cuộn lịch sử ở góc trên bên PHẢI. Engine đã quyết định hai cờ,
  // đây chỉ dịch ra ký tự. Màn hình lỗi không có cờ nào nên tự động trống —
  // ĐÃ XÁC NHẬN 2026-08-20 là máy thật cũng không hiện chỉ báo lúc báo lỗi.
  scrollBadgeEl.textContent = (state.scrollDown ? '▼' : '') + (state.scrollUp ? '▲' : '');

  // Màn hình lỗi của máy thật KHÔNG chỉ có một dòng chữ — ĐÃ XÁC NHẬN
  // 2026-08-17, cả Math ERROR lẫn Syntax ERROR đều vẽ cùng một khuôn 4 dòng:
  //   Math ERROR
  //
  //   [AC]  :Cancel
  //   [◀][▶]:Goto
  // Tên lỗi ở dòng trên cùng, hai dòng hướng dẫn ở đáy.
  if (state.mode === 'error') {
    screenEl.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'screen-line error-title';
    title.textContent = localizeErrorMessage(state.message);
    const hints = document.createElement('div');
    hints.className = 'error-hints';
    [uiText('[AC]  :Cancel', '[AC]  :Hủy'),
      uiText('[◀][▶]:Goto', '[◀][▶]:Đi đến')].forEach((text) => {
      const line = document.createElement('div');
      line.className = 'screen-line';
      line.textContent = text;
      hints.appendChild(line);
    });
    screenEl.appendChild(title);
    screenEl.appendChild(hints);
    return;
  }

  if (state.mode === 'calc') {
    renderCalc(state);
    return;
  }

  if (state.mode === 'solve') {
    renderSolve(state);
    return;
  }

  // Base-N: dòng đầu là chỉ báo cơ số [Dec]/[Hex]/[Bin]/[Oct], rồi biểu thức
  // và kết quả đã định dạng theo cơ số. (Màn hình LỖI ở trên KHÔNG có chỉ báo
  // này — đã xác nhận: Syntax ERROR của Base-N vẽ khuôn lỗi thường.)
  if (state.baseNLabel !== undefined || (engine.getBaseNBase() && state.mode !== 'error')) {
    renderBaseN(state, engine.getBaseNBase());
    return;
  }

  // Statistics có màn hình riêng cho bảng dữ liệu và cho danh sách kết quả;
  // màn hình TÍNH của nó thì rơi xuống đường vẽ thường bên dưới.
  if (state.mode === 'statistics') {
    if (state.screen === 'stats') renderStatisticsList(state);
    else if (state.screen === 'regression') renderStatisticsRegression(state);
    else renderStatisticsEditor(state);
    return;
  }

  // Distribution có hai họ màn hình: List dùng bảng x|P; Variable và form
  // tham số của List dùng chung Bộ soạn thảo hệ số.
  if (state.mode === 'distribution') {
    if (state.screen === 'list') renderDistributionList(state);
    else renderCoefficientEditor(state);
    return;
  }

  if (state.mode === 'inequality') {
    renderInequality(state);
    return;
  }

  // Ratio và Equation/Func dùng chung màn hình Bộ soạn thảo hệ số.
  if (state.mode === 'ratio' || state.mode === 'equation') {
    renderCoefficientEditor(state);
    return;
  }

  // Mode Table: màn nhập hàm (f(x)=/g(x)=), hộp thoại Range, và bảng.
  if (state.mode === 'table') {
    renderTable(state);
    return;
  }

  if (state.mode === 'matrix') {
    renderMatrix(state);
    return;
  }

  if (state.mode === 'vector') {
    renderVector(state);
    return;
  }

  if (state.mode === 'result') {
    // Chỉ dòng kết quả dạng CHỮ mới cuộn. Phân số, căn thức, bội số π và
    // True/False của Verify đều là dạng xếp tầng hoặc rất ngắn.
    const scrollable = (state.coordinateResult?.layout === 'rows' || state.verifyResult !== undefined || state.dmsResult !== undefined || state.exactFraction
      || state.exactSurd || state.exactPi)
      ? null
      : (state.factorization || state.recurringDecimal || state.result);
    syncResultScroll(scrollable);
    screenEl.innerHTML = '';

    // Sau STO máy LUÔN hiện hai dòng: dòng trên là biểu thức kèm "→biến",
    // dòng dưới là giá trị. Không có kiểu hiện gọn "5A" cho số trần.
    // ĐÃ XÁC NHẬN 2026-08-18 trên bản giả lập, hai ca: 5 STO A ra "5→A"/"5",
    // 9 STO C ra "9→C"/"9". Bản trước có nhánh riêng hiện gọn, dẫn nguồn là
    // ảnh chụp máy 2026-08-12 — đọc nhầm ảnh, đã bỏ.

    // Dòng biểu thức cũng vẽ hai chiều, để phân số vừa gõ vẫn hiện đúng
    // dạng sau khi bấm "=".
    const exprLine = document.createElement('div');
    exprLine.className = 'screen-line screen-line-expr math-expression';
    if (usesLineInput() && engine.getCalcMode() === 'calculate') exprLine.className += ' line-output';
    exprLine.appendChild(renderNodes(state.expressionNodes || [], null, -1));
    if (state.storedVariable) {
      exprLine.appendChild(document.createTextNode('→' + state.storedVariable));
    }
    // M+/M− cũng dán chú thích vào cuối dòng biểu thức, cùng khuôn với STO —
    // ĐÃ XÁC NHẬN 2026-08-20: "5M+"/"5" và "3M−"/"3". Dòng dưới là GIÁ TRỊ VỪA
    // CỘNG VÀO, không phải tổng bộ nhớ (M đang −3 mà máy vẫn hiện 3).
    if (state.memoryOp) {
      exprLine.appendChild(document.createTextNode(state.memoryOp));
    }

    if (state.coordinateResult && state.coordinateResult.layout==='rows') {
      screenEl.appendChild(exprLine);
      state.coordinateResult.labels.forEach((label,i)=>{
        const row=document.createElement('div');row.className='screen-line calc-field solve-field';
        const name=document.createElement('span');name.textContent=label+'=';
        const value=document.createElement('span');value.className='calc-value';value.textContent=state.coordinateResult.values[i];
        row.appendChild(name);row.appendChild(value);screenEl.appendChild(row);
      });
      return;
    }
    if(state.remainderResult && state.remainderResult.layout==='rows') {
      screenEl.appendChild(exprLine);
      const pair=state.remainderResult;
      for(const [label,text] of [['',pair.quotient],['R=',pair.remainder]]) {
        const row=document.createElement('div');row.className='screen-line calc-field remainder-field';
        const name=document.createElement('span');name.textContent=label;
        const value=document.createElement('span');value.className='calc-value';value.textContent=text;
        row.appendChild(name);row.appendChild(value);screenEl.appendChild(row);
      }
      return;
    }
    const resultLine = document.createElement('div');
    resultLine.className = 'screen-line screen-line-result math-result';
    // Mode Verify: dòng kết quả là chữ thay cho số; CASIO đổi cả kết quả
    // True/False khi SETUP Language chuyển sang Tiếng Việt.
    if (state.verifyResult !== undefined) {
      resultLine.textContent = localizeVerifyResult(state.verifyResult);
    } else if (state.factorization !== undefined) {
      resultLine.textContent = scrollWindow(state.factorization);
    } else if (state.dmsResult !== undefined) {
      resultLine.textContent = state.dmsResult;
    } else if (state.exactFraction) {
      resultLine.appendChild(renderResultFraction(state.exactFraction));
    } else if (state.exactSurd) {
      resultLine.appendChild(renderNodes(state.exactSurdNodes || buildSurdNodes(state.exactSurd), null, -1));
    } else if (state.exactPi) {
      resultLine.appendChild(renderNodes(buildPiMultipleNodes(state.exactPi), null, -1));
    } else if (state.recurringDecimal) {
      resultLine.textContent = scrollWindow(state.recurringDecimal);
    } else {
      resultLine.textContent = scrollWindow(state.result);
    }

    screenEl.appendChild(exprLine);
    screenEl.appendChild(resultLine);
    return;
  }

  // state.mode === 'input'
  syncResultScroll(null);
  screenEl.innerHTML = '';
  const inputLine = document.createElement('div');
  inputLine.className = 'screen-line screen-input math-input';
  inputLine.appendChild(renderNodes(state.nodes, state.cursorList, state.cursorIndex));
  screenEl.appendChild(inputLine);
  keepCursorVisible(inputLine);
}

// Base-N: phím đổi cơ số. Nhãn phím (x²/x^/log/ln) khác hẳn nghĩa cơ số nên
// ánh xạ theo TÊN ACTION gốc. ĐÃ XÁC NHẬN 2026-08-28.
const BASE_N_CONVERT_ACTIONS = {
  square: 'dec', // x²
  power: 'hex',  // x^
  logn: 'bin',   // log
  ln: 'oct'      // ln
};

// Mọi action gọi engine (không phải shift/menu — hai cái đó xử lý riêng
// trước khi tới bảng này, vì chúng không đụng engine).
const ACTIONS = {
  on: () => engine.powerOn(),
  calc: () => engine.calc(),
  solve: () => engine.solve(),
  dot: () => engine.inputDot(),
  clear: () => engine.clear(),
  delete: () => engine.deleteLast(),
  'toggle-insertion': () => engine.toggleInsertion(),
  add: () => engine.inputOperator('+'),
  subtract: () => engine.inputOperator('-'),
  multiply: () => engine.inputOperator('×'),
  divide: () => engine.inputOperator('÷'),
  permutation: () => engine.inputCombinatoric('P'),
  combination: () => engine.inputCombinatoric('C'),
  'open-paren': () => engine.inputOpenParen(),
  'close-paren': () => engine.inputCloseParen(),
  comma: () => engine.inputComma(),
  negative: () => engine.inputNegative(),
  sqrt: () => engine.inputSqrt(),
  cbrt: () => engine.inputCbrt(),
  fraction: () => engine.inputFraction(),
  // Dòng kết quả đang tràn màn hình thì ◀▶ THUỘC VỀ việc cuộn, và ở hai mép
  // thì không làm gì — KHÔNG rơi xuống hành vi "mở kết quả ra sửa" của
  // engine. ĐÃ XÁC NHẬN 2026-08-23: ở kết quả dài của 1÷17, bấm ◀ tại mép
  // trái và ▶ tại mép phải đều đứng yên, màn hình không đổi.
  eng: () => engine.getCalcMode() === 'complex'
    ? engine.inputImaginary()
    : engine.pressEngineering('down'),
  'eng-back': () => engine.getCalcMode() === 'complex'
    ? engine.inputPolarSeparator()
    : engine.pressEngineering('up'),
  'cursor-left': () => { if (!scrollResult('left')) engine.moveCursor('left'); },
  'cursor-right': () => { if (!scrollResult('right')) engine.moveCursor('right'); },
  'cursor-up': () => engine.moveCursor('up'),
  'cursor-down': () => engine.moveCursor('down'),
  sin: () => engine.inputFunction('sin('),
  cos: () => engine.inputFunction('cos('),
  tan: () => engine.inputFunction('tan('),
  asin: () => engine.inputFunction('sin⁻¹('),
  acos: () => engine.inputFunction('cos⁻¹('),
  atan: () => engine.inputFunction('tan⁻¹('),
  log: () => engine.inputFunction('log('),
  ln: () => engine.inputFunction('ln('),
  abs: () => engine.inputFunction('Abs('),
  pow10: () => engine.inputPow10(),
  times10: () => engine.inputTimesTenPower(),
  exp: () => engine.inputExpPow(),
  square: () => engine.inputOperator('²'),
  cube: () => engine.inputOperator('³'),
  factorial: () => engine.inputOperator('!'),
  'prime-factorization': () => engine.primeFactorization(),
  reciprocal: () => engine.inputOperator('⁻¹'),
  power: () => engine.inputPower(),
  nthroot: () => engine.inputNthRoot(),
  logn: () => engine.inputLogN(),
  'mixed-number': () => engine.inputMixedNumber(),
  integral: () => engine.inputIntegral(),
  derivative: () => engine.inputDerivative(),
  sum: () => engine.inputSum(),
  product: () => engine.inputProduct(),
  'input-x': () => engine.inputXVariable(),
  sto: () => {
    pendingVariableMode = 'sto';
    return engine.inputSto();
  },
  alpha: () => {
    pendingVariableMode = 'alpha';
    setAlphaActive(true);
    return engine.inputAlpha();
  },
  'memory-add': () => engine.memoryAdd(),
  'memory-subtract': () => engine.memorySubtract(),
  equals: () => engine.equals(),
  approx: () => engine.approxEquals(),
  'toggle-exact': () => engine.toggleExactDecimal(),
  'toggle-mixed': () => engine.toggleMixedFraction(),
  dms: () => engine.inputDms(),
  pi: () => engine.inputPi(),
  ans: () => engine.inputAns(),
  percent: () => engine.inputPercent(),
  round: () => engine.inputRound(),
  'unit-conversions': () => openUnitConversionsOverlay(),
  'calculator-reset': () => openResetMenu(),
  'scientific-constants': () => openScientificConstantsOverlay(),
  'polar-conversion': () => engine.inputCoordinateConversion(),
  'rectangular-conversion': () => engine.inputCoordinateConversion(false),
  random: () => engine.inputRandom(),
  // OPTN đổi nội dung theo mode; mode không có menu OPTN thì phím để mờ và
  // bấm không phản ứng. Danh sách mode nằm ở OPTN_MODES — dùng CHUNG với
  // syncModeChrome() để không lặp lại điều kiện ở hai nơi rồi quên sửa một
  // nơi (đúng lỗi đã xảy ra: thêm mode Ratio và Equation vào syncModeChrome
  // nhưng quên chỗ này, làm phím OPTN chết ở cả hai mode đó).
  optn: () => {
    if (OPTN_MODES.includes(engine.getCalcMode())) {
      openOptnOverlay();
    }
  }
};

// Chức năng của nhãn chữ ĐỎ (ALPHA) không phải tên biến A-F.
const ALPHA_ACTIONS = {
  'recurring-decimal': () => engine.inputRecurringDecimal(),
  undo: () => engine.undoEdit(),
  'remainder-division': () => engine.inputRemainderDivision(),
  'relational-equals': () => engine.inputRelational('='),
  'multi-statement': () => engine.inputMultiStatement(),
  product: () => engine.inputProduct(),
  gcd: () => engine.inputFunction('GCD('),
  lcm: () => engine.inputFunction('LCM('),
  preans: () => engine.inputPreAns(),
  'random-integer': () => engine.inputRandom(true),
  'integer-part': () => engine.inputIntegerPart(),
  'integer-floor': () => engine.inputIntegerPart(true)
};

// CASIO 07/11: control keys still work after a modifier; unlabelled
// expression keys are consumed instead of silently using their primary action.
const MODIFIER_CONTROL_ACTIONS = new Set(['clear','delete','on','menu','sto',
  'alpha','equals','cursor-left','cursor-right','cursor-up','cursor-down']);

function handleKeyPress(button) {
    const primaryAction = button.dataset.action;
    // RESET root là menu nhận SHIFT; màn xác nhận bỏ qua SHIFT.
    if (resetDialog && resetDialog.phase === 'menu') {
      if (primaryAction === 'shift') { setShiftActive(!shiftActive); return; }
      if (shiftActive) { setShiftActive(false); return; }
    }
    if (handleResetDialogAction(primaryAction, button)) return;

    if (primaryAction === 'shift') {
      // SHIFT replaces ALPHA/STO; neither the badge nor the engine may
      // keep a pending register selection for the next key.
      if (pendingVariableMode) {
        pendingVariableMode = null;
        setAlphaActive(false);
        engine.cancelRegisterSelection();
      }
      setShiftActive(!shiftActive);
      render();
      return;
    }

    // Đang chờ phím biến sau ALPHA hoặc STO (xem ACTIONS.sto/alpha).
    // STO+x lưu x; ALPHA+x gọi nhãn đỏ Π.
    if (pendingVariableMode) {
      const mode = pendingVariableMode;
      const letter = button.dataset.alphaVar;
      const alphaAction = button.dataset.alphaAction;
      pendingVariableMode = null;
      setAlphaActive(false);
      if (mode === 'sto' && primaryAction === 'input-x') {
        engine.inputXVariable();
        render();
        return;
      }
      if (letter) {
        engine.inputVariable(letter);
        render();
        return;
      }
      // ALPHA + nhãn đỏ không phải tên biến: =, :, Π.
      if (mode === 'alpha' && alphaAction && ALPHA_ACTIONS[alphaAction]) {
        ALPHA_ACTIONS[alphaAction]();
        render();
        return;
      }
      // CASIO 07/11/2026: phím không chọn biến hủy STO ở cả hai lớp.
      // Số/toán tử bị bỏ qua; AC/DEL/MENU/điều hướng vẫn thực hiện lệnh.
      engine.cancelRegisterSelection();
      if ((mode === 'alpha' && primaryAction === 'alpha') ||
          !MODIFIER_CONTROL_ACTIONS.has(primaryAction) ||
          (mode === 'sto' && primaryAction === 'equals')) {
        render();
        return;
      }
    }

    let action = primaryAction;
    if (shiftActive) {
      setShiftActive(false);
      if (button.dataset.shiftAction) {
        action = button.dataset.shiftAction;
      } else if (!MODIFIER_CONTROL_ACTIONS.has(primaryAction)) {
        render();
        return;
      }
    }

    // CASIO web không tắt máy khi SHIFT+AC. Không gọi clear() hoặc đóng menu.
    // ĐÃ XÁC NHẬN 2026-10-05: nhập/kết quả/MENU/SETUP/Math ERROR giữ nguyên.
    if (action === 'simulator-off') { render(); return; }

    // Base-N: một số phím đổi nghĩa. Bấm THƯỜNG (không SHIFT): x²→DEC, x^→HEX,
    // log→BIN, ln→OCT; sáu phím có nhãn đỏ A-F ((−)/°′″/x⁻¹/sin/cos/tan) nhập
    // thẳng chữ hex. ĐÃ XÁC NHẬN 2026-08-28. Chỉ chặn khi KHÔNG mở menu.
    if (!isOverlayOpen() && engine.getBaseNBase()) {
      const baseId = BASE_N_CONVERT_ACTIONS[action];
      if (baseId) {
        engine.baseNConvert(baseId);
        render();
        return;
      }
      const hexLetter = button.dataset.alphaVar;
      if (hexLetter && 'ABCDEF'.indexOf(hexLetter) >= 0) {
        engine.inputBaseNLetter(hexLetter);
        render();
        return;
      }
    }

    if (action === 'menu') {
      // CASIO 2026-10-20: MENU không rời SETUP hay các bước chọn
      // ma trận/vectơ và số chiều. CASIO07/11: cả Edit selection cũng khóa.
      // AC thoát các màn này rồi MENU mới đổi mode.
      const state = engine.getState();
      if (!setupOverlayEl.hidden || (['matrix','vector'].includes(state.mode) && ['select','edit-select','dimension'].includes(state.screen))) return;
      openModeOverlay();
      return;
    }

    if (action === 'setup') {
      openSetupOverlay();
      return;
    }

    if (action === 'recall') {
      openRecallOverlay();
      return;
    }

    // Menu đang mở. Manual trang 7: "nhấn phím số tương ứng với số ở bên trái
    // của mục". Ba mục nhãn A/B/C của menu chính nhận phím chữ CÓ HOẶC KHÔNG
    // có ALPHA — ĐÃ XÁC NHẬN 2026-08-17 trên bản giả lập chính hãng: ở menu
    // chính, °′″ trần vào Verify, và ALPHA+°′″ cũng vào Verify. (Ghi chú cũ ở
    // đây nói "phải bấm ALPHA trước" là SAI, viết ra khi chưa bấm thử.) ▲▼ cuộn trang với
    // menu nhiều trang (menu OPTN của Verify có 2 trang). AC đóng menu mà
    // KHÔNG xoá phép tính đang có — đã xác nhận với người dùng (2026-08-13):
    // "bấm AC thì quay về hiển thị như trước". Mọi phím khác không tác dụng.
    if (isOverlayOpen()) {
      if (modeMenuActive && action && action.startsWith('cursor-')) {
        moveModeSelection(action.slice(7));
        return;
      }
      if (modeMenuActive && action === 'equals') {
        selectMenuByKey(MODE_LIST[modeMenuIndex].key);
        return;
      }
      if (contrastAdjusting && (action === 'cursor-left' || action === 'cursor-right')) {
        adjustContrast(action === 'cursor-left' ? -1 : 1);
        return;
      }
      if (action === 'clear') {
        closeOverlays();
        render();
        return;
      }
      if (action === 'alpha') {
        setMenuAlphaActive(!menuAlphaActive);
        return;
      }
      if (action === 'cursor-up' || action === 'cursor-down') {
        moveMenuPage(action === 'cursor-up' ? -1 : 1);
        return;
      }
      if(action==='cursor-left' && openMenuBack) { openMenuBack(); render(); return; }
      const letter = button.dataset.menuLetter || button.dataset.alphaVar;
      if (letter) {
        if (menuAlphaActive) setMenuAlphaActive(false);
        selectMenuByKey(letter);
        return;
      }
      if (pendingDigitPrompt) {
        applyDigitPrompt(button.dataset.digit);
        return;
      }
      selectMenuByKey(button.dataset.digit);
      return;
    }

    // Ưu tiên ACTIONS[action] TRƯỚC dataset.digit — phát hiện khi làm phím π
    // (ban đầu tưởng nhầm π nằm trên phím số "0", đã sửa sang ×10ˣ, nhưng lỗi
    // dispatch này là thật và vẫn giữ lại phòng khi sau này có phím số khác
    // gắn thêm SHIFT: nếu một phím vừa có dataset.digit vừa có
    // dataset.shiftAction, action đã được ghi đè đúng ở đoạn trên khi
    // shiftActive, nhưng kiểm dataset.digit trước sẽ vẫn gõ số thay vì chạy
    // action đã ghi đè. Phím số KHÔNG SHIFT có action===undefined nên vẫn rơi
    // đúng xuống nhánh digit như cũ, không đổi hành vi.
    if (ACTIONS[action]) {
      ACTIONS[action](button);
    } else {
      const digit = button.dataset.digit;
      if (digit !== undefined) {
        engine.inputDigit(digit);
      }
    }

    render();
}
document.querySelectorAll('.key').forEach(button => {
  button.addEventListener('click', () => handleKeyPress(button));
});

render();

// Re-align the selected coefficient when responsive layout changes width.
if (typeof ResizeObserver !== 'undefined') {
  new ResizeObserver(() => {
    keepCoefficientVisible(screenEl);
    const line = screenEl.querySelector('.inequality-result');
    if (line) positionInequalityScroll(line);
  }).observe(screenEl);
}


// Cảm ứng LCD là tiện ích tùy chọn, không thay đường bấm phím vật lý.
(() => {
  const lcd = document.getElementById('screen-wrap');
  const enabled = () => lcd.dataset.touch === 'true';
  const overlayOpen = () => [...lcd.querySelectorAll('.overlay')].some(el => !el.hidden);
  function place(x, y) {
    let best, distance = Infinity;
    const bounds = lcd.getBoundingClientRect();
    for (const point of lcd.querySelectorAll('.touch-point')) {
      const r = point.getBoundingClientRect();
      const font = parseFloat(getComputedStyle(point).fontSize);
      if (r.x < bounds.left || r.x > bounds.right || r.y < bounds.top || r.y > bounds.bottom) continue;
      const d = (x-r.x)**2 + 4*(y-(r.y-font*.35))**2;
      if (d < distance) { best = touchPositions.get(point); distance = d; }
    }
    if (best && engine.placeCursor(best.list, best.index)) render();
  }
  CalculatorTouch.bindLCD(document, lcd, window, {
    enabled, overlayOpen, place,
    scroll: dx => { for (const line of lcd.querySelectorAll('.math-input,.math-expression,.math-result')) line.scrollLeft -= dx; },
    page: direction => document.querySelector('.key[data-action="cursor-' + direction + '"]').click()
  });
  CalculatorTouch.bindKeys(document, document.getElementById('keypad'), window);
})();
