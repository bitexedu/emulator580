// Bảng gán phím (Tầng 6 — UI) — NGUỒN DUY NHẤT của bàn phím.
//
// Vì sao có file này: trước đây bàn phím viết tay thẳng trong index.html, mà
// bộ test lại không đọc index.html bao giờ (engine.test.html tự dựng khung DOM
// riêng). Hệ quả là toàn bộ bảng gán phím→hành động KHÔNG có gì canh, và ngày
// 2026-08-18 phát hiện một lúc ba lỗi nằm đúng trong vùng mù đó: log gán nhầm
// phím, thiếu hẳn biến M, và màn hình sau STO vẽ sai. Sửa ba lỗi đó không ngăn
// được lỗi thứ tư cùng loại, nên tách dữ liệu ra đây để trang test đọc được
// đúng cái mà index.html dựng ra.
//
// KHÔNG chứa logic tính toán — chỉ là dữ liệu mô tả phím và hàm dựng DOM.
// Mọi hành động đều là TÊN; ui.js mới là chỗ ánh xạ tên đó sang lời gọi engine.
// Nạp TRƯỚC ui.js, vì ui.js gắn sự kiện bằng querySelectorAll('.key') ngay lúc
// nạp nên bàn phím phải có sẵn trong DOM.
//
// Mỗi phím:
//   label       chữ trên mặt phím
//   cls         lớp CSS thêm vào sau 'key'
//   action      data-action — hành động khi bấm trần
//   shift       data-shift-action, kèm shiftLabel là chữ nhỏ phía trên
//   alphaVar    data-alpha-var — biến A-F/M/x/y/z sau ALPHA hoặc STO
//   alphaAction data-alpha-action — nhãn đỏ KHÔNG phải tên biến
//   menuLetter  data-menu-letter — phím tắt chọn mode khi menu chính đang mở
//   digit       data-digit
//   locked      phím máy thật CÓ nhưng ta chưa làm → mờ, bấm không phản ứng.
//               Vẫn có thể kèm shift (vd ×10ˣ khoá nhưng SHIFT ra π).
//
// Ngày trong chú thích là ngày BẤM trên bản giả lập chính hãng, không phải
// ngày viết code.

const KEYPAD_ROWS = [
  {
    // Khối điều khiển: SHIFT/ALPHA/MENU quanh phím định hướng. Thứ tự phần tử
    // ở đây quyết định bố cục (lưới 6 cột × 2 hàng, phím định hướng chiếm
    // cột 3–4 cả hai hàng) — đừng đảo thứ tự nếu không sửa CSS.
    //
    // ∫dx trần mở tích phân; SHIFT+∫dx mở d/dx — mẫu và thứ tự vùng nhập
    // đã đối chiếu lại trên giả lập chính thức 2026-09-15.
    // Σ nằm ở SHIFT+x (không phải SHIFT+∫dx như đoán ban đầu) — xác nhận
    // 2026-08-14. Π nằm ở ALPHA+x — xác nhận trực tiếp 2026-09-15.
    cls: 'krow krow-top',
    keys: [
      { label: 'SHIFT', cls: 'key-mode', action: 'shift', id: 'shift-key' },
      { label: 'ALPHA', cls: 'key-mode', action: 'alpha', id: 'alpha-key' },
      { dpad: [
        { label: '▲', cls: 'key-nav dpad-up', action: 'cursor-up' },
        { label: '◀', cls: 'key-nav dpad-left', action: 'cursor-left' },
        { center: true },
        { label: '▶', cls: 'key-nav dpad-right', action: 'cursor-right' },
        { label: '▼', cls: 'key-nav dpad-down', action: 'cursor-down' }
      ] },
      { label: 'MENU', cls: 'key-mode', action: 'menu', shift: 'setup', shiftLabel: 'SETUP' },
      { label: 'ON', action: 'on' },
      // OPTN mờ ở mode Calculate, sáng ở Verify — ui.js tự bật/tắt theo mode.
      { label: 'OPTN', cls: 'key-func', action: 'optn', id: 'optn-key' },
      // CALC và SOLVE đã đối chiếu 2026-09-17. CALC hỗ trợ Calculate/Complex;
      // SOLVE ở SHIFT chỉ hỗ trợ Calculate theo Engine.
      { label: 'CALC', cls: 'key-func', action: 'calc', id: 'calc-key',
        shift: 'solve', shiftLabel: 'SOLVE',
        alphaAction: 'relational-equals', alphaLabel: '=' },
      { label: '∫dx', cls: 'key-func key-icon', action: 'integral',
        shift: 'derivative', shiftLabel: 'd/dx',
        alphaAction: 'multi-statement', alphaLabel: ':' },
      { label: 'x', action: 'input-x', shift: 'sum', shiftLabel: 'Σ',
        alphaAction: 'product', alphaLabel: 'Π' }
    ]
  },
  {
    cls: 'krow krow-6',
    keys: [
      { label: '□/□', alphaAction: 'remainder-division', alphaLabel: '÷R', cls: 'key-func', action: 'fraction', shift: 'mixed-number', shiftLabel: 'a b/c' },
      { label: '√', printedAlpha: '(■)', alphaAction: 'recurring-decimal', cls: 'key-func', action: 'sqrt', shift: 'cbrt', shiftLabel: '∛' },
      { label: 'x²', baseLabel: 'DEC', cls: 'key-func', action: 'square', shift: 'cube', shiftLabel: 'x³' },
      { label: '^', face: 'x□', baseLabel: 'HEX', cls: 'key-func', action: 'power', shift: 'nthroot', shiftLabel: 'ⁿ√' },
      // Phím log TRẦN mở mẫu log▫(▫) hai ô (cơ số + đối) — ĐÃ XÁC NHẬN
      // 2026-08-28: con trỏ vào ô CƠ SỐ trước, ▶ sang đối; để trống ô nào rồi
      // "=" ra Syntax ERROR. KHÔNG phải log cơ số 10 — cái đó ở SHIFT+(−).
      { label: 'log▫', baseLabel: 'BIN', cls: 'key-func', action: 'logn', shift: 'pow10', shiftLabel: '10ˣ' },
      { label: 'ln', baseLabel: 'OCT', cls: 'key-func', action: 'ln', shift: 'exp', shiftLabel: 'eˣ' }
    ]
  },
  {
    cls: 'krow krow-6',
    keys: [
      // SHIFT+(−) = log cơ số 10 — ĐÃ XÁC NHẬN 2026-08-18: bấm SHIFT (−) hiện
      // "log(", gõ 100 rồi "=" ra 2.
      { label: '(-)', face: '(−)', action: 'negative', shift: 'log', shiftLabel: 'log',
        alphaVar: 'A', alphaLabel: 'A', menuLetter: 'A' },
      { label: '°′″', printedShift: 'FACT', action: 'dms', shift: 'prime-factorization', alphaVar: 'B', alphaLabel: 'B', menuLetter: 'B' },
      { label: 'x⁻¹', cls: 'key-func', action: 'reciprocal', shift: 'factorial', shiftLabel: 'x!',
        alphaVar: 'C', alphaLabel: 'C', menuLetter: 'C' },
      { label: 'sin', cls: 'key-func', action: 'sin', shift: 'asin', shiftLabel: 'sin⁻¹',
        alphaVar: 'D', alphaLabel: 'D' },
      { label: 'cos', cls: 'key-func', action: 'cos', shift: 'acos', shiftLabel: 'cos⁻¹',
        alphaVar: 'E', alphaLabel: 'E' },
      { label: 'tan', cls: 'key-func', action: 'tan', shift: 'atan', shiftLabel: 'tan⁻¹',
        alphaVar: 'F', alphaLabel: 'F' }
    ]
  },
  {
    cls: 'krow krow-6',
    keys: [
      { label: 'STO', cls: 'key-mem', action: 'sto', shift: 'recall', shiftLabel: 'RECALL' },
      // ENG đổi kết quả sang ký pháp kỹ thuật; SHIFT+ENG đi ngược lại và mang
      // nhãn ←. CASIO 2026-10-20: cùng nhãn có ∠ dùng trong Complex (BUG-002).
      { label: 'ENG', baseLabel: 'i', action: 'eng', shift: 'eng-back', shiftLabel: '∠ ←' },
      // SHIFT+( = Abs trong Complex (và Calculate). ĐÃ XÁC NHẬN
      // 2026-09-11 bằng Abs(1+i)=√2 trên giả lập CASIO chính thức.
      // Nhãn đỏ x/y/z đã bấm trên CASIO chính thức 2026-09-17.
      { label: '(', action: 'open-paren', shift: 'abs', shiftLabel: 'Abs',
        alphaVar: 'x', alphaLabel: 'x' },
      { label: ')', action: 'close-paren', shift: 'comma', shiftLabel: ',',
        alphaVar: 'y', alphaLabel: 'y' },
      { label: 'S⇔D', printedShift: 'aᵇ/c↔d/c', cls: 'key-func', action: 'toggle-exact', shift: 'toggle-mixed',
        alphaVar: 'z', alphaLabel: 'z' },
      // ALPHA+M+ = biến M — ĐÃ XÁC NHẬN 2026-08-18 (SHIFT+STO liệt kê
      // A B C D E F M x y z). Thiếu gán này thì từ giao diện không gõ nổi M.
      { label: 'M+', cls: 'key-mem', action: 'memory-add', shift: 'memory-subtract',
        shiftLabel: 'M-', alphaVar: 'M', alphaLabel: 'M' }
    ]
  },
  {
    cls: 'krow krow-5',
    keys: [
      { label: '7', shift: 'scientific-constants', shiftLabel: 'CONST', digit: '7' }, { label: '8', shift: 'unit-conversions', shiftLabel: 'CONV', digit: '8' }, { label: '9', shift: 'calculator-reset', shiftLabel: 'RESET', digit: '9' },
      { label: 'DEL', shift: 'toggle-insertion', shiftLabel: 'INS', alphaAction: 'undo', alphaLabel: 'UNDO', cls: 'key-wide', action: 'delete' },
      { label: 'AC', shift: 'simulator-off', shiftLabel: 'OFF', cls: 'key-wide', action: 'clear' }
    ]
  },
  {
    cls: 'krow krow-5',
    keys: [
      { label: '4', digit: '4' }, { label: '5', digit: '5' }, { label: '6', digit: '6' },
      { label: '×', shift: 'permutation', shiftLabel: 'nPr', alphaAction: 'gcd', alphaLabel: 'GCD', cls: 'key-op', action: 'multiply' },
      { label: '÷', shift: 'combination', shiftLabel: 'nCr', alphaAction: 'lcm', alphaLabel: 'LCM', cls: 'key-op', action: 'divide' }
    ]
  },
  {
    cls: 'krow krow-5',
    keys: [
      { label: '1', digit: '1' }, { label: '2', digit: '2' }, { label: '3', digit: '3' },
      { label: '+', shift:'polar-conversion', shiftLabel:'Pol', alphaAction: 'integer-part', alphaLabel: 'Int', cls: 'key-op', action: 'add' },
      { label: '−', shift:'rectangular-conversion', shiftLabel:'Rec', alphaAction: 'integer-floor', alphaLabel: 'Intg', cls: 'key-op', action: 'subtract' }
    ]
  },
  {
    cls: 'krow krow-5',
    keys: [
      { label: '0', printedShift: 'Rnd', digit: '0', shift: 'round' },
      { label: '.', printedShift: 'Ran#', printedAlpha: 'RanInt', action: 'dot', shift: 'random', alphaAction: 'random-integer' },
      { label: '×10ˣ', printedAlpha: 'e', action: 'times10', shift: 'pi', shiftLabel: 'π' },
      { label: 'Ans', printedShift: '%', printedAlpha: 'PreAns', action: 'ans', shift: 'percent', alphaAction: 'preans' },
      { label: '=', cls: 'key-equals', action: 'equals', shift: 'approx', shiftLabel: '≈' }
    ]
  }
];

// Dựng một phím: vùng nhãn in phía trên tách khỏi mặt bấm, cùng ánh xạ
// hành động. printedShift/printedAlpha chỉ in nhãn vật lý, không mở tính năng mới.
function buildKey(spec) {
  const button = document.createElement('button');
  button.className = 'key' + (spec.cls ? ' ' + spec.cls : '')
    + (spec.locked ? ' key-locked' : '');
  if (spec.id) button.id = spec.id;
  if (spec.action) button.dataset.action = spec.action;
  if (spec.shift) button.dataset.shiftAction = spec.shift;
  if (spec.alphaAction) button.dataset.alphaAction = spec.alphaAction;
  if (spec.alphaVar) button.dataset.alphaVar = spec.alphaVar;
  if (spec.menuLetter) button.dataset.menuLetter = spec.menuLetter;
  if (spec.digit !== undefined) button.dataset.digit = spec.digit;
  if (spec.locked) {
    button.dataset.locked = spec.locked;
    button.setAttribute('aria-disabled', 'true');
  }
  button.type = 'button';
  button.setAttribute('aria-label', spec.label);
  const legends = document.createElement('span');
  legends.className = 'key-legends';
  legends.setAttribute('aria-hidden', 'true');
  if (spec.shiftLabel || spec.printedShift) {
    const el = document.createElement('span');
    el.className = 'key-shift-label';
    el.textContent = spec.shiftLabel || spec.printedShift;
    if (!spec.shift && spec.printedShift) el.title = 'Chức năng chưa được triển khai';
    legends.appendChild(el);
  }
  if (spec.alphaLabel || spec.printedAlpha) {
    const el = document.createElement('span');
    el.className = 'key-alpha-label';
    el.textContent = spec.alphaLabel || spec.printedAlpha;
    if (!spec.alphaVar && !spec.alphaAction && spec.printedAlpha) el.title = 'Chức năng chưa được triển khai';
    legends.appendChild(el);
  }
  if (spec.baseLabel) {
    const el = document.createElement('span');
    el.className = 'key-base-label';
    el.textContent = spec.baseLabel;
    legends.appendChild(el);
  }
  button.appendChild(legends);
  const face = document.createElement('span');
  face.className = 'key-face';
  face.textContent = spec.face || spec.label;
  if (spec.action === 'power') {
    face.textContent = 'x';
    const exponent = document.createElement('sup');
    exponent.textContent = '□';
    face.appendChild(exponent);
  }
  if (spec.action === 'fraction') {
    face.textContent = '';
    face.classList.add('key-fraction');
    for (const part of ['numerator', 'denominator']) {
      const box = document.createElement('span');
      box.className = 'key-fraction-' + part;
      box.textContent = '□';
      face.appendChild(box);
    }
  }
  button.appendChild(face);
  return button;
}

function buildKeypad(container) {
  if (!container) return;
  KEYPAD_ROWS.forEach((row) => {
    const rowEl = document.createElement('div');
    rowEl.className = row.cls;
    row.keys.forEach((spec) => {
      if (spec.dpad) {
        const pad = document.createElement('div');
        pad.className = 'dpad';
        spec.dpad.forEach((sub) => {
          if (sub.center) {
            const dot = document.createElement('span');
            dot.className = 'dpad-center';
            dot.setAttribute('aria-hidden', 'true');
            pad.appendChild(dot);
            return;
          }
          pad.appendChild(buildKey(sub));
        });
        rowEl.appendChild(pad);
        return;
      }
      rowEl.appendChild(buildKey(spec));
    });
    container.appendChild(rowEl);
  });
}

// Duyệt phẳng mọi phím (kể cả phím định hướng) — trang test dùng để so bảng.
function keypadAllKeys() {
  const out = [];
  KEYPAD_ROWS.forEach((row) => row.keys.forEach((spec) => {
    if (spec.dpad) {
      spec.dpad.forEach((sub) => { if (!sub.center) out.push(sub); });
      return;
    }
    out.push(spec);
  }));
  return out;
}

buildKeypad(document.getElementById('keypad'));
