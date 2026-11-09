// Mode Distribution (Tầng 7) — các hàm xác suất thuần, không DOM và không
// giữ trạng thái. Luồng nhập Variable/List nằm trong engine.js.
//
// Nạp SAU engine.js vì dùng EngineError ở phạm vi toàn cục.
// Nguồn: manual fx-580VN X tr.155-160 và đối chiếu bản giả lập chính thức
// ngày 2026-09-10.

const DISTRIBUTION_TYPES = [
  {
    id: 'normal-pd', page: 0, key: '1', label: 'Normal PD', ready: true,
    fields: [
      { key: 'x', label: 'x', initial: 0 },
      { key: 'sigma', label: 'σ', initial: 1 },
      { key: 'mu', label: 'μ', initial: 0 }
    ],
    resultLabel: 'P'
  },
  {
    id: 'normal-cd', page: 0, key: '2', label: 'Normal CD', ready: true,
    fields: [
      { key: 'lower', label: 'Lower', initial: 0 },
      { key: 'upper', label: 'Upper', initial: 0 },
      { key: 'sigma', label: 'σ', initial: 1 },
      { key: 'mu', label: 'μ', initial: 0 }
    ],
    resultLabel: 'P'
  },
  {
    id: 'inverse-normal', page: 0, key: '3', label: 'Inverse Normal', ready: true,
    fields: [
      { key: 'area', label: 'Area', initial: 0 },
      { key: 'sigma', label: 'σ', initial: 1 },
      { key: 'mu', label: 'μ', initial: 0 }
    ],
    // Bản giả lập ghi `xInv=` trên màn hình kết quả.
    resultLabel: 'xInv'
  },
  {
    id: 'binomial-pd', page: 0, key: '4', label: 'Binomial PD', ready: true,
    needsInputMethod: true,
    fields: [
      { key: 'x', label: 'x', initial: 0 },
      { key: 'n', label: 'N', initial: 0 },
      { key: 'p', label: 'p', initial: 0 }
    ],
    resultLabel: 'P'
  },
  {
    // Bản giả lập đánh số lại từ 1 ở trang thứ hai của Select Type.
    id: 'binomial-cd', page: 1, key: '1', label: 'Binomial CD', ready: true,
    needsInputMethod: true,
    fields: [
      { key: 'x', label: 'x', initial: 0 },
      { key: 'n', label: 'N', initial: 0 },
      { key: 'p', label: 'p', initial: 0 }
    ],
    resultLabel: 'P'
  },
  {
    id: 'poisson-pd', page: 1, key: '2', label: 'Poisson PD', ready: true,
    needsInputMethod: true,
    fields: [
      { key: 'x', label: 'x', initial: 0 },
      { key: 'lambda', label: 'λ', initial: 0 }
    ],
    resultLabel: 'P'
  },
  {
    id: 'poisson-cd', page: 1, key: '3', label: 'Poisson CD', ready: true,
    needsInputMethod: true,
    fields: [
      { key: 'x', label: 'x', initial: 0 },
      { key: 'lambda', label: 'λ', initial: 0 }
    ],
    resultLabel: 'P'
  }
];

function distributionTypeById(id) {
  return DISTRIBUTION_TYPES.find((type) => type.id === id && type.ready) || DISTRIBUTION_TYPES[0];
}

function requireFiniteDistributionValues(values) {
  if (values.some((value) => !Number.isFinite(value))) {
    throw new EngineError('Math ERROR');
  }
}

// Mật độ N(μ,σ²).
function normalPdf(x, sigma, mu) {
  requireFiniteDistributionValues([x, sigma, mu]);
  if (sigma <= 0) throw new EngineError('Math ERROR');
  const z = (x - mu) / sigma;
  const result = Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
  if (!Number.isFinite(result)) throw new EngineError('Math ERROR');
  return result;
}

// Q(z)=P(Z>z), z>=0. Tính trực tiếp đuôi để không trừ hai số đã tròn về 1.
// Trung tâm: Hart 5666; z>=4: liên phân số Laplace, 64 tầng.
// NIST DLMF 7.9.1. Chính sách06/11: ưu tiên toán học, giữ số CASIO ở test riêng.
function standardNormalPositiveTail(z) {
  if (z === Infinity || z > 38.5) return 0;
  const exponential = Math.exp(-0.5 * z * z);
  if (z < 4) {
    const numerator = ((((((0.0352624965998911 * z + 0.700383064443688) * z
      + 6.37396220353165) * z + 33.912866078383) * z + 112.079291497871) * z
      + 221.213596169931) * z + 220.206867912376);
    const denominator = (((((((0.0883883476483184 * z + 1.75566716318264) * z
      + 16.064177579207) * z + 86.7807322029461) * z + 296.564248779674) * z
      + 637.333633378831) * z + 793.826512519948) * z + 440.413735824752);
    return exponential * numerator / denominator;
  }
  let fraction = 0;
  for (let n = 64; n >= 1; n--) fraction = n / (z + fraction);
  return exponential / (z + fraction) / Math.sqrt(2 * Math.PI);
}

function standardNormalCdf(z) {
  if (Number.isNaN(z)) throw new EngineError('Math ERROR');
  const tail = standardNormalPositiveTail(Math.abs(z));
  return z > 0 ? 1 - tail : tail;
}

// P(Lower ≤ X ≤ Upper). Đối xứng đuôi trái/phải; không mất xác suất nhỏ.
function normalCdfBetween(lower, upper, sigma, mu) {
  requireFiniteDistributionValues([lower, upper, sigma, mu]);
  if (sigma <= 0 || lower > upper) throw new EngineError('Math ERROR');
  if (lower === upper) return 0;
  const a = (lower - mu) / sigma, b = (upper - mu) / sigma;
  const width = b - a;
  // Khoảng rất hẹp: tích phân mật độ bằng Gauss–Legendre8 tránh triệt tiêu
  // cả ở tâm lẫn đuôi. Ngưỡng giữ biến thiên số mũ <0.01 trên khoảng.
  if (width > 0 && width < 0.01 / (1 + Math.max(Math.abs(a), Math.abs(b)))) {
    const middle = a + width / 2, half = width / 2;
    const nodes = [0.1834346424956498, 0.5255324099163290, 0.7966664774136267, 0.9602898564975363];
    const weights = [0.3626837833783620, 0.3137066458778873, 0.2223810344533745, 0.1012285362903763];
    let sum = 0;
    for (let i = 0; i < 4; i++) {
      const left = middle - half * nodes[i], right = middle + half * nodes[i];
      sum += weights[i] * (Math.exp(-left * left / 2) + Math.exp(-right * right / 2));
    }
    return half * sum / Math.sqrt(2 * Math.PI);
  }
  if (a >= 0) return standardNormalPositiveTail(a) - standardNormalPositiveTail(b);
  if (b <= 0) return standardNormalPositiveTail(-b) - standardNormalPositiveTail(-a);
  return 1 - standardNormalPositiveTail(-a) - standardNormalPositiveTail(b);
}

// Xấp xỉ erf⁻¹ làm điểm khởi đầu; tinh chỉnh trên diện tích đuôi nhỏ hơn.
// Không lấy 1-CDF ở đuôi phải và không dùng 2p−1 để đo xác suất cực nhỏ.
function standardNormalInverseSeed(area) {
  if (!(area > 0 && area < 1)) throw new EngineError('Math ERROR');
  const centered = 2 * area - 1;
  if (Math.abs(centered) <= 0.7) {
    const square = centered * centered;
    const numerator = ((-0.140543331 * square + 0.914624893) * square
      - 1.645349621) * square + 0.886226899;
    const denominator = (((0.012229801 * square - 0.329097515) * square
      + 1.442710462) * square - 2.118377725) * square + 1;
    return Math.SQRT2 * centered * numerator / denominator;
  }
  // Dùng trực tiếp diện tích đuôi để tránh mất số khi 2p−1 bị làm tròn về −1.
  const root = Math.sqrt(-Math.log(Math.min(area, 1 - area)));
  const numerator = ((1.641345311 * root + 3.429567803) * root
    - 1.624906493) * root - 1.970840454;
  const denominator = (1.6370678 * root + 3.5438892) * root + 1;
  return Math.sign(centered) * Math.SQRT2 * numerator / denominator;
}

// ∫[0,x] phi(t)dt, |x|<1: chuỗi Taylor hội tụ, không trừ khỏi 0.5.
function standardNormalCentralArea(x) {
  let term = x, sum = x;
  for (let n = 1; n <= 24; n++) {
    term *= -x * x / (2 * n);
    const next = sum + term / (2 * n + 1);
    if (next === sum) break;
    sum = next;
  }
  return sum / Math.sqrt(2 * Math.PI);
}

function standardNormalInverse(area) {
  if (!(area > 0 && area < 1)) throw new EngineError('Math ERROR');
  if (area === 0.5) return 0;
  const tail = Math.min(area, 1 - area);
  let x = Math.abs(standardNormalInverseSeed(tail));
  if (tail >= 0.25) {
    const areaFromCentre = Math.abs(area - 0.5);
    for (let i = 0; i < 4; i++) {
      const density = Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
      x -= (standardNormalCentralArea(x) - areaFromCentre) / density;
    }
    return area < 0.5 ? -x : x;
  }
  for (let i = 0; i < 12; i++) {
    const density = Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
    if (density === 0) break;
    const step = (standardNormalPositiveTail(x) - tail) / density;
    // Halley cho Q: Q'=-phi, Q''=x*phi; mẫu giảm bước ở đuôi xa.
    const correction = step / (1 - x * step / 2);
    const next = x + correction;
    if (!Number.isFinite(next) || next < 0) break;
    x = next;
    if (Math.abs(correction) <= 2 * Number.EPSILON * Math.max(1, x)) break;
  }
  return area < 0.5 ? -x : x;
}

function inverseNormal(area, sigma, mu) {
  requireFiniteDistributionValues([area, sigma, mu]);
  // Dù manual in miền đóng 0≤Area≤1, hai đầu cho nghiệm vô hạn nên máy
  // không thể hiển thị một số hữu hạn; coi là Math ERROR ở engine.
  if (area <= 0 || area >= 1 || sigma <= 0) throw new EngineError('Math ERROR');
  const result = mu + sigma * standardNormalInverse(area);
  if (!Number.isFinite(result)) throw new EngineError('Math ERROR');
  return result;
}

function requireDistributionInteger(value) {
  if (!Number.isInteger(value) || value < 0) throw new EngineError('Math ERROR');
}

// Lanczos log-gamma giúp tính xác suất rời rạc mà không dựng n! trực tiếp.
function distributionLogGamma(value) {
  const coefficients = [
    0.9999999999998099, 676.5203681218851, -1259.1392167224028,
    771.3234287776531, -176.6150291621406, 12.5073432786869,
    -0.13857109526572, 9.984369578019572e-6, 1.5056327351493116e-7
  ];
  if (value < 0.5) {
    return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * value)) -
      distributionLogGamma(1 - value);
  }
  let z = value - 1;
  let series = coefficients[0];
  for (let i = 1; i < coefficients.length; i++) series += coefficients[i] / (z + i);
  const t = z + coefficients.length - 1.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(series);
}

function logSumExp(values) {
  let max = -Infinity;
  for (const value of values) if (value > max) max = value;
  if (max === -Infinity) return -Infinity;
  let sum = 0;
  for (const value of values) sum += Math.exp(value - max);
  return max + Math.log(sum);
}

function binomialLogPmf(x, n, p) {
  if (p === 0) return x === 0 ? 0 : -Infinity;
  if (p === 1) return x === n ? 0 : -Infinity;
  return distributionLogGamma(n + 1) - distributionLogGamma(x + 1) -
    distributionLogGamma(n - x + 1) + x * Math.log(p) + (n - x) * Math.log1p(-p);
}

function binomialPmf(x, n, p) {
  requireFiniteDistributionValues([x, n, p]);
  requireDistributionInteger(x);
  requireDistributionInteger(n);
  if (x > n || p < 0 || p > 1) throw new EngineError('Math ERROR');
  return Math.exp(binomialLogPmf(x, n, p));
}

function binomialCdf(x, n, p) {
  requireFiniteDistributionValues([x, n, p]);
  requireDistributionInteger(x);
  requireDistributionInteger(n);
  if (x > n || p < 0 || p > 1) throw new EngineError('Math ERROR');
  const terms = [];
  for (let k = 0; k <= x; k++) terms.push(binomialLogPmf(k, n, p));
  return Math.min(1, Math.exp(logSumExp(terms)));
}

function poissonLogPmf(x, lambda) {
  if (lambda === 0) return x === 0 ? 0 : -Infinity;
  return -lambda + x * Math.log(lambda) - distributionLogGamma(x + 1);
}

function poissonPmf(x, lambda) {
  requireFiniteDistributionValues([x, lambda]);
  requireDistributionInteger(x);
  if (lambda < 0) throw new EngineError('Math ERROR');
  return Math.exp(poissonLogPmf(x, lambda));
}

function poissonCdf(x, lambda) {
  requireFiniteDistributionValues([x, lambda]);
  requireDistributionInteger(x);
  if (lambda < 0) throw new EngineError('Math ERROR');
  const terms = [];
  for (let k = 0; k <= x; k++) terms.push(poissonLogPmf(k, lambda));
  return Math.min(1, Math.exp(logSumExp(terms)));
}

function calculateDistribution(typeId, values) {
  if (typeId === 'normal-pd') return normalPdf(values[0], values[1], values[2]);
  if (typeId === 'normal-cd') return normalCdfBetween(values[0], values[1], values[2], values[3]);
  if (typeId === 'inverse-normal') return inverseNormal(values[0], values[1], values[2]);
  if (typeId === 'binomial-pd') return binomialPmf(values[0], values[1], values[2]);
  if (typeId === 'binomial-cd') return binomialCdf(values[0], values[1], values[2]);
  if (typeId === 'poisson-pd') return poissonPmf(values[0], values[1]);
  if (typeId === 'poisson-cd') return poissonCdf(values[0], values[1]);
  throw new EngineError('Math ERROR');
}
