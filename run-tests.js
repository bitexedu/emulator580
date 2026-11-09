// Chạy engine.test.html trong Node, không cần trình duyệt:
//
//     node run-tests.js
//
// Gộp các file script + đoạn script inline trong file test rồi chạy trong một
// context. Có DOM giả tối thiểu để nạp được ui.js — đủ cho các hàm dựng node.
//
// GIỚI HẠN: KHÔNG mô phỏng CSS, cỡ chữ hay bố cục. Những thứ đó vẫn phải mở
// engine.test.html / index.html trong trình duyệt mà nhìn bằng mắt.
//
// Đây là CÔNG CỤ DEV, không phải một phần của sản phẩm — index.html không nạp
// file này. Trước 2026-08-20 nó nằm trong thư mục tạm và mỗi phiên phải đi lục
// lại; đưa vào repo theo quyết định của người dùng để hết cảnh đó.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

// Chạy được từ bất kỳ thư mục nào — lấy theo vị trí của chính file này.
const root = __dirname;
const html = fs.readFileSync(path.join(root, 'engine.test.html'), 'utf8');

const srcFiles = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const inline = html.match(/<script>\n([\s\S]*?)<\/script>/);
if (!inline) throw new Error('Không tìm thấy script inline');

// ===== DOM giả =====
function makeNode(nodeType, tagName) {
  const el = {
    nodeType,
    tagName,
    childNodes: [],
    className: '',
    dataset: {},
    style: {
      setProperty(name, value) { this[name] = String(value); },
      getPropertyValue(name) { return this[name] || ''; }
    },
    hidden: false,
    _text: '',
    classList: {
      add() {}, remove() {}, toggle() {}, contains() { return false; }
    },
    appendChild(child) {
      if (child && child.nodeType === 11) {
        child.childNodes.forEach(c => el.childNodes.push(c));
        child.childNodes = [];
      } else {
        el.childNodes.push(child);
      }
      return child;
    },
    addEventListener() {},
    setAttribute(name, value) { if (name === 'class') el.className = value; },
    getAttribute() { return null; },
    querySelector(selector) {
      // Overlay titles are persistent DOM nodes; returning a fresh node
      // hid regressions when a menu changed title or visibility.
      if (selector === '.overlay-title') {
        if (!el._overlayTitle) el._overlayTitle = makeNode(1, 'div');
        return el._overlayTitle;
      }
      return makeNode(1, 'div');
    },
    get textContent() {
      if (el.childNodes.length === 0) return el._text;
      return el.childNodes.map(c => c.textContent).join('');
    },
    set textContent(v) { el._text = String(v); el.childNodes = []; },
    get innerHTML() { return ''; },
    set innerHTML(v) { el._text = ''; el.childNodes = []; }
  };
  return el;
}

const byId = {};
const documentShim = {
  addEventListener() {},
  getElementById(id) {
    if (!byId[id]) byId[id] = makeNode(1, 'div');
    return byId[id];
  },
  createElement(tag) { return makeNode(1, tag); },
  createElementNS(ns, tag) { return makeNode(1, tag); },
  createTextNode(text) {
    const n = makeNode(3, '#text');
    n.textContent = text;
    return n;
  },
  createDocumentFragment() { return makeNode(11, '#fragment'); },
  querySelectorAll() { return []; }
};

let fails = 0;
let asserts = 0;
const lines = [];
const sandbox = {
  console: {
    assert(cond, msg) {
      asserts++;
      if (!cond) { fails++; lines.push('FAIL ' + msg); }
    },
    log: (...a) => lines.push('LOG ' + a.join(' ')),
    warn: (...a) => lines.push('WARN ' + a.join(' ')),
    error: (...a) => lines.push('ERR ' + a.join(' ')),
  },
  document: documentShim,
  window: { addEventListener() {} },
  Array,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

for (const f of srcFiles) {
  const code = fs.readFileSync(path.join(root, f), 'utf8');
  try {
    vm.runInContext(code, sandbox, { filename: f });
  } catch (e) {
    console.log('LỖI khi nạp ' + f + ': ' + e.stack);
    process.exit(1);
  }
}
try {
  vm.runInContext(inline[1], sandbox, { filename: 'engine.test.html' });
} catch (e) {
  console.log('LỖI khi chạy test: ' + e.stack);
  process.exit(1);
}

lines.forEach(l => console.log(l));
console.log('---');
console.log('Tổng assert: ' + asserts + ' | FAIL: ' + fails);
if (fails > 0) process.exitCode = 1;

// Kiểm tra Engine độc lập; các mô-đun ứng dụng không được âm thầm
// cung cấp hàm bắt buộc cho đường SOLVE của Engine.
require('./check-engine-isolation.js');
