'use strict';
const { app, BrowserWindow, Menu, dialog, screen } = require('electron');
const path = require('node:path');
const { createDesktopServer } = require('./server.cjs');
app.setName('Calculator Simulator');
app.setAppUserModelId('app.calculator.simulator');
let desktop, window;
const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
else {
  app.on('second-instance', () => {
    if (!window || window.isDestroyed()) createWindow();
    else { if (window.isMinimized()) window.restore(); window.show(); window.focus(); }
  });
  app.whenReady().then(async () => {
    desktop = await createDesktopServer({ assetsDir: path.join(__dirname, 'assets') });
    const menu = [];
    if (process.platform === 'darwin') menu.push({ role:'appMenu' });
    else menu.push({ label:'Tệp', submenu:[{ role:'quit', label:'Thoát' }] });
    menu.push({ label:'Chỉnh sửa', submenu:[{ role:'undo' }, { role:'redo' }, { type:'separator' },
      { role:'cut' }, { role:'copy' }, { role:'paste' }, { role:'selectAll' }] });
    menu.push({ label:'Hiển thị', submenu:[{ role:'resetZoom' }, { role:'zoomIn' }, { role:'zoomOut' },
      { type:'separator' }, { role:'togglefullscreen' }] });
    menu.push({ role:'windowMenu' });
    Menu.setApplicationMenu(Menu.buildFromTemplate(menu));
    createWindow();
    app.on('activate', () => { if (!window || window.isDestroyed()) createWindow(); });
  }).catch(error => {
    dialog.showErrorBox('Không mở được máy tính', error.message);
    app.quit();
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('before-quit', () => { desktop?.server.closeAllConnections(); desktop?.server.close(); });
}
function createWindow() {
  if (!desktop) return;
  const area = screen.getPrimaryDisplay().workAreaSize;
  window = new BrowserWindow({ title:'Giả lập máy tính khoa học', show:false,
    width:Math.min(1180, area.width), height:Math.min(1050, area.height), minWidth:440, minHeight:600,
    backgroundColor:'#f5f4ee', icon:path.join(__dirname, 'icon.png'),
    webPreferences:{ nodeIntegration:false, contextIsolation:true, sandbox:true, webSecurity:true } });
  const session = window.webContents.session;
  session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.setPermissionCheckHandler(() => false);
  session.webRequest.onBeforeRequest({ urls:['http://*/*','https://*/*','ws://*/*','wss://*/*'] }, (details, callback) => {
    callback({ cancel:new URL(details.url).origin !== desktop.origin });
  });
  session.on('will-download', event => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action:'deny' }));
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== desktop.origin) event.preventDefault();
  });
  window.webContents.on('did-fail-load', (_event, code, description, _url, isMainFrame) => {
    if (isMainFrame && code !== -3) dialog.showErrorBox('Không tải được máy tính', description);
  });
  window.once('ready-to-show', () => { window.show(); window.focus(); });
  window.loadURL(desktop.origin + '/');
}
