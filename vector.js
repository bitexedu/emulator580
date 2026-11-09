// Mode Vector: kho VctA-D/VctAns, Define/Edit, editor 2D/3D, phép toán và
// các hàm véc-tơ. Thuần logic, không DOM.

const VECTOR_NAMES = ['VctA', 'VctB', 'VctC', 'VctD'];

function createVectorMemory() {
  return { VctA: null, VctB: null, VctC: null, VctD: null, VctAns: null };
}

function cloneVectorValue(vector) {
  if (!vector) return null;
  return { dimension: vector.dimension, values: vector.values.slice() };
}

function createZeroVector(dimension) {
  return { dimension, values: Array(dimension).fill(0) };
}

function isVectorValue(value) {
  return !!value && (value.dimension === 2 || value.dimension === 3) &&
    Array.isArray(value.values) && value.values.length === value.dimension;
}

function normalizeVectorNumber(value) {
  if (!Number.isFinite(value)) throw new EngineError('Math ERROR');
  if (Math.abs(value) < 1e-12) return 0;
  const nearest = Math.round(value);
  if (Math.abs(value - nearest) <= 1e-12 * Math.max(1, Math.abs(value))) return nearest;
  for (let denominator = 2; denominator <= 100; denominator++) {
    const rational = Math.round(value * denominator) / denominator;
    if (Math.abs(value - rational) <= 1e-12 * Math.max(1, Math.abs(value))) return rational;
  }
  return value;
}

function vectorMap(vector, mapper) {
  return {
    dimension: vector.dimension,
    values: vector.values.map((value, index) => normalizeVectorNumber(mapper(value, index)))
  };
}

function vectorCombine(left, right, mapper) {
  if (!isVectorValue(left) || !isVectorValue(right) || left.dimension !== right.dimension) {
    throw new EngineError('Dimension ERROR');
  }
  return vectorMap(left, (value, index) => mapper(value, right.values[index]));
}

function vectorAdd(left, right) {
  if (!isVectorValue(left) && !isVectorValue(right)) return normalizeVectorNumber(left + right);
  return vectorCombine(left, right, (a, b) => a + b);
}

function vectorSub(left, right) {
  if (!isVectorValue(left) && !isVectorValue(right)) return normalizeVectorNumber(left - right);
  return vectorCombine(left, right, (a, b) => a - b);
}

function vectorScale(vector, scalar) {
  if (!Number.isFinite(scalar)) throw new EngineError('Math ERROR');
  return vectorMap(vector, (value) => value * scalar);
}

function vectorCross(left, right) {
  if (!isVectorValue(left) || !isVectorValue(right) || left.dimension !== right.dimension) {
    throw new EngineError('Dimension ERROR');
  }
  const a = left.dimension === 2 ? [left.values[0], left.values[1], 0] : left.values;
  const b = right.dimension === 2 ? [right.values[0], right.values[1], 0] : right.values;
  return {
    dimension: 3,
    values: [
      normalizeVectorNumber(a[1] * b[2] - a[2] * b[1]),
      normalizeVectorNumber(a[2] * b[0] - a[0] * b[2]),
      normalizeVectorNumber(a[0] * b[1] - a[1] * b[0])
    ]
  };
}

function vectorMultiply(left, right) {
  if (!isVectorValue(left) && !isVectorValue(right)) return normalizeVectorNumber(left * right);
  if (isVectorValue(left) && !isVectorValue(right)) return vectorScale(left, right);
  if (!isVectorValue(left) && isVectorValue(right)) return vectorScale(right, left);
  return vectorCross(left, right);
}

function vectorDot(left, right) {
  if (!isVectorValue(left) || !isVectorValue(right) || left.dimension !== right.dimension) {
    throw new EngineError('Dimension ERROR');
  }
  return normalizeVectorNumber(left.values.reduce(
    (total, value, index) => total + value * right.values[index], 0));
}

function vectorMagnitude(vector) {
  if (!isVectorValue(vector)) return Math.abs(vector);
  return normalizeVectorNumber(Math.sqrt(vector.values.reduce(
    (total, value) => total + value * value, 0)));
}

function vectorUnit(vector) {
  if (!isVectorValue(vector)) throw new EngineError('Dimension ERROR');
  const magnitude = vectorMagnitude(vector);
  if (magnitude === 0) throw new EngineError('Math ERROR');
  return vectorScale(vector, 1 / magnitude);
}

function vectorAngle(left, right, angleUnit) {
  const denominator = vectorMagnitude(left) * vectorMagnitude(right);
  if (denominator === 0) throw new EngineError('Math ERROR');
  const cosine = Math.max(-1, Math.min(1, vectorDot(left, right) / denominator));
  const radians = Math.acos(cosine);
  if (angleUnit === 'rad') return normalizeVectorNumber(radians);
  return normalizeVectorNumber(radians * (angleUnit === 'grad' ? 200 : 180) / Math.PI);
}

// Parser riêng cho Vector Calc. Hỗ trợ Ans vô hướng vì manual dùng kết quả
// Abs/tích vô hướng ngay trong phép chia véc-tơ.
function evaluateVectorExpression(expression, memory, ansValue, angleUnit, numberFormat = DEFAULT_NUMBER_FORMAT, coordinateContext = null, remainderContext = null) {
  expression = materializeRandomExpression(String(expression || ''), part =>
    evaluateVectorExpression(part, memory, ansValue, angleUnit, numberFormat));
  const source = String(expression || '').replace(/\s+/g, '');
  if (coordinateContext) coordinateContext.setSource(source);
  const tokens = [];
  const names = ['Pol', 'Rec', 'Intg', 'Int', 'Rnd', 'VctAns', 'UnitV', 'Angle', 'VctA', 'VctB', 'VctC', 'VctD', 'Abs', 'Ans'];
  let index = 0;
  while (index < source.length) {
    const ch = source[index];
    if(ch==='┘'){tokens.push({type:'LINEFRAC'});index++;continue;}
    if(source.startsWith('÷R',index)){tokens.push({type:'REMDIV',start:index});index+=2;continue;}
    if(ch===UNIT_CONVERSION_MARK) {const token=readUnitConversionToken(source,index);tokens.push(token);index=token.end;continue;}
    if (/[0-9.]/.test(ch)) {
      let end = index + 1;
      while (end < source.length && /[0-9.]/.test(source[end])) end++;
      const text = source.slice(index, end);
      if ((text.match(/\./g) || []).length > 1) throw new EngineError('Syntax ERROR');
      tokens.push({ type: 'number', value: Number(text) });
      index = end;
      continue;
    }
    const name = names.find((candidate) => source.startsWith(candidate, index));
    if (name) {
      tokens.push({ type: name, start:index });
      index += name.length;
      continue;
    }
    const type = ({
      '+': '+', '-': '-', '−': '-', '*': '*', '×': '*', '/': '/', '÷': '/',
      '•': 'dot', '(': '(', ')': ')', ',': ',', '%': 'percent'
    })[ch];
    if (!type) throw new EngineError('Syntax ERROR');
    tokens.push({ type });
    index++;
  }

  let pos = 0;
  const peek = () => tokens[pos] && tokens[pos].type;
  const take = (type) => {
    if (peek() !== type) throw new EngineError('Syntax ERROR');
    return tokens[pos++];
  };

  function parsePrimary() {
    if (peek() === 'number') return take('number').value;
    if (peek() === 'Ans') {
      pos++;
      if (!Number.isFinite(ansValue)) throw new EngineError('Math ERROR');
      return ansValue;
    }
    if (['VctA', 'VctB', 'VctC', 'VctD', 'VctAns'].includes(peek())) {
      const vector = memory[peek()];
      pos++;
      if (!vector) throw new EngineError('Dimension ERROR');
      return cloneVectorValue(vector);
    }
    if (peek()==='Pol' || peek()==='Rec') {
      const token=tokens[pos++];take('(');
      const a=parseExpression();take(',');const b=parseExpression();take(')');
      const pair=coordinateConversion(token.type,a,b,angleUnit);
      if (coordinateContext) coordinateContext.accept({ ...coordinateCallRange(source,token.start), ...pair, a, b });
      return pair.first;
    }
    if (peek() === 'Int' || peek() === 'Intg') {
      const floor = peek() === 'Intg';
      pos++; take('(');
      const value = parseExpression();
      take(')');
      if (isVectorValue(value)) throw new EngineError('Math ERROR');
      return integerPartForCalculation(value, floor);
    }
    if (peek() === 'Rnd') {
      pos++; take('(');
      const value = parseExpression();
      take(')');
      // CASIO 2026-10-05: Rnd áp dụng từng phần tử, giữ nguyên kho gốc.
      if (isVectorValue(value)) return vectorMap(value, (cell) => roundForCalculation(cell, numberFormat));
      return roundForCalculation(value, numberFormat);
    }
    if (peek() === '(') {
      take('(');
      const value = parseExpression();
      take(')');
      return value;
    }
    if (peek() === 'Abs' || peek() === 'UnitV') {
      const fn = peek();
      pos++;
      take('(');
      const value = parseExpression();
      take(')');
      return fn === 'Abs' ? vectorMagnitude(value) : vectorUnit(value);
    }
    if (peek() === 'Angle') {
      pos++;
      take('(');
      const left = parseExpression();
      take(',');
      const right = parseExpression();
      take(')');
      return vectorAngle(left, right, angleUnit);
    }
    throw new EngineError('Syntax ERROR');
  }

  function parsePostfix() {
    let value = parsePrimary();
    while (peek() === 'percent') {
      pos++;
      // CASIO 2026-10-05: VctA% → Math ERROR; số vô hướng chia cho 100.
      if (isVectorValue(value)) throw new EngineError('Math ERROR');
      value /= 100;
    }
    return value;
  }

  // Ran# đứng sát số/hàm là nhân ngầm, ưu tiên trước phép ×/÷.
  // CASIO 2026-10-05: 1000Ran# trong màn tính Matrix/Vector trả số nguyên.
  function parseImplicitFactor() {
    const tokenType = () => ({'+':'PLUS','-':'MINUS'}[peek()] || peek());
    const advance = () => { const type=tokenType(); pos++; return {type}; };
    const factor = () => parseLineFraction(tokenType, advance, parsePostfix, {
      add:vectorAdd,
      negate:a => isVectorValue(a) ? vectorScale(a,-1) : -a,
      divide:(a,b) => {
        if(isVectorValue(b)) throw new EngineError('Dimension ERROR');
        if(b===0) throw new EngineError('Math ERROR');
        return isVectorValue(a) ? vectorScale(a,1/b) : a/b;
      }
    });
    let value = factor();
    while (peek() === 'number' || peek() === '(' || names.includes(peek())) {
      value = vectorMultiply(value, factor());
    }
    return value;
  }

  function parseBeforeConversion() {
    if (peek() === '+') { pos++; return parseBeforeConversion(); }
    if (peek() === '-') {
      pos++;
      const value = parseBeforeConversion();
      return isVectorValue(value) ? vectorScale(value, -1) : -value;
    }
    return parseImplicitFactor();
  }

  function parseUnary() {const value=parseBeforeConversion();return peek()==='CONVERSION'?parseUnitConversionSuffix(value,peek,()=>tokens[pos++],parsePostfix,()=>peek()==='number'||peek()==='('||names.includes(peek()),unitConversionArithmetic('vector')):value;}

  function parseTerm() {
    let value = parseUnary();
    while (peek() === '*' || peek() === '/' || peek() === 'dot' || peek()==='REMDIV') {
      const token=tokens[pos++];const op=token.type;
      const right = parseUnary();
      if(op==='REMDIV') {
        if(isVectorValue(value)||isVectorValue(right))throw new EngineError('Dimension ERROR');
        const pair=divisionRemainderNumber(value,right);value=pair.value;remainderContext?.accept(pair,token.start);
      } else if (op === '*') value = vectorMultiply(value, right);
      else if (op === 'dot') value = vectorDot(value, right);
      else if (!isVectorValue(value) && !isVectorValue(right) && right !== 0) value /= right;
      else if (isVectorValue(value) && !isVectorValue(right) && right !== 0) {
        value = vectorScale(value, 1 / right);
      } else {
        throw new EngineError(right === 0 ? 'Math ERROR' : 'Dimension ERROR');
      }
    }
    return value;
  }

  function parseExpression() {
    let value = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = tokens[pos++].type;
      const right = parseTerm();
      value = op === '+' ? vectorAdd(value, right) : vectorSub(value, right);
    }
    return value;
  }

  if (tokens.length === 0) throw new EngineError('Syntax ERROR');
  const result = parseExpression();
  if (pos !== tokens.length) throw new EngineError('Syntax ERROR');
  return isVectorValue(result) ? vectorMap(result, (value) => value) : (source.includes(UNIT_CONVERSION_MARK)?normalizeUnitConversionNumber(result):normalizeVectorNumber(result));
}

function createVectorHandler(memory) {
  const vectors = memory || createVectorMemory();
  let screen = 'select'; // select | dimension | edit-select | editor | calc | result
  let activeName = null;
  let cursor = 0;
  let copyPending = false;

  function selectedVector() {
    return activeName ? vectors[activeName] : null;
  }

  function openSelect(purpose) {
    screen = purpose === 'edit' ? 'edit-select' : 'select';
    activeName = null;
    cursor = 0;
    copyPending = false;
  }

  function openEditor(name) {
    activeName = name;
    cursor = 0;
    screen = 'editor';
    copyPending = false;
  }

  function handleDigit(digit) {
    const value = Number(digit);
    if (screen === 'select' || screen === 'edit-select') {
      if (!(value >= 1 && value <= 4)) return true;
      const name = VECTOR_NAMES[value - 1];
      if (screen === 'edit-select') {
        if (!vectors[name]) return true;
        openEditor(name);
      } else {
        activeName = name;
        screen = 'dimension';
      }
      return true;
    }
    if (screen === 'dimension') {
      if (value !== 2 && value !== 3) return true;
      vectors[activeName] = createZeroVector(value);
      openEditor(activeName);
      return true;
    }
    return false;
  }

  return {
    handleDigit,

    commitValue(value) {
      const vector = selectedVector();
      if (screen !== 'editor' || !vector || !Number.isFinite(value)) {
        throw new EngineError('Math ERROR');
      }
      vector.values[cursor] = value;
      if (cursor < vector.dimension - 1) cursor++;
    },

    equals() {
      return screen;
    },

    moveCursor(direction) {
      const vector = selectedVector();
      if ((screen !== 'editor' && screen !== 'result') || !vector) return screen;
      if (direction === 'right' || direction === 'down') {
        cursor = (cursor + 1) % vector.dimension;
      } else if (direction === 'left' || direction === 'up') {
        cursor = (cursor - 1 + vector.dimension) % vector.dimension;
      }
      return screen;
    },

    clear() {
      screen = 'calc';
      activeName = null;
      copyPending = false;
      return screen;
    },

    command(name) {
      if (name === 'define') openSelect('define');
      else if (name === 'edit') openSelect('edit');
      else if (name === 'calc') {
        screen = 'calc';
        activeName = null;
        copyPending = false;
      }
      return screen;
    },

    showResult(value) {
      if (!isVectorValue(value)) throw new EngineError('Math ERROR');
      vectors.VctAns = cloneVectorValue(value);
      activeName = 'VctAns';
      cursor = 0;
      copyPending = false;
      screen = 'result';
      return screen;
    },

    beginCopy() {
      if ((screen !== 'editor' && screen !== 'result') || !selectedVector()) return false;
      copyPending = true;
      return true;
    },

    copyTo(name) {
      if (!copyPending || !VECTOR_NAMES.includes(name) || !selectedVector()) return false;
      vectors[name] = cloneVectorValue(selectedVector());
      openEditor(name);
      return true;
    },

    startCalculation() {
      screen = 'calc';
      activeName = null;
      copyPending = false;
      return screen;
    },

    expressionScreen() {
      return screen === 'calc';
    },

    showingResult() {
      return screen === 'result';
    },

    cornerLabel() {
      return ['Vector'];
    },

    getState() {
      if (screen === 'select' || screen === 'edit-select') {
        return {
          mode: 'vector',
          screen,
          title: screen === 'select' ? 'Define Vector' : 'Edit Vector',
          options: VECTOR_NAMES.slice(),
          defined: VECTOR_NAMES.map((name) => !!vectors[name])
        };
      }
      if (screen === 'dimension') {
        return {
          mode: 'vector',
          screen: 'dimension',
          title: activeName,
          prompt: 'Dimension?',
          selectText: 'Select 2~3'
        };
      }
      if (screen === 'editor' || screen === 'result') {
        const vector = selectedVector();
        return {
          mode: 'vector',
          screen,
          title: activeName + '=' + (copyPending ? '→' : ''),
          name: activeName,
          readOnly: screen === 'result',
          dimension: vector.dimension,
          values: vector.values.slice(),
          cursor,
          selectedText: String(vector.values[cursor])
        };
      }
      return { mode: 'vector', screen: 'calc' };
    },

    getMemory() {
      const out = {};
      Object.keys(vectors).forEach((name) => { out[name] = cloneVectorValue(vectors[name]); });
      return out;
    }
  };
}
