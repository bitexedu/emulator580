'use strict';
// Đóng gói thủ công theo Electron: runtime chính thức + resources/app.
// Chỉ dùng Node và công cụ macOS sẵn có; không cài thêm bundler hoặc installer.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { createWriteStream } = require('node:fs');
const runtime = require('./runtime.json');
const config = require('./package.json');
const root = path.resolve(__dirname, '..');
const args = Object.fromEntries(process.argv.slice(2).map(value => {
  const [key, ...rest] = value.replace(/^--/, '').split('='); return [key, rest.join('=')];
}));
const target = args.target || 'darwin-arm64';
const pruneWindowsLanguages = args['windows-languages'] === 'vi-en';
if (args['windows-languages'] && (!pruneWindowsLanguages || target !== 'win32-x64'))
  throw new Error('--windows-languages=vi-en chỉ dùng cho gói Windows x64.');
if (!Object.hasOwn(runtime.targets, target)) throw new Error('Target không hợp lệ: ' + target);
if (process.platform !== 'darwin') throw new Error('Script đóng gói hiện dùng công cụ ký/zip macOS.');
const output = path.resolve(args.output || path.join(root, 'dist-desktop'));
const cache = path.resolve(args.cache || path.join(os.tmpdir(), 'bitex-electron-cache', runtime.version));
const friendly = { 'darwin-arm64':'Mac-AppleSilicon', 'darwin-x64':'Mac-Intel', 'win32-x64':'Windows-x64' }[target] + (pruneWindowsLanguages ? '-VI-EN' : '');
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const run = (file, parameters, options = {}) => execFileSync(file, parameters, { stdio:'inherit', ...options });

async function download(url, filename) {
  const response = await fetch(url, { signal:AbortSignal.timeout(600000) });
  if (!response.ok) throw new Error('Download ' + response.status + ': ' + url);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(filename + '.partial'));
  await fs.rename(filename + '.partial', filename);
}
async function makeIcon() {
  const icons = path.join(cache, 'icons');
  const source = path.join(__dirname, 'icon.swift');
  const sourceHash = hash(await fs.readFile(source));
  let previous = '';
  try { previous = await fs.readFile(path.join(icons, 'source.sha256'), 'utf8'); } catch {}
  if (previous === sourceHash) return icons;
  await fs.mkdir(icons, { recursive:true });
  run('/usr/bin/xcrun', ['swiftc', source, '-module-cache-path', path.join(cache, 'swift-cache'), '-o', path.join(cache, 'make-icon')]);
  run(path.join(cache, 'make-icon'), [icons]);
  const iconset = path.join(icons, 'calculator.iconset');
  await fs.mkdir(iconset, { recursive:true });
  for (const size of [16,32,128,256,512]) for (const ratio of [1,2]) {
    await fs.copyFile(path.join(icons, 'icon-' + size * ratio + '.png'),
      path.join(iconset, 'icon_' + size + 'x' + size + (ratio === 2 ? '@2x' : '') + '.png'));
  }
  run('/usr/bin/iconutil', ['-c','icns','-o',path.join(icons, 'calculator.icns'),iconset]);
  await fs.writeFile(path.join(icons, 'source.sha256'), sourceHash);
  return icons;
}
async function main() {
  await fs.mkdir(cache, { recursive:true });
  await fs.mkdir(output, { recursive:true });
  const filename = 'electron-v' + runtime.version + '-' + target + '.zip';
  const archive = path.join(cache, filename);
  try { await fs.access(archive); }
  catch { console.log('Tải Electron chính thức: ' + target); await download(runtime.source + filename, archive); }
  if (hash(await fs.readFile(archive)) !== runtime.targets[target]) throw new Error('SHA-256 runtime không khớp: ' + filename);
  console.log('Electron SHA-256 OK: ' + target);
  const icons = await makeIcon();
  // Staging ở cache cục bộ để tránh metadata Finder do thư mục đồng bộ thêm vào.
  const parent = path.join(cache, 'builds', config.version, target);
  const folderName = 'Calculator-Simulator-' + friendly;
  const folder = path.join(parent, folderName);
  try { await fs.access(folder); throw new Error('Thư mục đã tồn tại, chọn output mới: ' + folder); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await fs.mkdir(folder, { recursive:true });
  run('/usr/bin/ditto', ['-x','-k',archive,folder]);
  const removedLocales = [];
  if (pruneWindowsLanguages) {
    const locales = path.join(folder, 'locales');
    // Giữ đúng tên .pak trên Windows, nhất là en-US để Chromium có fallback.
    const keep = new Set(['en-US.pak','en-GB.pak','vi.pak']);
    const names = await fs.readdir(locales);
    for (const name of keep) if (!names.includes(name)) throw new Error('Thiếu locale bắt buộc: ' + name);
    for (const name of names) if (name.endsWith('.pak') && !keep.has(name)) {
      await fs.rm(path.join(locales, name)); removedLocales.push(name);
    }
  }
  let appDir, appPath = null, minimumMacOS = null;
  if (target.startsWith('darwin-')) {
    appPath = path.join(folder, 'Calculator Simulator.app');
    await fs.rename(path.join(folder, 'Electron.app'), appPath);
    appDir = path.join(appPath, 'Contents', 'Resources', 'app');
  } else appDir = path.join(folder, 'resources', 'app');
  await fs.mkdir(appDir, { recursive:true });
  for (const name of ['main.cjs','server.cjs','package.json']) await fs.copyFile(path.join(__dirname, name), path.join(appDir, name));
  await fs.copyFile(path.join(icons, 'icon-256.png'), path.join(appDir, 'icon.png'));
  const assets = path.join(appDir, 'assets');
  run(process.execPath, [path.join(root, 'build-release.js'), assets]);
  const manifestFile = path.join(assets, 'release.json');
  const release = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
  const indexFile = path.join(assets, 'index.html');
  let html = await fs.readFile(indexFile, 'utf8');
  if (!html.includes('<form id="feedback-form"')) throw new Error('Không tìm thấy form để bật gửi góp ý của client.');
  html = html.replace('<form id="feedback-form"', '<form data-desktop-feedback="true" id="feedback-form"')
    .replaceAll(release.version, config.version)
    .replace('Thử nghiệm nội bộ · ', 'Ứng dụng máy tính · ')
    .replace('Hãy ghi lại để chúng tôi có thể kiểm tra và sửa chính xác.', 'Hãy ghi lại để chúng tôi có thể kiểm tra và sửa chính xác. Gửi góp ý cần kết nối Internet.');
  await fs.writeFile(indexFile, html);
  release.webVersion = release.version;
  release.version = config.version;
  release.desktop = { electron:runtime.version, target };
  release.files['index.html'] = hash(Buffer.from(html));
  await fs.writeFile(manifestFile, JSON.stringify(release, null, 2) + '\n');
  if (hash(await fs.readFile(path.join(assets, 'engine.js'))) !== hash(await fs.readFile(path.join(root, 'engine.js')))) throw new Error('Engine trong gói không khớp source.');
  await fs.rm(path.join(path.dirname(appDir), 'default_app.asar'), { force:true });
  if (appPath) {
    const plist = path.join(appPath, 'Contents', 'Info.plist');
    minimumMacOS = execFileSync('/usr/libexec/PlistBuddy', ['-c','Print :LSMinimumSystemVersion',plist], { encoding:'utf8' }).trim();
    const set = (key, value) => run('/usr/libexec/PlistBuddy', ['-c','Set :' + key + ' ' + value,plist]);
    set('CFBundleIdentifier', 'app.calculator.simulator'); set('CFBundleName', 'Calculator Simulator');
    set('CFBundleDisplayName', 'Calculator Simulator'); set('CFBundleExecutable', 'CalculatorSimulator');
    set('CFBundleShortVersionString', '2026.10.28'); set('CFBundleVersion', '2026.10.28');
    set('CFBundleIconFile', 'calculator.icns');
    await fs.rename(path.join(appPath, 'Contents','MacOS','Electron'), path.join(appPath, 'Contents','MacOS','CalculatorSimulator'));
    await fs.copyFile(path.join(icons, 'calculator.icns'), path.join(appPath, 'Contents','Resources','calculator.icns'));
    // Chỉ bỏ metadata Finder/resource fork không tương thích codesign.
    // Giữ nguyên quarantine và provenance; không bỏ qua Gatekeeper.
    for (const attribute of ['com.apple.FinderInfo','com.apple.ResourceFork']) {
      try { execFileSync('/usr/bin/xattr', ['-r','-d',attribute,appPath], { stdio:'ignore' }); } catch {}
    }
    run('/usr/bin/codesign', ['--force','--deep','--sign','-','--preserve-metadata=entitlements,flags,runtime','--timestamp=none',appPath]);
    run('/usr/bin/codesign', ['--verify','--deep','--strict',appPath]);
  } else {
    await fs.rename(path.join(folder, 'electron.exe'), path.join(folder, 'CalculatorSimulator.exe'));
    try { await fs.rename(path.join(folder, 'electron_wer.dll'), path.join(folder, 'CalculatorSimulator_wer.dll')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const readme = ['GIẢ LẬP MÁY TÍNH KHOA HỌC — ' + config.version, '',
    appPath ? 'Mở Calculator Simulator.app. Có thể kéo ứng dụng vào Applications.' : 'Giải nén toàn bộ gói, rồi mở CalculatorSimulator.exe. Giữ các DLL và thư mục đi kèm cùng file EXE.',
    'Không cần cài Node.js, Chrome hoặc Electron riêng. Phép tính hoạt động khi không có Internet.',
    'Gửi góp ý và ảnh cần có Internet; dữ liệu được gửi về nơi nhận của bản web thử nghiệm.',
    'Giao diện hiện không có logo công ty. Dữ liệu tính toán dùng chung với bản web beta.3.',
    'Bản thử nghiệm nội bộ: BUG-064 còn hai biến thể chưa khớp CASIO; không coi đây là bản hoàn thiện.',
    appPath ? 'Chữ ký ad-hoc cho kiểm thử nội bộ; chưa có chứng thư Developer ID hoặc notarization của Apple.' : 'Chưa có chữ ký số Authenticode. Chưa chạy nghiệm thu trên máy Windows.',
    appPath ? 'Yêu cầu macOS từ ' + minimumMacOS + '; đúng loại chip ghi trên tên gói.' : 'Gói dành cho Windows x64; cần kiểm tra thực tế trên Windows 10/11 trước phát hành rộng rãi.',
    '', 'Không bỏ qua cảnh báo bảo mật của hệ điều hành khi chưa xác minh nguồn file.', ''];
  if (pruneWindowsLanguages) readme.push('Gói VI-EN chỉ giữ tài nguyên hệ thống tiếng Việt và tiếng Anh; engine và các DLL giữ nguyên.');
  await fs.writeFile(path.join(folder, 'HUONG-DAN.txt'), readme.join('\r\n'));
  const zipName = 'Calculator-Simulator_' + config.version + '_' + friendly + '.zip';
  const zipFile = path.join(output, zipName);
  if (appPath) run('/usr/bin/ditto', ['-c','-k','--norsrc','--keepParent',folder,zipFile]);
  else run('/usr/bin/zip', ['-q','-r',zipFile,folderName], { cwd:parent });
  const meta = { version:config.version, target, electron:runtime.version, runtimeSha256:runtime.targets[target],
    archive:zipName, bytes:(await fs.stat(zipFile)).size, sha256:hash(await fs.readFile(zipFile)),
    packagingVariant:pruneWindowsLanguages ? 'vi-en' : 'all-locales', removedLocales,
    calculatorCheckpoint:release.calculatorCheckpoint, sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    engineSha256:release.files['engine.js'], minimumMacOS,
    signing:appPath ? 'ad-hoc; not notarized' : 'unsigned', validation:appPath ? 'awaiting app smoke test' : 'package checked; Windows execution pending' };
  await fs.writeFile(path.join(output, target + (pruneWindowsLanguages ? '-vi-en' : '') + '.json'), JSON.stringify(meta, null, 2) + '\n');
  console.log(JSON.stringify(meta, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
