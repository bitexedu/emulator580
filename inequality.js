// Mode Inequality (Tầng 7) — bất phương trình đa thức bậc 2, 3 và 4.
//
// File này chỉ giữ LUẬT, không DOM và không trạng thái màn hình. Nạp sau
// equation.js để dùng lại bộ giải nghiệm đa thức chính xác/số đã được đối
// chiếu. Engine ghép các nghiệm thành khoảng; UI chỉ chịu trách nhiệm vẽ.
//
// Nguồn hành vi: manual fx-580VN X tr.171-175 và bản giả lập CASIO chính
// thức ngày 2026-09-14. Các ca phân biệt đã bấm gồm nghiệm trong/ngoài bậc
// hai, All Real Numbers, No Solution, nghiệm điểm kép, nghiệm phân số bậc ba
// và hợp hai đoạn bậc bốn.

const INEQUALITY_RELATIONS = [
  { id: 'gt', key: '1', symbol: '>', strict: true, accepts: (value) => value > 0 },
  { id: 'lt', key: '2', symbol: '<', strict: true, accepts: (value) => value < 0 },
  { id: 'ge', key: '3', symbol: '≥', strict: false, accepts: (value) => value > 0 },
  { id: 'le', key: '4', symbol: '≤', strict: false, accepts: (value) => value < 0 }
];

function inequalityRelationById(id) {
  return INEQUALITY_RELATIONS.find((relation) => relation.id === id)
    || INEQUALITY_RELATIONS[0];
}

function inequalityTypeById(id) {
  const match = /^poly([234])-(gt|lt|ge|le)$/.exec(id || '');
  if (!match) throw new EngineError('Math ERROR');
  const degree = Number(match[1]);
  const relation = inequalityRelationById(match[2]);
  const template = polyTemplate(degree).map((row) => row.map((item) => ({ ...item })));
  template[template.length - 1].push({ text: ' ' + relation.symbol + ' 0' });
  return {
    id,
    degree,
    relation,
    labels: polyLabels(degree),
    columns: 3,
    header: polyHeader(degree) + relation.symbol + '0',
    template
  };
}

function inequalityRootValue(root) {
  if (root.form === 'fraction') return fracToNumber(root.fraction);
  if (root.form === 'surd') return surdToNumber(root.surd);
  if (root.form === 'decimal') return root.value;
  return null;
}

function inequalityRealRoots(degree, values) {
  const raw = degree === 2
    ? solveQuadratic(values)
    : solvePolynomialNumeric(degree, values);
  const roots = raw.map((root) => ({ root, value: inequalityRootValue(root) }))
    .filter((entry) => entry.value !== null && Number.isFinite(entry.value))
    .sort((a, b) => a.value - b.value);

  // Bộ giải đã gộp nghiệm bội, nhưng giữ lớp bảo vệ nhỏ này vì nghiệm số
  // bậc 3/4 có thể lệch vài ulp khi cùng một nghiệm được hội tụ từ hai phía.
  return roots.filter((entry, index) => index === 0 ||
    !sameInequalityBoundary(entry, roots[index - 1]));
}

// Xét dấu bằng phân số: hiệu gần nghiệm có thể nhỏ hơn độ chính xác của
// Number (vd (x−1)(x−1.0000000001)). Dùng đúng hệ số mà bộ giải đã nhận.
function inequalityPolynomialSign(values, x) {
  const point = typeof x === 'object' ? x : roundedNumberFraction(x);
  let result = ZERO_FRACTION;
  for (const value of values) result = fracAdd(fracMul(result, point), coefficientToFraction(value));
  return result.num < 0n ? -1 : result.num > 0n ? 1 : 0;
}

function inequalityIntervalSample(roots, index) {
  if (roots.length === 0) return 0;
  if (index === 0) {
    const first = roots[0].value;
    return first - Math.max(1, Math.abs(first) + 1);
  }
  if (index === roots.length) {
    const last = roots[roots.length - 1].value;
    return last + Math.max(1, Math.abs(last) + 1);
  }
  const left = roots[index - 1], right = roots[index];
  if (left.root.form === 'fraction' && right.root.form === 'fraction') {
    return fracDiv(fracAdd(left.root.fraction, right.root.fraction), { num: 2n, den: 1n });
  }
  return (left.value + right.value) / 2;
}

function sameInequalityBoundary(a, b) {
  if (a === null || b === null) return a === b;
  // Không gộp hai nghiệm chính xác chỉ vì chúng gần nhau. CASIO07/11:
  // x²−10⁻¹⁰x<0 vẫn có khoảng 0<x<10⁻¹⁰; bản cũ làm mất khoảng đó.
  const exact = root => root?.form === 'fraction' ? surdFromFraction(root.fraction)
    : root?.form === 'surd' ? surdNormalize(root.surd) : null;
  const left = exact(a.root), right = exact(b.root);
  if (left && right) return left.radicand === right.radicand
    && fracIsZero(fracSub(left.rational, right.rational))
    && fracIsZero(fracSub(left.coeff, right.coeff));
  return Math.abs(a.value - b.value) <= 1e-9 * Math.max(1, Math.abs(a.value));
}

function mergeInequalitySegments(segments) {
  const merged = [];
  segments.forEach((segment) => {
    const previous = merged[merged.length - 1];
    if (!previous || !sameInequalityBoundary(previous.high, segment.low) ||
        (!previous.includeHigh && !segment.includeLow)) {
      merged.push({ ...segment });
      return;
    }
    previous.high = segment.high;
    previous.includeHigh = segment.includeHigh;
  });
  return merged;
}

// Trả về một trong ba khuôn:
//   { kind: 'all' }
//   { kind: 'none' }
//   { kind: 'set', segments: [{ low, high, includeLow, includeHigh }] }
// `low`/`high` là null cho vô cực, hoặc { value, root } để engine còn giữ
// được dạng phân số/căn thức chính xác khi đưa sang UI.
function solveInequality(typeId, values) {
  const type = inequalityTypeById(typeId);
  if (!Array.isArray(values) || values.length !== type.degree + 1 ||
      values.some((value) => !Number.isFinite(value))) {
    throw new EngineError('Math ERROR');
  }
  // Gọi bộ giải nghiệm cũng kiểm tra hệ số đầu khác 0. Kiểm tra sớm để lỗi
  // đồng nhất trước cả nhánh đa thức không có nghiệm thực.
  if (fracIsZero(coefficientToFraction(values[0]))) throw new EngineError('Math ERROR');

  const roots = inequalityRealRoots(type.degree, values);
  const atoms = [];

  // Mỗi khoảng mở giữa hai nghiệm được quyết định bằng một điểm thử. Trong
  // một khoảng không có nghiệm, dấu đa thức không thể đổi.
  for (let i = 0; i <= roots.length; i++) {
    const sample = inequalityIntervalSample(roots, i);
    if (type.relation.accepts(inequalityPolynomialSign(values, sample))) {
      atoms.push({
        low: i === 0 ? null : roots[i - 1],
        high: i === roots.length ? null : roots[i],
        includeLow: false,
        includeHigh: false
      });
    }
    // Với ≥/≤, chính nghiệm nằm trong tập nghiệm. Chèn điểm sau khoảng bên
    // trái để thứ tự atoms luôn tăng dần và phép merge bên dưới giữ đúng.
    if (!type.relation.strict && i < roots.length) {
      atoms.push({
        low: roots[i],
        high: roots[i],
        includeLow: true,
        includeHigh: true
      });
    }
  }

  const segments = mergeInequalitySegments(atoms);
  if (segments.length === 0) return { kind: 'none' };
  if (segments.length === 1 && segments[0].low === null && segments[0].high === null) {
    return { kind: 'all' };
  }
  return { kind: 'set', segments };
}
