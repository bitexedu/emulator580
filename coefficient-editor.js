// Bộ soạn thảo hệ số (Tầng 7) — lưới ô giữ hệ số của Ratio, Equation...
//
// ĐÃ XÁC NHẬN 2026-08-17 trên bản giả lập chính hãng: mỗi ô nhận một BIỂU
// THỨC đầy đủ, không phải chỉ chữ số. Gõ "2+3" vào ô A của Ratio thì màn hình
// hiện "2+3" ở dòng dưới, bấm "=" ghi 5 vào ô rồi nhảy sang ô B.
//
// Vì vậy file này KHÔNG còn tự giữ chuỗi đang gõ dở nữa. Phần gõ dở nằm ở cây
// node của Tầng 5 trong engine.js (dùng chung với mode Calculate, nên phân
// số/căn/sin đều gõ được vào ô); engine tính xong mới gọi commit(value) ở đây.
// File này chỉ còn lo: giữ giá trị các ô, ô nào đang chọn, và đi lại giữa ô.
//
// Dùng chung cho nhiều mode: Ratio, Equation, rồi Matrix, Vector, Table,
// Statistics. Vì vậy nó không biết gì về mode cụ thể nào.
//
// Không DOM. Nạp SAU engine.js vì dùng formatNumber ở phạm vi toàn cục.

// Ô hệ số KHÔNG chặn ở 10 chữ số. Câu "nhập tối đa 10 chữ số cho mỗi giá trị
// được yêu cầu" (manual trang 178) nói về ĐỘ CHÍNH XÁC HIỂN THỊ, không phải
// chặn phím: ĐÃ XÁC NHẬN 2026-08-17 trên bản giả lập chính hãng — gõ đủ 12 chữ
// số "123456789012" vào ô A thì dòng nhập nhận hết, bấm "=" ghi vào ô và ô
// hiện 1.23456789×10¹¹, tức giá trị vào trọn rồi mới làm tròn 10 chữ số có
// nghĩa như mọi kết quả khác. Bản trước chặn phím thứ 11 là SAI.

// labels: mảng nhãn ô, ví dụ ['A', 'B', 'D'].
// initialValue: giá trị khởi tạo cho mọi ô.
// columns: số ô mỗi hàng. Hệ phương trình 2 ẩn trên máy thật là lưới 2 hàng ×
//   3 cột (a₁ b₁ c₁ / a₂ b₂ c₂) nên ▲▼ phải nhảy nguyên một hàng, khác ◀▶ đi
//   một ô. Bỏ trống thì mặc định một cột (Ratio), giữ nguyên hành vi cũ.
function createCoefficientEditor(labels, initialValue, columns) {
  const values = labels.map(() => initialValue);
  const cols = columns && columns > 0 ? columns : 1;
  let selected = 0;

  return {
    // Chuyển ô: ◀▶ đi một ô, ▲▼ nhảy nguyên một hàng (bằng số cột). Không
    // chạy ra ngoài lưới. Engine chỉ gọi vào đây khi KHÔNG đang gõ dở — đang
    // gõ dở thì ◀▶ đi trong biểu thức (đã xác nhận 2026-08-17).
    moveCell(direction) {
      const rowStep = direction === 'up' || direction === 'down';
      const size = rowStep ? cols : 1;
      const sign = (direction === 'up' || direction === 'left') ? -1 : 1;
      const next = selected + sign * size;
      if (next < 0 || next >= labels.length) return;
      selected = next;
    },

    // Đăng ký giá trị đã tính vào ô đang chọn rồi sang ô kế. Trả về true khi
    // đã ở ô cuối (engine dùng để biết có nên giải luôn hay không).
    commit(value) {
      if (!Number.isFinite(value)) return false;
      values[selected] = value;
      if (selected < labels.length - 1) {
        selected++;
        return false;
      }
      return true;
    },

    resetAll(value) {
      for (let i = 0; i < values.length; i++) values[i] = value;
      selected = 0;
    },

    // Quay về ô đầu mà GIỮ nguyên giá trị — dùng khi rời màn hình nghiệm.
    // ĐÃ XÁC NHẬN 2026-08-17: sau khi xem hết nghiệm và cực trị, máy về Bộ
    // soạn thảo với ô ĐẦU TIÊN tô ngược, hệ số còn nguyên.
    selectFirst() {
      selected = 0;
    },

    getValues() {
      return values.slice();
    },

    // UI vẽ từ đây. `text` đã là chuỗi sẵn sàng hiển thị nên ui.js không phải
    // biết gì về định dạng số.
    // numberFormat là mục Number Format của SETUP, engine truyền xuống. Ô hệ
    // số CÓ theo Fix/Sci — ĐÃ XÁC NHẬN 2026-08-21 trên bản giả lập: đang ở
    // Sci 5, ô hệ số c vừa nhận giá trị 0 hiện "0.0000×10⁰" chứ không phải
    // "0". Nghiệm thì KHÔNG bị đè: cùng lúc đó x₁ vẫn hiện phân số 1/3.
    getState(numberFormat) {
      return {
        columns: cols,
        cells: labels.map((label, i) => ({
          label,
          text: formatNumber(values[i], numberFormat),
          // Bản không dấu, cho mẫu inline của đa thức: `3x − 1` lấy dấu ra
          // làm toán tử nên ô chỉ hiện `1`.
          absText: formatNumber(Math.abs(values[i]), numberFormat),
          negative: values[i] < 0,
          selected: i === selected
        }))
      };
    }
  };
}
