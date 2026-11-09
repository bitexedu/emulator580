// Mode Matrix — M1+M2: kho MatA-D/MatAns, Define/Edit, editor 1x1..4x4,
// phép toán và các hàm ma trận. Thuần logic, không DOM.

const MATRIX_NAMES = ['MatA', 'MatB', 'MatC', 'MatD'];

function createMatrixMemory() {
  return { MatA: null, MatB: null, MatC: null, MatD: null, MatAns: null };
}

function cloneMatrixValue(matrix) {
  if (!matrix) return null;
  return {
    rows: matrix.rows,
    cols: matrix.cols,
    values: matrix.values.map((row) => row.slice())
  };
}

function createZeroMatrix(rows, cols) {
  return {
    rows,
    cols,
    values: Array.from({ length: rows }, () => Array(cols).fill(0))
  };
}

function isMatrixValue(value) {
  return !!value && Number.isInteger(value.rows) && Number.isInteger(value.cols) &&
    Array.isArray(value.values);
}

function normalizeMatrixNumber(value) {
  if (!Number.isFinite(value)) throw new EngineError('Math ERROR');
  if (Math.abs(value) < 1e-12) return 0;
  const nearest = Math.round(value);
  if (Math.abs(value - nearest) <= 1e-12 * Math.max(1, Math.abs(value))) return nearest;
  // Gauss-Jordan tạo nhiễu nhị phân rất nhỏ cho các phân số đơn giản
  // (1.5 thành 1.4999999999999998). Khôi phục phân số mẫu nhỏ trước khi lưu
  // MatAns để editor/result không lộ số rác.
  for (let denominator = 2; denominator <= 100; denominator++) {
    const numerator = Math.round(value * denominator);
    const rational = numerator / denominator;
    if (Math.abs(value - rational) <= 1e-12 * Math.max(1, Math.abs(value))) return rational;
  }
  return value;
}

function matrixMap(value, mapper) {
  return {
    rows: value.rows,
    cols: value.cols,
    values: value.values.map((row, rowIndex) => row.map((cell, colIndex) =>
      normalizeMatrixNumber(mapper(cell, rowIndex, colIndex))))
  };
}

function matrixCombine(left, right, mapper) {
  if (!isMatrixValue(left) || !isMatrixValue(right) ||
      left.rows !== right.rows || left.cols !== right.cols) {
    throw new EngineError('Dimension ERROR');
  }
  return matrixMap(left, (cell, row, col) => mapper(cell, right.values[row][col]));
}

function matrixAdd(left, right) {
  if (!isMatrixValue(left) && !isMatrixValue(right)) return normalizeMatrixNumber(left + right);
  return matrixCombine(left, right, (a, b) => a + b);
}

function matrixSub(left, right) {
  if (!isMatrixValue(left) && !isMatrixValue(right)) return normalizeMatrixNumber(left - right);
  return matrixCombine(left, right, (a, b) => a - b);
}

function matrixScale(value, scalar) {
  if (!Number.isFinite(scalar)) throw new EngineError('Math ERROR');
  return matrixMap(value, (cell) => cell * scalar);
}

function matrixMultiply(left, right) {
  if (!isMatrixValue(left) && !isMatrixValue(right)) return normalizeMatrixNumber(left * right);
  if (isMatrixValue(left) && !isMatrixValue(right)) return matrixScale(left, right);
  if (!isMatrixValue(left) && isMatrixValue(right)) return matrixScale(right, left);
  if (left.cols !== right.rows) throw new EngineError('Dimension ERROR');
  const out = createZeroMatrix(left.rows, right.cols);
  for (let row = 0; row < left.rows; row++) {
    for (let col = 0; col < right.cols; col++) {
      let total = 0;
      for (let k = 0; k < left.cols; k++) total += left.values[row][k] * right.values[k][col];
      out.values[row][col] = normalizeMatrixNumber(total);
    }
  }
  return out;
}

function matrixTranspose(value) {
  if (!isMatrixValue(value)) throw new EngineError('Dimension ERROR');
  const out = createZeroMatrix(value.cols, value.rows);
  for (let row = 0; row < value.rows; row++) {
    for (let col = 0; col < value.cols; col++) out.values[col][row] = value.values[row][col];
  }
  return out;
}

function matrixIdentity(size) {
  if (!Number.isInteger(size) || size < 1 || size > 4) throw new EngineError('Argument ERROR');
  const out = createZeroMatrix(size, size);
  for (let i = 0; i < size; i++) out.values[i][i] = 1;
  return out;
}

function matrixDeterminant(value) {
  if (!isMatrixValue(value) || value.rows !== value.cols) throw new EngineError('Dimension ERROR');
  const data = value.values.map((row) => row.slice());
  let sign = 1;
  let determinant = 1;
  for (let col = 0; col < value.cols; col++) {
    let pivot = col;
    for (let row = col + 1; row < value.rows; row++) {
      if (Math.abs(data[row][col]) > Math.abs(data[pivot][col])) pivot = row;
    }
    if (Math.abs(data[pivot][col]) < 1e-14) return 0;
    if (pivot !== col) {
      [data[pivot], data[col]] = [data[col], data[pivot]];
      sign *= -1;
    }
    const pivotValue = data[col][col];
    determinant *= pivotValue;
    for (let row = col + 1; row < value.rows; row++) {
      const factor = data[row][col] / pivotValue;
      for (let k = col + 1; k < value.cols; k++) data[row][k] -= factor * data[col][k];
    }
  }
  return normalizeMatrixNumber(sign * determinant);
}

function matrixInverse(value) {
  if (!isMatrixValue(value) || value.rows !== value.cols) throw new EngineError('Dimension ERROR');
  const size = value.rows;
  const data = value.values.map((row, index) => row.concat(
    Array.from({ length: size }, (_, col) => col === index ? 1 : 0)));
  for (let col = 0; col < size; col++) {
    let pivot = col;
    for (let row = col + 1; row < size; row++) {
      if (Math.abs(data[row][col]) > Math.abs(data[pivot][col])) pivot = row;
    }
    if (Math.abs(data[pivot][col]) < 1e-14) throw new EngineError('Math ERROR');
    if (pivot !== col) [data[pivot], data[col]] = [data[col], data[pivot]];
    const divisor = data[col][col];
    for (let k = 0; k < size * 2; k++) data[col][k] /= divisor;
    for (let row = 0; row < size; row++) {
      if (row === col) continue;
      const factor = data[row][col];
      for (let k = 0; k < size * 2; k++) data[row][k] -= factor * data[col][k];
    }
  }
  return {
    rows: size,
    cols: size,
    values: data.map((row) => row.slice(size).map(normalizeMatrixNumber))
  };
}

function matrixPower(value, exponent) {
  if (!isMatrixValue(value)) return normalizeMatrixNumber(Math.pow(value, exponent));
  if (exponent === -1) return matrixInverse(value);
  if ((exponent !== 2 && exponent !== 3) || value.rows !== value.cols) {
    throw new EngineError('Dimension ERROR');
  }
  return exponent === 2
    ? matrixMultiply(value, value)
    : matrixMultiply(matrixMultiply(value, value), value);
}

function matrixAbsolute(value) {
  return isMatrixValue(value) ? matrixMap(value, Math.abs) : Math.abs(value);
}

// Parser nhỏ riêng cho MatrixCalc. Nó chỉ nhận đúng các token có thể sinh từ
// bàn phím/menu Matrix, nhờ vậy không đưa logic ma trận vào evaluator số thực.
function evaluateMatrixExpression(expression, memory, numberFormat = DEFAULT_NUMBER_FORMAT, ansValue = 0, angleUnit = 'deg', coordinateContext = null, remainderContext = null) {
  expression = materializeRandomExpression(String(expression || ''), part =>
    evaluateMatrixExpression(part, memory, numberFormat, ansValue, angleUnit));
  const source = String(expression || '').replace(/\s+/g, '');
  if (coordinateContext) coordinateContext.setSource(source);
  const tokens = [];
  const names = ['Pol', 'Rec', 'Intg', 'Int', 'Rnd', 'Ans', 'Identity', 'MatAns', 'MatA', 'MatB', 'MatC', 'MatD', 'Det', 'Trn', 'Abs'];
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
    if (source.startsWith('⁻¹', index)) {
      tokens.push({ type: 'inverse' });
      index += '⁻¹'.length;
      continue;
    }
    const type = ({ '+': '+', '-': '-', '−': '-', '*': '*', '×': '*', '/': '/', '÷': '/',
      '(': '(', ')': ')', ',': ',', '²': 'square', '³': 'cube', '%': 'percent' })[ch];
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
    if (peek() === 'Ans') { pos++; return ansValue === null ? 0 : ansValue; }
    if (['MatA', 'MatB', 'MatC', 'MatD', 'MatAns'].includes(peek())) {
      const matrix = memory[peek()];
      pos++;
      if (!matrix) throw new EngineError('Dimension ERROR');
      return cloneMatrixValue(matrix);
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
      if (isMatrixValue(value)) throw new EngineError('Math ERROR');
      return integerPartForCalculation(value, floor);
    }
    if (peek() === 'Rnd') {
      pos++; take('(');
      const value = parseExpression();
      take(')');
      // CASIO 2026-10-05: Rnd áp dụng từng phần tử, giữ nguyên kho gốc.
      if (isMatrixValue(value)) return matrixMap(value, (cell) => roundForCalculation(cell, numberFormat));
      return roundForCalculation(value, numberFormat);
    }
    if (peek() === '(') {
      take('(');
      const value = parseExpression();
      take(')');
      return value;
    }
    if (['Det', 'Trn', 'Identity', 'Abs'].includes(peek())) {
      const fn = peek();
      pos++;
      take('(');
      const value = parseExpression();
      take(')');
      if (fn === 'Det') return matrixDeterminant(value);
      if (fn === 'Trn') return matrixTranspose(value);
      if (fn === 'Identity') {
        if (isMatrixValue(value)) throw new EngineError('Argument ERROR');
        return matrixIdentity(value);
      }
      return matrixAbsolute(value);
    }
    throw new EngineError('Syntax ERROR');
  }

  function parsePostfix() {
    let value = parsePrimary();
    while (['square', 'cube', 'inverse', 'percent'].includes(peek())) {
      const op = tokens[pos++].type;
      if (op === 'percent') {
        // CASIO 2026-10-05: hậu tố % chỉ nhận vô hướng; MatA% → Math ERROR.
        if (isMatrixValue(value)) throw new EngineError('Math ERROR');
        value /= 100;
      } else value = matrixPower(value, op === 'square' ? 2 : (op === 'cube' ? 3 : -1));
    }
    return value;
  }

  // Ran# đứng sát số/hàm là nhân ngầm, ưu tiên trước phép ×/÷.
  // CASIO 2026-10-05: 1000Ran# trong màn tính Matrix/Vector trả số nguyên.
  function parseImplicitFactor() {
    const tokenType = () => ({'+':'PLUS','-':'MINUS'}[peek()] || peek());
    const advance = () => { const type=tokenType(); pos++; return {type}; };
    const factor = () => parseLineFraction(tokenType, advance, parsePostfix, {
      add:matrixAdd,
      negate:a => isMatrixValue(a) ? matrixScale(a,-1) : -a,
      divide:(a,b) => {
        if(isMatrixValue(b)) throw new EngineError('Dimension ERROR');
        if(b===0) throw new EngineError('Math ERROR');
        return isMatrixValue(a) ? matrixScale(a,1/b) : a/b;
      }
    });
    let value = factor();
    while (peek() === 'number' || peek() === '(' || names.includes(peek())) {
      value = matrixMultiply(value, factor());
    }
    return value;
  }

  function parseBeforeConversion() {
    if (peek() === '+') { pos++; return parseBeforeConversion(); }
    if (peek() === '-') {
      pos++;
      const value = parseBeforeConversion();
      return isMatrixValue(value) ? matrixScale(value, -1) : -value;
    }
    return parseImplicitFactor();
  }

  function parseUnary() {const value=parseBeforeConversion();return peek()==='CONVERSION'?parseUnitConversionSuffix(value,peek,()=>tokens[pos++],parsePostfix,()=>peek()==='number'||peek()==='('||names.includes(peek()),unitConversionArithmetic('matrix')):value;}

  function parseTerm() {
    let value = parseUnary();
    while (peek() === '*' || peek() === '/' || peek()==='REMDIV') {
      const token=tokens[pos++];const op=token.type;
      const right = parseUnary();
      if(op==='REMDIV') {
        if(isMatrixValue(value)||isMatrixValue(right))throw new EngineError('Dimension ERROR');
        const pair=divisionRemainderNumber(value,right);value=pair.value;remainderContext?.accept(pair,token.start);
      } else if (op === '*') value = matrixMultiply(value, right);
      else if (!isMatrixValue(value) && !isMatrixValue(right) && right !== 0) value /= right;
      else if (isMatrixValue(value) && !isMatrixValue(right) && right !== 0) value = matrixScale(value, 1 / right);
      else throw new EngineError(right === 0 ? 'Math ERROR' : 'Dimension ERROR');
    }
    return value;
  }

  function parseExpression() {
    let value = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = tokens[pos++].type;
      const right = parseTerm();
      value = op === '+' ? matrixAdd(value, right) : matrixSub(value, right);
    }
    return value;
  }

  if (tokens.length === 0) throw new EngineError('Syntax ERROR');
  const result = parseExpression();
  if (pos !== tokens.length) throw new EngineError('Syntax ERROR');
  return isMatrixValue(result) ? matrixMap(result, (cell) => cell) : (source.includes(UNIT_CONVERSION_MARK)?normalizeUnitConversionNumber(result):normalizeMatrixNumber(result));
}

function createMatrixHandler(memory) {
  const matrices = memory || createMatrixMemory();
  let screen = 'select'; // select | rows | cols | edit-select | editor | calc | result
  let activeName = null;
  let pendingRows = null;
  let cursorRow = 0;
  let cursorCol = 0;
  let copyPending = false;

  function selectedMatrix() {
    return activeName ? matrices[activeName] : null;
  }

  function openSelect(purpose) {
    screen = purpose === 'edit' ? 'edit-select' : 'select';
    activeName = null;
    pendingRows = null;
    cursorRow = 0;
    cursorCol = 0;
    copyPending = false;
  }

  function openEditor(name) {
    activeName = name;
    cursorRow = 0;
    cursorCol = 0;
    screen = 'editor';
    copyPending = false;
  }

  function handleDigit(digit) {
    const value = Number(digit);
    if (screen === 'select' || screen === 'edit-select') {
      // Các màn menu Matrix sở hữu toàn bộ phím số. Giá trị ngoài 1~4 được
      // CASIO bỏ qua, không được rơi xuống document editor của engine.
      if (!(value >= 1 && value <= 4)) return true;
      const name = MATRIX_NAMES[value - 1];
      if (screen === 'edit-select') {
        if (!matrices[name]) return true;
        openEditor(name);
      } else {
        activeName = name;
        screen = 'rows';
      }
      return true;
    }
    if (screen === 'rows') {
      if (!(value >= 1 && value <= 4)) return true;
      pendingRows = value;
      screen = 'cols';
      return true;
    }
    if (screen === 'cols') {
      if (!(value >= 1 && value <= 4)) return true;
      matrices[activeName] = createZeroMatrix(pendingRows, value);
      openEditor(activeName);
      return true;
    }
    return false;
  }

  function advanceCell() {
    const matrix = selectedMatrix();
    if (!matrix) return;
    if (cursorCol < matrix.cols - 1) cursorCol++;
    else if (cursorRow < matrix.rows - 1) {
      cursorRow++;
      cursorCol = 0;
    }
    // CASIO giữ nguyên ô cuối sau khi chốt giá trị cuối cùng.
  }

  return {
    handleDigit,

    commitValue(value) {
      const matrix = selectedMatrix();
      if (screen !== 'editor' || !matrix || !Number.isFinite(value)) {
        throw new EngineError('Math ERROR');
      }
      matrix.values[cursorRow][cursorCol] = value;
      advanceCell();
    },

    equals() {
      return screen;
    },

    moveCursor(direction) {
      const matrix = selectedMatrix();
      if ((screen !== 'editor' && screen !== 'result') || !matrix) return screen;
      if (direction === 'right') {
        const flat = (cursorRow * matrix.cols + cursorCol + 1) % (matrix.rows * matrix.cols);
        cursorRow = Math.floor(flat / matrix.cols);
        cursorCol = flat % matrix.cols;
      } else if (direction === 'left') {
        const total = matrix.rows * matrix.cols;
        const flat = (cursorRow * matrix.cols + cursorCol - 1 + total) % total;
        cursorRow = Math.floor(flat / matrix.cols);
        cursorCol = flat % matrix.cols;
      } else if (direction === 'down') {
        cursorRow = (cursorRow + 1) % matrix.rows;
      } else if (direction === 'up') {
        cursorRow = (cursorRow - 1 + matrix.rows) % matrix.rows;
      }
      return screen;
    },

    clear() {
      screen = 'calc';
      activeName = null;
      pendingRows = null;
      copyPending = false;
      return screen;
    },

    command(name) {
      if (name === 'define') openSelect('define');
      else if (name === 'edit') openSelect('edit');
      else if (name === 'calc') screen = 'calc';
      return screen;
    },

    showResult(value) {
      if (!isMatrixValue(value)) throw new EngineError('Math ERROR');
      matrices.MatAns = cloneMatrixValue(value);
      activeName = 'MatAns';
      cursorRow = 0;
      cursorCol = 0;
      copyPending = false;
      screen = 'result';
      return screen;
    },

    beginCopy() {
      if ((screen !== 'editor' && screen !== 'result') || !selectedMatrix()) return false;
      copyPending = true;
      return true;
    },

    copyTo(name) {
      if (!copyPending || !MATRIX_NAMES.includes(name) || !selectedMatrix()) return false;
      const copied = cloneMatrixValue(selectedMatrix());
      matrices[name] = copied;
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
      return ['Matrix'];
    },

    getState() {
      if (screen === 'select' || screen === 'edit-select') {
        return {
          mode: 'matrix',
          screen: screen === 'select' ? 'select' : 'edit-select',
          title: screen === 'select' ? 'Define Matrix' : 'Edit Matrix',
          options: MATRIX_NAMES.slice(),
          defined: MATRIX_NAMES.map((name) => !!matrices[name])
        };
      }
      if (screen === 'rows' || screen === 'cols') {
        return {
          mode: 'matrix',
          screen: 'dimension',
          title: activeName,
          prompt: screen === 'rows' ? 'Number of Rows?' : 'Number of Columns?',
          selectText: 'Select 1~4'
        };
      }
      if (screen === 'editor' || screen === 'result') {
        const matrix = selectedMatrix();
        return {
          mode: 'matrix',
          screen,
          title: activeName + '=' + (copyPending ? '→' : ''),
          name: activeName,
          readOnly: screen === 'result',
          rows: matrix.rows,
          cols: matrix.cols,
          values: matrix.values.map((row) => row.slice()),
          cursor: { row: cursorRow, col: cursorCol },
          selectedText: String(matrix.values[cursorRow][cursorCol])
        };
      }
      return { mode: 'matrix', screen: 'calc' };
    },

    getMemory() {
      const out = {};
      Object.keys(matrices).forEach((name) => { out[name] = cloneMatrixValue(matrices[name]); });
      return out;
    }
  };
}
