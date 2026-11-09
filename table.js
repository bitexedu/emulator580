// Mode Table (Tầng 7) — luật THUẦN: sinh dãy giá trị x của bảng từ Start/End/
// Step, và trần số dòng. Không DOM, không giữ trạng thái, không phụ thuộc nền
// tảng. Việc TÍNH f(x)/g(x) KHÔNG nằm ở đây — nó tái dùng bộ evaluator số thực
// trong engine.js (handler Table gọi sang), nên file này chỉ lo phần "những x
// nào" chứ không lo "f(x) bằng bao nhiêu".
//
// Số liệu tự bấm bản giả lập chính hãng 2026-08-31 + manual tr.161-163.
// Mặc định SETUP Table = f(x),g(x) (bảng "Khởi động cho" manual tr.16).

// Trần số dòng của bảng (manual tr.163): 45 dòng khi CHỈ có f(x); 30 dòng khi
// có cả f(x) và g(x).
function tableMaxRows(hasG) {
  return hasG ? 30 : 45;
}

// Cộng bước bằng các số thập phân đang lưu, chỉ chuyển về Number một lần.
// Không dùng epsilon để kéo x về điểm kỳ dị: 0.300000001 vẫn phải khác 0.3.
// [ĐÃ XÁC NHẬN 2026-11-07] 0.2 + 0.1 cho x=0.3, f=1/(x−0.3) ERROR.
// Dùng chung khi sinh bảng và nới bằng +, −, = để không lệch đường nhập.
function tableStepValue(start, step, count = 1) {
  if (!Number.isFinite(start) || !Number.isFinite(step)) return start + count * step;
  const parts = value => {
    const [mantissa, power = '0'] = String(value).split('e');
    const decimals = (mantissa.split('.')[1] || '').length;
    return { coefficient: BigInt(mantissa.replace('.', '')), exponent: Number(power) - decimals };
  };
  const a = parts(start), b = parts(step);
  const exponent = Math.min(a.exponent, b.exponent);
  const coefficient = a.coefficient * 10n ** BigInt(a.exponent - exponent)
    + BigInt(count) * b.coefficient * 10n ** BigInt(b.exponent - exponent);
  return Number(String(coefficient) + 'e' + exponent);
}

// Dãy giá trị x: Start, Start+Step, Start+2·Step, ... không vượt End, sinh tối
// đa `limit` phần tử rồi DỪNG (không phải trần dòng — trần dòng do handler kiểm
// bằng cách xin `limit = maxRows + 1` rồi so độ dài; nếu vượt thì "Range ERROR",
// xem base handler).
//   • Dùng Start + i·Step (KHÔNG cộng dồn) để tránh trôi số thực khi Step lẻ
//     (vd 0.5): 1, 1.5, 2, 2.5, 3 — ĐÃ XÁC NHẬN 2026-08-31.
//   • So sánh với End kèm dung sai nhỏ theo Step để không rớt điểm cuối do sai
//     số dấu phẩy động (vd Start+4·0.5 ra 2.9999999999 vẫn phải nhận là 3).
//   • Step = 0 trả dãy rỗng làm sentinel cho handler báo
//     "Range ERROR".
//   • CASIO tự đổi DẤU Step theo hướng Start→End: Start<End luôn
//     dùng |Step|; Start>End luôn dùng −|Step|. ĐÃ XÁC NHẬN 2026-09-07
//     bằng hai ca phân biệt 1/5/−1 và 5/1/1.
function tableXValues(start, end, step, limit) {
  const xs = [];
  if (step === 0) return xs;
  const directedStep = start < end ? Math.abs(step)
    : start > end ? -Math.abs(step)
      : step;
  const tol = Math.abs(directedStep) * 1e-9;
  for (let i = 0; i < limit; i++) {
    const x = tableStepValue(start, directedStep, i);
    if (directedStep > 0 && x > end + tol) break;
    if (directedStep < 0 && x < end - tol) break;
    xs.push(x);
  }
  return xs;
}
