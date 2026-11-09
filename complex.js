// Mode Complex — luật số phức thuần, không DOM.
// C1: dạng chữ nhật và số học. C2: năm hàm một biến, tọa độ cực và hai
// định dạng đầu ra. UI chỉ chèn token; mọi phép tính vẫn nằm ở đây.

function complexNumber(re, im) {
  return { re, im };
}

function complexAdd(a, b) {
  return complexNumber(a.re + b.re, a.im + b.im);
}

function complexSub(a, b) {
  return complexNumber(a.re - b.re, a.im - b.im);
}

function complexMul(a, b) {
  return complexNumber(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
}

function complexDiv(a, b) {
  const denominator = b.re * b.re + b.im * b.im;
  if (denominator === 0) throw new EngineError('Math ERROR');
  return complexNumber(
    (a.re * b.re + a.im * b.im) / denominator,
    (a.im * b.re - a.re * b.im) / denominator
  );
}

function complexNeg(a) {
  return complexNumber(-a.re, -a.im);
}

function complexConjugate(a) {
  return complexNumber(a.re, -a.im);
}

function complexMagnitude(a) {
  return Math.hypot(a.re, a.im);
}

function complexFromPolar(radius, angle, angleUnit) {
  const radians = angleUnit === 'rad' ? angle
    : angle * Math.PI / (angleUnit === 'grad' ? 200 : 180);
  // Exact cardinal directions are structural zeros, not small magnitudes.
  // This avoids erasing legitimate tiny components elsewhere (BUG-024).
  const quarterTurn = angleUnit === 'rad' ? Math.PI / 2 : angleUnit === 'grad' ? 100 : 90;
  const quadrant = angle / quarterTurn;
  if (Number.isInteger(quadrant)) {
    const index = ((quadrant % 4) + 4) % 4;
    return complexNumber(radius * [1, 0, -1, 0][index], radius * [0, 1, 0, -1][index]);
  }
  return complexNumber(radius * Math.cos(radians), radius * Math.sin(radians));
}

function complexArgument(a, angleUnit) {
  const radians = Math.atan2(a.im, a.re);
  if (angleUnit === 'rad') return radians;
  return radians * (angleUnit === 'grad' ? 200 : 180) / Math.PI;
}

function complexPowInteger(base, exponent) {
  if (!Number.isInteger(exponent) || exponent <= -1e10 || exponent >= 1e10) {
    throw new EngineError('Math ERROR');
  }
  if (exponent < 0) {
    if (base.re === 0 && base.im === 0) throw new EngineError('Math ERROR');
    return complexPowInteger(complexDiv(complexNumber(1, 0), base), -exponent);
  }
  let result = complexNumber(1, 0);
  let factor = base;
  let n = exponent;
  while (n > 0) {
    if (n % 2 === 1) result = complexMul(result, factor);
    factor = complexMul(factor, factor);
    n = Math.floor(n / 2);
  }
  return result;
}

function normalizeComplexComponent(value) {
  // CASIO07/11 preserves 1e-13i through STO, recall and multiplication.
  // Magnitude alone cannot distinguish a valid input from rounding noise.
  return value === 0 ? 0 : value;
}

function normalizeComplex(value, preserveSmall = false) {
  const normalize = component => preserveSmall && component!==0 && Math.abs(component)<1e-12 ? component : normalizeComplexComponent(component);
  const normalized = complexNumber(
    normalize(value.re),
    normalize(value.im)
  );
  if (!Number.isFinite(normalized.re) || !Number.isFinite(normalized.im)) {
    throw new EngineError('Math ERROR');
  }
  return normalized;
}

function tokenizeComplex(expr) {
  const tokens = [];
  let i = 0;
  const functions = [
    ['Rnd', 'ROUND'], ['Intg', 'INTG'], ['Int', 'INT'],
    ['Conjg', 'CONJG'],
    ['Arg', 'ARG'],
    ['Abs', 'ABS'],
    ['ReP', 'REP'],
    ['ImP', 'IMP']
  ];
  while (i < expr.length) {
    const ch = expr[i];
    if(ch==='┘'){tokens.push({type:'LINEFRAC'});i++;continue;}
    if(ch===UNIT_CONVERSION_MARK) {const token=readUnitConversionToken(expr,i);tokens.push(token);i=token.end;continue;}
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < expr.length && /[0-9.]/.test(expr[j])) j++;
      const raw = expr.slice(i, j);
      if (!/^\d*\.?\d*$/.test(raw)) throw new EngineError('Syntax ERROR');
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new EngineError('Syntax ERROR');
      tokens.push({ type: 'NUMBER', value });
      i = j;
      continue;
    }
    if (expr.slice(i, i + 3) === 'Ans') {
      tokens.push({ type: 'ANS' });
      i += 3;
      continue;
    }
    const fn = functions.find(([name]) => expr.slice(i, i + name.length) === name);
    if (fn) {
      tokens.push({ type: fn[1] });
      i += fn[0].length;
      continue;
    }
    if (VARIABLE_NAMES.includes(ch)) { tokens.push({ type: 'VARIABLE', name: ch }); i++; continue; }
    if (ch === 'i') { tokens.push({ type: 'IMAGINARY' }); i++; continue; }
    if (ch === '+') { tokens.push({ type: 'PLUS' }); i++; continue; }
    if (ch === '-') { tokens.push({ type: 'MINUS' }); i++; continue; }
    if (ch === '×') { tokens.push({ type: 'MUL' }); i++; continue; }
    if (ch === '÷') { tokens.push({ type: 'DIV' }); i++; continue; }
    if (ch === '(') { tokens.push({ type: 'LPAREN' }); i++; continue; }
    if (ch === ')') { tokens.push({ type: 'RPAREN' }); i++; continue; }
    if (ch === '²') { tokens.push({ type: 'SQUARE' }); i++; continue; }
    if (ch === '³') { tokens.push({ type: 'CUBE' }); i++; continue; }
    if (expr.slice(i, i + 2) === '⁻¹') {
      tokens.push({ type: 'RECIPROCAL' });
      i += 2;
      continue;
    }
    if (ch === '^') { tokens.push({ type: 'CARET' }); i++; continue; }
    if (ch === '√') { tokens.push({ type: 'SQRT' }); i++; continue; }
    if (ch === '∛') { tokens.push({ type: 'CBRT' }); i++; continue; }
    if (ch === '∠') { tokens.push({ type: 'POLAR' }); i++; continue; }
    throw new EngineError('Syntax ERROR');
  }
  return tokens;
}

// Parser giữ cùng thứ tự ưu tiên với evaluateExpression: hậu tố/lũy thừa,
// nhân ẩn, dấu âm, ×÷, +−. Nhờ vậy các biểu thức chung không đổi ý nghĩa khi
// chuyển giữa Calculate và Complex.
function evaluateComplexExpression(expr, ansValue, angleUnit, variables, numberFormat = DEFAULT_NUMBER_FORMAT) {
  expr = materializeRandomExpression(expr, part =>
    requireReal(evaluateComplexExpression(part, ansValue, angleUnit, variables, numberFormat)));
  const tokens = tokenizeComplex(expr);
  let pos = 0;
  const ans = ansValue || complexNumber(0, 0);
  const unit = ['deg', 'rad', 'grad'].includes(angleUnit) ? angleUnit : 'deg';

  function peek() {
    return pos < tokens.length ? tokens[pos].type : null;
  }

  function advance() {
    return tokens[pos++];
  }

  function isImplicitMultTrigger() {
    return ['NUMBER', 'ANS', 'VARIABLE', 'IMAGINARY', 'LPAREN', 'SQRT', 'CBRT',
      'CONJG', 'ARG', 'ABS', 'REP', 'IMP', 'ROUND', 'INT', 'INTG'].includes(peek());
  }

  function parseFunctionArgument() {
    if (peek() !== 'LPAREN') throw new EngineError('Syntax ERROR');
    advance();
    const value = parseExpression();
    if (peek() !== 'RPAREN') throw new EngineError('Syntax ERROR');
    advance();
    return value;
  }

  function requireReal(value) {
    const normalized = normalizeComplex(value);
    if (normalized.im !== 0) throw new EngineError('Math ERROR');
    return normalized.re;
  }

  function parseAtom() {
    const type = peek();
    if (type === 'NUMBER') return complexNumber(advance().value, 0);
    if (type === 'VARIABLE') {
      const value = (variables || {})[advance().name] || 0;
      return typeof value === 'number' ? complexNumber(value, 0) : complexNumber(value.re, value.im);
    }
    if (type === 'ANS') { advance(); return complexNumber(ans.re, ans.im); }
    if (type === 'IMAGINARY') { advance(); return complexNumber(0, 1); }
    if (type === 'LPAREN') {
      advance();
      const value = parseExpression();
      if (peek() !== 'RPAREN') throw new EngineError('Syntax ERROR');
      advance();
      return value;
    }
    if (type === 'SQRT') {
      advance();
      const value = requireReal(parseFunctionArgument());
      if (value < 0) throw new EngineError('Math ERROR');
      return complexNumber(Math.sqrt(value), 0);
    }
    if (type === 'CBRT') {
      advance();
      return complexNumber(Math.cbrt(requireReal(parseFunctionArgument())), 0);
    }
    if (type === 'INT' || type === 'INTG') {
      advance();
      return complexNumber(integerPartForCalculation(requireReal(parseFunctionArgument()), type === 'INTG'), 0);
    }
    if (type === 'ROUND') {
      advance();
      const value = parseFunctionArgument();
      return complexNumber(roundForCalculation(value.re, numberFormat), roundForCalculation(value.im, numberFormat));
    }
    if (type === 'CONJG') {
      advance();
      return complexConjugate(parseFunctionArgument());
    }
    if (type === 'ABS') {
      advance();
      return complexNumber(complexMagnitude(parseFunctionArgument()), 0);
    }
    if (type === 'ARG') {
      advance();
      return complexNumber(complexArgument(parseFunctionArgument(), unit), 0);
    }
    if (type === 'REP') {
      advance();
      return complexNumber(normalizeComplex(parseFunctionArgument()).re, 0);
    }
    if (type === 'IMP') {
      advance();
      return complexNumber(normalizeComplex(parseFunctionArgument()).im, 0);
    }
    throw new EngineError('Syntax ERROR');
  }

  function parsePowerBase() {
    let value = parseAtom();
    while (true) {
      if (peek() === 'SQUARE') { advance(); value = complexMul(value, value); }
      else if (peek() === 'CUBE') {
        advance();
        value = complexMul(complexMul(value, value), value);
      } else if (peek() === 'RECIPROCAL') {
        advance();
        value = complexDiv(complexNumber(1, 0), value);
      } else break;
    }
    return value;
  }

  function parsePower() {
    const base = parsePowerBase();
    if (peek() !== 'CARET') return base;
    advance();
    const exponent = requireReal(parsePower());
    return complexPowInteger(base, exponent);
  }

  function parseImplicitFactor() {
    const factor = () => parseLineFraction(peek, advance, parsePower, {add:complexAdd,divide:complexDiv,negate:complexNeg});
    let value = factor();
    while (isImplicitMultTrigger()) value = complexMul(value, factor());
    return value;
  }

  function parseBeforeConversion() {
    if (peek() === 'MINUS') {
      advance();
      return complexNeg(parseImplicitFactor());
    }
    return parseImplicitFactor();
  }

  function parseUnary() {const value=parseBeforeConversion();return peek()==='CONVERSION'?parseUnitConversionSuffix(value,peek,advance,parsePower,isImplicitMultTrigger,unitConversionArithmetic('complex')):value;}

  function parseTerm() {
    let value = parseUnary();
    while (true) {
      if (peek() === 'MUL') { advance(); value = complexMul(value, parseUnary()); }
      else if (peek() === 'DIV') { advance(); value = complexDiv(value, parseUnary()); }
      else if (peek() === 'POLAR') {
        advance();
        const radius = requireReal(value);
        const angle = requireReal(parseUnary());
        value = complexFromPolar(radius, angle, unit);
      }
      else break;
    }
    return value;
  }

  function parseExpression() {
    let value = parseTerm();
    while (true) {
      if (peek() === 'PLUS') { advance(); value = complexAdd(value, parseTerm()); }
      else if (peek() === 'MINUS') { advance(); value = complexSub(value, parseTerm()); }
      else break;
    }
    return value;
  }

  if (tokens.length === 0) throw new EngineError('Syntax ERROR');
  const result = normalizeComplex(parseExpression(),expr.includes(UNIT_CONVERSION_MARK));
  if (pos !== tokens.length) throw new EngineError('Syntax ERROR');
  return result;
}

function complexDisplayNumber(value, numberFormat) {
  const radical = simpleComplexRadical(value);
  if (radical !== null && (!numberFormat || numberFormat.kind === 'norm')) return radical;
  return formatNumber(normalizeComplexComponent(value), numberFormat).replace(/^-/, '−');
}

function complexExactDisplayNumber(value, numberFormat) {
  const radical = simpleComplexRadical(value);
  if (radical !== null) return radical;
  const rational = approximateComplexRational(normalizeComplexComponent(value), 100);
  if (rational && rational.denominator !== 1) {
    const sign = rational.numerator < 0 ? '−' : '';
    return sign + Math.abs(rational.numerator) + '/' + rational.denominator;
  }
  return complexDisplayNumber(value, numberFormat);
}

function gcdComplexInteger(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1;
}

function approximateComplexRational(value, maxDenominator) {
  const limit = maxDenominator || 100;
  for (let denominator = 1; denominator <= limit; denominator++) {
    const numerator = Math.round(value * denominator);
    if (Math.abs(value - numerator / denominator) <= 4 * Number.EPSILON * Math.max(Math.abs(value), Math.abs(numerator / denominator))) {
      const divisor = gcdComplexInteger(numerator, denominator);
      return { numerator: numerator / divisor, denominator: denominator / divisor };
    }
  }
  return null;
}

function splitSquareFactor(value) {
  let outside = 1;
  let inside = value;
  for (let factor = 2; factor * factor <= inside; factor++) {
    const square = factor * factor;
    while (inside % square === 0) {
      outside *= factor;
      inside /= square;
    }
  }
  return { outside, inside };
}

// Nhận dạng những căn thức nhỏ mà CASIO giữ chính xác (√2, 5√3/2...).
// Chỉ chạy khi chính giá trị không phải hữu tỉ nhỏ, tránh đổi 0.1 thành 1/10
// trong những kết quả Complex vốn được máy hiển thị thập phân.
function simpleComplexRadical(value) {
  const normalized = normalizeComplexComponent(value);
  if (!Number.isFinite(normalized) || normalized === 0 || Number.isInteger(normalized)) return null;
  if (approximateComplexRational(normalized, 100)) return null;
  const square = approximateComplexRational(normalized * normalized, 100);
  if (!square || square.numerator <= 0) return null;
  const numeratorPart = splitSquareFactor(square.numerator);
  const denominatorPart = splitSquareFactor(square.denominator);
  if (denominatorPart.inside !== 1 || numeratorPart.inside === 1) return null;
  const sign = normalized < 0 ? '−' : '';
  const coefficient = numeratorPart.outside === 1 ? '' : String(numeratorPart.outside);
  const denominator = denominatorPart.outside === 1 ? '' : '/' + denominatorPart.outside;
  return sign + coefficient + '√' + numeratorPart.inside + denominator;
}

function formatComplexRect(value, numberFormat, exactComponents, roundedComponents, preserveSmall = false) {
  const normalized = normalizeComplex(value,preserveSmall);
  const re = normalized.re;
  const im = normalized.im;
  const normalDisplay = roundedComponents ? (component, format) => {
    const fraction = roundedNumberFraction(component);
    if (fraction.den !== 1n && fracDigitCount(fraction) <= 10) {
      return (fraction.num < 0n ? '−' : '') + bigAbs(fraction.num) + '/' + fraction.den;
    }
    return complexDisplayNumber(component, format);
  } : exactComponents ? complexExactDisplayNumber : complexDisplayNumber;
  const displayNumber=(component,format)=>preserveSmall && component!==0 && Math.abs(component)<1e-12
    ? formatNumber(component,format).replace(/^-/, '−') : normalDisplay(component,format);
  if (im === 0) return displayNumber(re, numberFormat);

  const coefficient = Math.abs(im) === 1 ? '' : displayNumber(Math.abs(im), numberFormat);
  const imaginary = coefficient + 'i';
  if (re === 0) return (im < 0 ? '−' : '') + imaginary;
  return displayNumber(re, numberFormat) + (im < 0 ? '−' : '+') + imaginary;
}

function normalizePolarAngle(angle, angleUnit) {
  const turn = angleUnit === 'rad' ? 2 * Math.PI : (angleUnit === 'grad' ? 400 : 360);
  const half = turn / 2;
  let normalized = angle % turn;
  if (normalized <= -half) normalized += turn;
  if (normalized > half) normalized -= turn;
  return normalizeComplexComponent(normalized);
}

function formatPolarAngle(angle, numberFormat, angleUnit) {
  const normalized = normalizePolarAngle(angle, angleUnit);
  if (angleUnit === 'rad') {
    const ratio = approximateComplexRational(normalized / Math.PI, 24);
    if (ratio) {
      if (ratio.numerator === 0) return '0';
      const sign = ratio.numerator < 0 ? '−' : '';
      const numerator = Math.abs(ratio.numerator) === 1 ? '' : Math.abs(ratio.numerator);
      const denominator = ratio.denominator === 1 ? '' : '/' + ratio.denominator;
      return sign + numerator + 'π' + denominator;
    }
  }
  return complexDisplayNumber(normalized, numberFormat);
}

function formatComplexPolar(value, numberFormat, angleUnit, preserveSmall = false) {
  const normalized = normalizeComplex(value,preserveSmall);
  const magnitude = complexMagnitude(normalized);
  const unit = ['deg', 'rad', 'grad'].includes(angleUnit) ? angleUnit : 'deg';
  const angle = complexArgument(normalized, unit);
  const magnitudeText=preserveSmall && magnitude!==0 && magnitude<1e-12 ? formatNumber(magnitude,numberFormat) : complexDisplayNumber(magnitude,numberFormat);
  // CASIO 2026-10-05: góc 0 bị lược (kể cả Ans sau RESET); góc π vẫn hiện.
  if (angle === 0) return magnitudeText;
  return magnitudeText + '∠'
    + formatPolarAngle(angle, numberFormat, unit);
}
