'use strict';
// Cổng xuất dữ liệu: trang chứa bản giả lập trong khung (iframe) hỏi dữ liệu
// đang có trên máy để dùng ở ứng dụng khác (vẽ đồ thị, thống kê…).
// Đặc tả: docs/CONG-XUAT-DU-LIEU.md. Chỉ đọc trạng thái, không bấm phím, không
// đổi màn hình. Mở riêng (không nằm trong khung) thì không làm gì.
//
//   trang chứa → máy:  { bitex: 'export', id }
//   máy → trang chứa:  { bitex: 'export', id, ok: true, data }  hoặc
//                      { bitex: 'export', id, ok: false, error }
//   trang chứa → máy:  { bitex: 'hello', id }
//   máy → trang chứa:  { bitex: 'hello', id, ok: true, v: 1, model: 'fx-580VN X', features: [...] }
(function () {
  if (typeof window === 'undefined' || window.parent === window) return;
  const config = document.querySelector('meta[name="bitex-export-origins"]');
  const allowedOrigins = new Set((config?.content || '').trim().split(/\s+/).filter(Boolean));
  if (!allowedOrigins.size) return;
  const FEATURES = ['calculate', 'table', 'statistics'];
  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.origin === 'null' || !allowedOrigins.has(event.origin)) return;
    const msg = event.data;
    if (!msg || typeof msg !== 'object' || (msg.bitex !== 'export' && msg.bitex !== 'hello')) return;
    const reply = body => event.source.postMessage({ bitex: msg.bitex, id: msg.id, ...body }, event.origin);
    if (msg.bitex === 'hello') { reply({ ok: true, v: 1, model: 'fx-580VN X', features: FEATURES }); return; }
    try {
      reply({ ok: true, data: engine.exportData() });
    } catch (e) {
      reply({ ok: false, error: String(e && e.message || e) });
    }
  });
})();
