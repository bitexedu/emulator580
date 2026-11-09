'use strict';
// Gói tĩnh dùng chung cho Netlify/PWA/client. Chỉ lấy dependency sản phẩm.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = __dirname;
const output = path.resolve(root, process.argv[2] || 'dist');
if (output === root || root.startsWith(output + path.sep)) throw new Error('Thư mục xuất không hợp lệ');
const sha = content => crypto.createHash('sha256').update(content).digest('hex');
// A verified package supplies its identity and test counts from one input.
// Unlabelled builds must not claim a previous commit or a test result.
const metadataPath = process.argv[3];
const requested = metadataPath ? JSON.parse(fs.readFileSync(metadataPath, 'utf8')) : null;
const identity = { version: '0.0.0-dev', calculatorCheckpoint: 'unverified' };
if (metadataPath) {
  if (!requested || typeof requested.version !== 'string' ||
      !/^\d{4}\.\d{2}\.\d{2}-(qa|rc|beta)\.\d+$/.test(requested.version) ||
      typeof requested.calculatorCheckpoint !== 'string' ||
      !/^[0-9a-f]{40}$/.test(requested.calculatorCheckpoint)) {
    throw new Error('Metadata cần phiên bản ngày-tháng và SHA Git đầy đủ.');
  }
  identity.version = requested.version;
  identity.calculatorCheckpoint = requested.calculatorCheckpoint;
  for (const key of ['assertions', 'failures', 'pending', 'knownDivergences']) {
    const n = requested[key];
    if (!Number.isSafeInteger(n) || n < 0) throw new Error('Số liệu kiểm thử không hợp lệ: ' + key);
    identity[key] = n;
  }
  if (!identity.assertions || identity.failures !== 0) {
    throw new Error('Gói có mã nghiệm thu cần kết quả hồi quy đã chạy và 0 FAIL.');
  }
}

const files = new Map();
function add(reference, from = 'index.html') {
  if (!reference || reference === '/' || reference.startsWith('#') || reference.startsWith('data:')) return;
  if (/^(?:[a-z]+:|\/|\\)/i.test(reference)) throw new Error('Tham chiếu ngoài gói: ' + reference);
  const name = path.posix.normalize(path.posix.join(path.posix.dirname(from), reference.split(/[?#]/)[0]));
  if (name.startsWith('../') || name.includes('\\') || name === '..') throw new Error('Đường dẫn ngoài gói: ' + reference);
  if (files.has(name)) return;
  const source = path.join(root, name);
  if (!fs.statSync(source).isFile()) throw new Error('Không phải file: ' + name);
  const content = fs.readFileSync(source);
  files.set(name, content);
  const text = content.toString('utf8');
  if (name.endsWith('.html')) for (const m of text.matchAll(/(?:src|href)="([^"#]+)"/g)) add(m[1], name);
  if (name.endsWith('.css')) for (const m of text.matchAll(/url\(\s*["']?([^\s)"']+)["']?\s*\)/g)) add(m[1], name);
  if (name.endsWith('.webmanifest')) for (const icon of JSON.parse(text).icons || []) add(icon.src, name);
}
for (const name of ['index.html','feedback-success.html','_headers','robots.txt','sw.js','assets/menu-tiles.svg','assets/device-face-blue.svg','assets/device-face-pink.svg']) add(name);
// Stamp before hashing, so displayed/feedback versions participate in the offline cache ID.
const markers = new Map([
  ['<small id="release-version">Bản mã nguồn</small>',
    '<small id="release-version">Phiên bản ' + identity.version +
    (requested ? ' · ' + identity.calculatorCheckpoint.slice(0, 7) : '') + '</small>'],
  ['name="version" value="0.0.0-dev"', 'name="version" value="' + identity.version + '"'],
  ['name="calculator-checkpoint" value="unverified"',
    'name="calculator-checkpoint" value="' + identity.calculatorCheckpoint + '"']
]);
let html = files.get('index.html').toString('utf8');
for (const [from, to] of markers) {
  if (html.split(from).length !== 2) throw new Error('Thiếu hoặc trùng điểm gắn mã bản: ' + from);
  html = html.replace(from, to);
}
files.set('index.html', Buffer.from(html));
const worker = files.get('sw.js').toString('utf8');
const shell = JSON.parse(worker.match(/const SHELL_FILES = (\[[^;]+\]);/)[1]);
for (const name of shell) if (!files.has(name)) throw new Error('Cache trỏ tới file ngoài gói: ' + name);
for (const name of files.keys()) {
  if (!['_headers','robots.txt','sw.js','feedback-success.html'].includes(name) && !shell.includes(name)) throw new Error('Thiếu trong cache ngoại tuyến: ' + name);
}
const id = sha([...files].sort(([a],[b]) => a.localeCompare(b)).map(([name, bytes]) => name + ':' + sha(bytes)).join('\n')).slice(0, 16);
files.set('sw.js', Buffer.from(worker.replace(/const CACHE_NAME = '[^']+';/, "const CACHE_NAME = 'calculator-shell-" + id + "';")));
fs.mkdirSync(output, { recursive: true });
const allowed = new Set([...files.keys(), 'release.json']);
function inspect(dir, prefix = '') {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) inspect(path.join(dir, entry.name), name + '/');
    else if (!entry.isFile() || !allowed.has(name)) throw new Error('Thư mục xuất có file ngoài danh sách: ' + name);
  }
}
inspect(output);
const hashes = {};
for (const [name, content] of files) {
  const target = path.join(output, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  hashes[name] = sha(content);
}
const release = { ...identity, offlineCache:id, files:hashes };
fs.writeFileSync(path.join(output, 'release.json'), JSON.stringify(release, null, 2) + '\n');
console.log('Đã đóng gói ' + (files.size + 1) + ' file tại ' + output + ' · cache ' + id);
