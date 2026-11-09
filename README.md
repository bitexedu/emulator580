# BITEX Calculator Simulator

Trình mô phỏng máy tính khoa học fx-580VN X để đội chuyên môn BITEX kiểm thử và theo dõi thay đổi.

Bản nhập ban đầu tương ứng với bản web **2026.11.09-qa.2**.
[Trải nghiệm bản web](https://bitex-calculator-beta.netlify.app/).

## Chạy trên máy

Cần Node.js. Tại thư mục dự án, chạy:

```sh
node run-tests.js
node serve.js
```

Mở [http://127.0.0.1:8771/](http://127.0.0.1:8771/).
Có thể đặt biến môi trường `BITEX_PORT` để dùng cổng khác.
Chạy `node build-release.js` để tạo bộ tệp web trong `dist/`.

## Cấu trúc

- `engine.js` xử lý phép tính và trạng thái máy.
- `ui.js` và `keypad.js` xử lý giao diện và thao tác phím.
- `engine.test.html` và `run-tests.js` chạy hồi quy phép tính.
- `touch.browser.test.html` kiểm tra tương tác qua máy chủ cục bộ.
- `desktop/` chứa mã nguồn bản máy tính để bàn.

Khi báo lỗi, ghi phiên bản trong menu Tiện ích, chuỗi phím, kết quả thực tế và kết quả mong đợi.
