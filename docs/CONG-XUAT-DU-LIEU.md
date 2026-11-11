# Cổng xuất dữ liệu (bridge.js)

Cho phép trang web chứa bản giả lập trong khung (`<iframe>`) **đọc** dữ liệu đang có trên máy để dùng ở ứng dụng khác, ví dụ Phòng Học Số gửi sang ToánPad để vẽ đồ thị, làm thống kê. Cổng chỉ đọc trạng thái: không bấm phím, không đổi màn hình, không đổi phép tính. Mở bản giả lập riêng (không nằm trong khung) thì cổng không làm gì.

## Thành phần

| Tệp | Nội dung |
|---|---|
| `engine.js` | `serializeForExchange(nodes)`: dịch cây biểu thức thành chuỗi trao đổi; `engine.exportData()`; `exportData()` của handler Bảng giá trị và Thống kê |
| `bridge.js` | Nghe `postMessage` từ trang chứa, trả `engine.exportData()` |
| `index.html`, `sw.js` | Nạp `bridge.js` sau `ui.js`; thêm vào bộ nhớ ngoại tuyến |
| `bridge.test.js` | `node --test bridge.test.js` |

## Giao thức

```
trang chứa → máy:  { bitex: 'hello',  id }
máy → trang chứa:  { bitex: 'hello',  id, ok: true, v: 1, model: 'fx-580VN X', features: ['calculate','table','statistics'] }

trang chứa → máy:  { bitex: 'export', id }
máy → trang chứa:  { bitex: 'export', id, ok: true, data }      // data = engine.exportData()
                   { bitex: 'export', id, ok: false, error }   // khi có lỗi
```

Máy kiểm tra tin đến từ trang chứa trực tiếp và từ đúng origin đã cấu hình. Origin là giao thức, tên miền và cổng nếu có. Máy gửi kết quả về đúng origin đó.

Mặc định cổng tắt. Khi đóng gói, đặt biến môi trường `BITEX_EXPORT_ORIGINS` thành danh sách origin được BITEX phê duyệt, cách nhau bằng khoảng trắng. Dùng HTTPS và bỏ dấu `/` cuối, đường dẫn và ký tự đại diện. HTTP chỉ dùng để kiểm thử trên `localhost`, `127.0.0.1` hoặc `[::1]`. Ví dụ cục bộ:

```sh
BITEX_EXPORT_ORIGINS='http://127.0.0.1:8871' node build-release.js
```

Khi thử mã nguồn trực tiếp, đặt cùng danh sách trong thẻ `meta[name="bitex-export-origins"]` của bản thử cục bộ. Trang nhận nên dùng đúng origin của máy khi gửi yêu cầu và kiểm tra nguồn trả lời.

## `engine.exportData()`

Mọi kết quả có `v: 1` (phiên bản định dạng), `mode` (mode đang mở), `angleUnit` (`deg` | `rad` | `grad`).

**Tính toán** (`mode: 'calculate'`): xuất mục kết quả đang xem với đơn vị góc lúc tính, hoặc biểu thức đang gõ với đơn vị hiện hành và `value: null`. Sau AC, trả `expr: null`, `text: ""`, `value: null`. Người dùng có thể chủ động mở lại mục lịch sử bằng phím điều hướng để xuất mục đó. Màn SOLVE hoặc màn nhập biến CALC báo `unsupported`. Kết quả CALC có thể xuất số và chữ hiển thị, với `expr: null` vì phụ thuộc giá trị biến đã nhập.

```json
{ "v": 1, "mode": "calculate", "angleUnit": "deg", "expr": "((1)/(2))+sin(30)", "text": "1/2+sin(30)", "value": 1 }
```

**Bảng giá trị** (`mode: 'table'`): ô lỗi là `null`. Khi không có g(x), `g: null` và `gText: ""`. Chỉ xuất các dòng của bảng đã sinh ở đơn vị góc hiện hành. Trong lúc sửa hàm, chỉnh khoảng hoặc sau khi đổi đơn vị góc, `rows: []` cho tới khi sinh lại bảng với thiết lập phù hợp.

```json
{ "v": 1, "mode": "table", "angleUnit": "deg", "f": "x^(2)-1", "fText": "x^(2)-1", "g": null, "gText": "",
  "start": 1, "end": 5, "step": 1, "rows": [ { "x": 1, "f": 0, "g": null }, { "x": 2, "f": 3, "g": null } ] }
```

**Thống kê** (`mode: 'statistics'`): `type` là `id` trong `STATISTICS_TYPES` (`1var`, `linear`, `quad`, `log`, `exp-e`, `exp-ab`, `power`, `inverse`); mỗi dòng luôn đủ `x`, `y`, `f` như `newStatRow()`.

```json
{ "v": 1, "mode": "statistics", "angleUnit": "deg", "type": "linear", "label": "y=a+bx", "twoVar": true,
  "frequency": false, "rows": [ { "x": 1, "y": 3, "f": 1 } ] }
```

**Mode khác**: `{ v, mode, angleUnit, unsupported: true }`.

## Chuỗi trao đổi (`expr`, `f`, `g`)

Một dòng, chỉ ký tự ASCII, dấu chấm thập phân: số, `x`, `+ - * / ^ ( ) ,`, hằng `pi`, `e`, hàm `sqrt cbrt root(x,n) abs ln log10 logb(b,x) sin cos tan asin acos atan sinh cosh tanh asinh acosh atanh`. Phân số viết `((tử)/(mẫu))`, hỗn số `(nguyên+(tử)/(mẫu))`, Ký pháp khoa học có phần số đứng trước được nhóm thành một toán hạng, ví dụ `1÷2×10³` xuất thành `1/(2*10^(3))`. Dấu nhân ẩn được ghi thành dấu `*` và nhóm bằng ngoặc để giữ đúng thứ tự tính. Đối số lượng giác theo `angleUnit`.

Biểu thức có thành phần không dịch được (Σ, ∫, d/dx, Ans, biến nhớ A–F, M, hằng số khoa học, đổi đơn vị, GCD, Pol…) thì giá trị là `null`; bên nhận khi đó chỉ dùng số liệu (`value`, `rows`), vẫn có `text` / `fText` để hiển thị.

## Mở rộng

Thêm mode mới: viết `exportData()` trong handler của mode đó, thêm tên mode vào `features` của `bridge.js`, thêm ca vào `bridge.test.js`. Đổi cấu trúc dữ liệu thì tăng `v`.
