// Mode Base-N (Tầng 7) — luật của mode, thuần hàm, không giữ trạng thái,
// không DOM. Trạng thái (cơ số hiện hành, kết quả) nằm ở engine.js. Nạp SAU
// engine.js (dùng EngineError ở phạm vi toàn cục).
//
// Toàn bộ số liệu tự bấm trên bản giả lập chính hãng 2026-08-28.
// Vào mode: MENU → 3. Mặc định cơ số [Dec].
//
// Base-N tính TOÀN SỐ NGUYÊN 32-bit CÓ DẤU. Không phân số, không hàm mũ; kết
// quả lẻ bị CẮT phần thập phân (7÷2 = 3). Bốn cơ số: Dec/Hex/Bin/Oct.

// Miền số nguyên 32-bit có dấu (manual tr.94).
const BASE_N_MIN = -2147483648n; // −2^31
const BASE_N_MAX = 2147483647n;  //  2^31 − 1
const BASE_N_WRAP = 1n << 32n;   //  2^32, để lấy bù hai khi hiển thị

// Bốn cơ số. `id` là khoá dùng khắp nơi; `radix` cơ số; `label` chữ trong chỉ
// báo góc trên-trái [Dec]/[Hex]/[Bin]/[Oct]; `digits` tập chữ số HỢP LỆ (chữ
// hoa); `pad` số ký tự đệm 0 khi hiển thị (Dec không đệm) — ĐÃ XÁC NHẬN
// 2026-08-28: Hex 8, Oct 11, Bin 32; Bin còn nhóm 4-bit.
const BASE_N_BASES = {
  dec: { id: 'dec', radix: 10n, label: 'Dec', digits: '0123456789', pad: 0 },
  hex: { id: 'hex', radix: 16n, label: 'Hex', digits: '0123456789ABCDEF', pad: 8 },
  bin: { id: 'bin', radix: 2n, label: 'Bin', digits: '01', pad: 32 },
  oct: { id: 'oct', radix: 8n, label: 'Oct', digits: '01234567', pad: 11 }
};

const BASE_N_DIGIT_VALUES = '0123456789ABCDEF';

// Một dãy chữ số (đã HOA) trong cơ số `radix` → BigInt. Không kiểm hợp lệ ở
// đây (tokenizer đã kiểm) — chỉ dựng số.
function baseNDigitsToInt(numStr, radix) {
  let value = 0n;
  for (const ch of numStr) {
    value = value * radix + BigInt(BASE_N_DIGIT_VALUES.indexOf(ch));
  }
  return value;
}

// Cơ số của một chữ tiền tố (menu OPTN trang 2): d→Dec, h→Hex, b→Bin, o→Oct.
// ĐÃ XÁC NHẬN 2026-08-31: tiền tố ép cơ số của LITERAL đứng ngay sau, độc lập
// với cơ số hiển thị (Dec mode: b1010=10, o17=15, h10+b10=18; Hex mode: d10=A).
const BASE_N_PREFIX_BASES = { d: 'dec', h: 'hex', b: 'bin', o: 'oct' };

// Đọc dãy chữ số [0-9A-F] bắt đầu tại `start`, dựng NUM trong cơ số `base`.
// Rỗng, hoặc có chữ số không hợp lệ với cơ số → Syntax ERROR (khớp máy: Dec
// mode `b12` → Syntax ERROR vì '2' không phải chữ số nhị phân, ĐÃ XÁC NHẬN
// 2026-08-31). Trả { value, next } — `next` là vị trí ngay sau dãy số.
function readBaseNNumber(expr, start, base) {
  let j = start;
  let num = '';
  while (j < expr.length && /[0-9A-F]/.test(expr[j])) {
    num += expr[j];
    j++;
  }
  if (num.length === 0) throw new EngineError('Syntax ERROR');
  for (const c of num) {
    if (base.digits.indexOf(c) < 0) throw new EngineError('Syntax ERROR');
  }
  const value = baseNDigitsToInt(num, base.radix);
  // CASIO không nhận literal thập phân 2147483648 dù phép trừ đứng
  // trước có thể làm kết quả cuối về −2147483648: `0−2147483648`
  // báo Math ERROR, còn `0−214748367−1` trả −2147483648. Vì vậy phải
  // chặn ngay LITERAL Dec thay vì chỉ kiểm kết quả cuối.
  // ĐÃ XÁC NHẬN 2026-09-07 trên bản giả lập chính thức.
  if (base.id === 'dec' && value > BASE_N_MAX) {
    throw new EngineError('Math ERROR');
  }
  return { value, next: j };
}

// Tách biểu thức phẳng thành token cho cơ số `base`. Chữ số KHÔNG hợp lệ với
// cơ số (vd "2" trong Bin) → Syntax ERROR — ĐÃ XÁC NHẬN 2026-08-28.
//
// Phân biệt HOA/thường (ĐÃ XÁC NHẬN 2026-08-31 rằng đây là ranh giới an toàn):
//   • Chữ hex A-F luôn nhập dạng HOA (inputBaseNLetter) → là CHỮ SỐ.
//   • Chữ THƯỜNG bắt đầu keyword logic: and/or/xor/xnor (infix) và tiền tố
//     d/h/b/o; chữ 'N' HOA bắt đầu hàm Neg(/Not(.
// Mọi ký tự lạ khác → Syntax ERROR: Base-N chỉ cho số nguyên + toán tử logic
// + ngoặc.
function tokenizeBaseN(expr, base) {
  const tokens = [];
  let i = 0;
  const starts = (s) => expr.startsWith(s, i);
  while (i < expr.length) {
    const ch = expr[i];
    if (ch === ' ') { i++; continue; }
    // Chữ số của cơ số HIỆN HÀNH (chỉ chữ HOA A-F là hex; thường là keyword).
    if (/[0-9A-F]/.test(ch)) {
      const num = readBaseNNumber(expr, i, base);
      tokens.push({ type: 'NUM', value: num.value });
      i = num.next;
      continue;
    }
    // Hàm tiền tố Neg( / Not( — chữ 'N' HOA. Nuốt "Neg"/"Not"; dấu "(" theo
    // sau tách thành LPAREN như thường.
    if (starts('Neg')) { tokens.push({ type: 'NEG' }); i += 3; continue; }
    if (starts('Not')) { tokens.push({ type: 'NOT' }); i += 3; continue; }
    // Toán tử logic infix (chữ thường). "xnor" trước "xor", "or" phân biệt với
    // tiền tố 'o' nhờ chữ 'r' theo sau (không phải chữ số bát phân).
    if (starts('xnor')) { tokens.push({ type: 'XNOR' }); i += 4; continue; }
    if (starts('xor')) { tokens.push({ type: 'XOR' }); i += 3; continue; }
    if (starts('and')) { tokens.push({ type: 'AND' }); i += 3; continue; }
    if (starts('or')) { tokens.push({ type: 'OR' }); i += 2; continue; }
    // Tiền tố cơ số d/h/b/o (chữ thường) — ép cơ số của số đứng ngay sau.
    if (BASE_N_PREFIX_BASES[ch] !== undefined) {
      const num = readBaseNNumber(expr, i + 1, BASE_N_BASES[BASE_N_PREFIX_BASES[ch]]);
      tokens.push({ type: 'NUM', value: num.value });
      i = num.next;
      continue;
    }
    if (ch === '+') { tokens.push({ type: 'PLUS' }); i++; continue; }
    // Cả '−' (dấu trừ thật) lẫn '-' (ASCII) đều là trừ.
    if (ch === '−' || ch === '-') { tokens.push({ type: 'MINUS' }); i++; continue; }
    if (ch === '×') { tokens.push({ type: 'MUL' }); i++; continue; }
    if (ch === '÷') { tokens.push({ type: 'DIV' }); i++; continue; }
    if (ch === '(') { tokens.push({ type: 'LPAREN' }); i++; continue; }
    if (ch === ')') { tokens.push({ type: 'RPAREN' }); i++; continue; }
    throw new EngineError('Syntax ERROR');
  }
  return tokens;
}

// Tính biểu thức phẳng `expr` trong cơ số `baseId`. Trả BigInt kết quả trong
// miền 32-bit, hoặc throw EngineError.
//   • Chữ số cấm / cú pháp sai → Syntax ERROR.
//   • Chia 0 → Math ERROR. Chia LÀM TRÒN VỀ 0 (7÷2 = 3) — BigInt tự làm vậy.
//   • Kết quả ngoài miền [−2^31, 2^31−1] → Math ERROR — ĐÃ XÁC NHẬN 2026-08-28
//     (2147483647+1). Kiểm ở KẾT QUẢ CUỐI; trung gian dùng BigInt nên chính
//     xác tuyệt đối (chưa bấm ca trung gian tràn rồi cuối lại trong miền).
function evaluateBaseN(expr, baseId) {
  const base = BASE_N_BASES[baseId] || BASE_N_BASES.dec;
  const tokens = tokenizeBaseN(expr, base);
  if (tokens.length === 0) {
    throw new EngineError('Syntax ERROR');
  }
  let pos = 0;
  const peek = () => (pos < tokens.length ? tokens[pos].type : null);
  const advance = () => tokens[pos++];

  // Thang ưu tiên (cao → thấp), ĐÃ XÁC NHẬN 2026-08-31 bằng ca phân biệt:
  //   Neg(/Not( (hàm)  >  × ÷  >  + −  >  and  >  {or, xor, xnor}
  // parseLogic (or/xor/xnor cùng cấp, trái) là tầng NGOÀI CÙNG; parseFactor
  // là trong cùng, ôm cả hàm Neg/Not và ngoặc.
  //
  // Toán tử bit chạy trên BigInt: với toán hạng trong miền 32-bit, & | ^ ~ cho
  // đúng kết quả bù hai 32-bit (bit ≥31 luôn là sign-extension nên kết quả vẫn
  // trong miền — không cần mask). Not(a) = ~a = -(a+1); xnor(a,b) = ~(a^b);
  // Neg(a) = -a (tràn ở -2^31 do range check cuối bắt).
  function parseFactor() {
    if (peek() === 'MINUS') { advance(); return -parseFactor(); }
    if (peek() === 'PLUS') { advance(); return parseFactor(); }
    if (peek() === 'NEG' || peek() === 'NOT') {
      const fn = advance().type;
      if (peek() !== 'LPAREN') throw new EngineError('Syntax ERROR');
      advance();
      const v = parseLogic();
      if (peek() !== 'RPAREN') throw new EngineError('Syntax ERROR');
      advance();
      return fn === 'NEG' ? -v : ~v;
    }
    if (peek() === 'NUM') { return advance().value; }
    if (peek() === 'LPAREN') {
      advance();
      const v = parseLogic();
      if (peek() !== 'RPAREN') throw new EngineError('Syntax ERROR');
      advance();
      return v;
    }
    throw new EngineError('Syntax ERROR');
  }
  function parseTerm() {
    let v = parseFactor();
    while (peek() === 'MUL' || peek() === 'DIV') {
      const op = advance().type;
      const rhs = parseFactor();
      if (op === 'MUL') v = v * rhs;
      else {
        if (rhs === 0n) throw new EngineError('Math ERROR');
        v = v / rhs; // BigInt chia làm tròn về 0
      }
    }
    return v;
  }
  function parseAddSub() {
    let v = parseTerm();
    while (peek() === 'PLUS' || peek() === 'MINUS') {
      const op = advance().type;
      const rhs = parseTerm();
      v = op === 'PLUS' ? v + rhs : v - rhs;
    }
    return v;
  }
  function parseAnd() {
    let v = parseAddSub();
    while (peek() === 'AND') {
      advance();
      v = v & parseAddSub();
    }
    return v;
  }
  function parseLogic() {
    let v = parseAnd();
    while (peek() === 'OR' || peek() === 'XOR' || peek() === 'XNOR') {
      const op = advance().type;
      const rhs = parseAnd();
      if (op === 'OR') v = v | rhs;
      else if (op === 'XOR') v = v ^ rhs;
      else v = ~(v ^ rhs);
    }
    return v;
  }

  const result = parseLogic();
  if (pos !== tokens.length) {
    throw new EngineError('Syntax ERROR');
  }
  if (result < BASE_N_MIN || result > BASE_N_MAX) {
    throw new EngineError('Math ERROR');
  }
  return result;
}

// Định dạng một số nguyên 32-bit (`valueBig`) để HIỂN THỊ trong cơ số `baseId`.
// ĐÃ XÁC NHẬN 2026-08-28:
//   • Dec: số nguyên có dấu, gọn (−1, 3).
//   • Hex/Oct/Bin: giá trị ÂM hiện dạng BÙ HAI 32-bit (−1 → Hex FFFFFFFF),
//     đệm 0 tới đủ độ dài, chữ HOA. Bin còn nhóm 4-bit ngăn bởi dấu cách.
function formatBaseN(valueBig, baseId) {
  const base = BASE_N_BASES[baseId] || BASE_N_BASES.dec;
  if (baseId === 'dec') {
    return valueBig.toString();
  }
  const unsigned = valueBig >= 0n ? valueBig : valueBig + BASE_N_WRAP;
  let text = unsigned.toString(Number(base.radix)).toUpperCase().padStart(base.pad, '0');
  if (baseId === 'bin') {
    // Nhóm 4-bit: "0000 0000 ... 0001 1110".
    text = text.match(/.{1,4}/g).join(' ');
  }
  return text;
}
