'use strict';
// Vỏ ứng dụng: vừa viewport, cài đặt, trạng thái cache. Không truy cập Engine.
(() => {
  const stage = document.getElementById('device-stage');
  const calculator = stage.querySelector('.calculator');
  let hostingBadge = document.getElementById('nl-badge-frame');
  function fit() {
    const box = stage.getBoundingClientRect();
    const style = getComputedStyle(stage);
    const left = box.left + parseFloat(style.paddingLeft);
    const top = box.top + parseFloat(style.paddingTop);
    const width = box.width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const height = box.height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    let fitted = Math.max(0, Math.min(width, height * 375 / 760));
    calculator.style.width = fitted + 'px';
    calculator.style.top = '0px';
    // First use the free space above the device, then shrink only if a real
    // key still collides with the hosting badge. The old centred fit left
    // usable space above while unnecessarily shrinking the whole machine.
    const badge = hostingBadge?.getBoundingClientRect();
    if (fitted > 0 && badge && badge.height > 0 && badge.height <= 80) {
      const device = calculator.getBoundingClientRect();
      const keys = [...calculator.querySelectorAll('.key')].map(key => {
        const r = key.getBoundingClientRect();
        return { left:(r.left-device.left)/device.width, right:(r.right-device.left)/device.width,
          top:(r.top-device.top)/device.height, bottom:(r.bottom-device.top)/device.height };
      });
      // Scaling about the centre moves key x-coordinates; resolve again after
      // a reduction. Width decreases monotonically and never exceeds the box.
      let y;
      for (let pass = 0; pass < keys.length + 1; pass++) {
        const h = fitted * 760 / 375;
        const x = left + (width - fitted) / 2;
        y = top + (height - h) / 2;
        let limit = fitted;
        for (const k of keys) {
          if (x+k.right*fitted <= badge.left || x+k.left*fitted >= badge.right ||
              y+k.top*h >= badge.bottom || y+k.bottom*h+3 <= badge.top) continue;
          y = Math.max(top, Math.min(y, badge.top - 3 - k.bottom*h));
          limit = Math.min(limit, Math.max(0, (badge.top - 3 - top) / k.bottom * 375 / 760));
        }
        if (limit >= fitted - .01) break;
        fitted = limit;
      }
      calculator.style.width = fitted + 'px';
      calculator.style.top = (y - top - (height - fitted * 760 / 375) / 2) + 'px';
    }
  }
  const sizing = new ResizeObserver(fit);
  sizing.observe(stage);
  if (hostingBadge) sizing.observe(hostingBadge);
  new MutationObserver(() => {
    const next = document.getElementById('nl-badge-frame');
    if (next === hostingBadge) return;
    if (hostingBadge) sizing.unobserve(hostingBadge);
    hostingBadge = next;
    if (next) sizing.observe(next);
    fit();
  }).observe(document.body, { childList:true });
  window.addEventListener('resize', fit);
  window.visualViewport?.addEventListener('resize', fit);
  fit();

  const menu = document.getElementById('app-menu');
  const install = document.getElementById('install-dialog');
  const feedback = document.getElementById('feedback-dialog');
  // Chỉ một modal trong suốt vòng Tiện ích → Cài đặt → Hướng dẫn.
  // Không đóng/mở nhiều top-layer trong cùng một tap (focus và vùng chạm iOS).
  const modal = document.getElementById('utility-dialog');
  let panel = null;
  const resetTouch = () => document.dispatchEvent(new Event('calculator-interaction-reset'));
  const close = () => modal.close();
  const open = next => {
    resetTouch();
    if (panel) panel.hidden = true;
    panel = next; panel.hidden = false; panel.scrollTop = 0;
    modal.dataset.panel = panel.id;
    modal.style.left = ''; modal.style.top = '';
    modal.setAttribute('aria-labelledby', panel.getAttribute('aria-labelledby'));
    if (!modal.open) modal.showModal();
    panel.querySelector('[data-close-dialog]').focus({preventScroll:true});
    positionMenu();
  };
  modal.addEventListener('close', () => {
    // Sự kiện close cũ có thể tới sau một lần mở mới rất nhanh.
    if (modal.open) return;
    resetTouch();
    if (panel) panel.hidden = true;
    panel = null;
    document.getElementById('app-menu-button').focus({preventScroll:true});
  });
  let backdropStart = false;
  modal.addEventListener('pointerdown', event => { backdropStart = event.target === modal; });
  modal.addEventListener('pointercancel', () => { backdropStart = false; });
  modal.addEventListener('click', event => {
    if (event.target === modal && backdropStart) close();
    backdropStart = false;
  });
  function positionMenu() {
    if (!modal.open || panel !== menu) return;
    const anchor = document.getElementById('app-menu-button').getBoundingClientRect();
    modal.style.left = Math.max(8, Math.min(anchor.left, document.documentElement.clientWidth-modal.offsetWidth-8)) + 'px';
    modal.style.top = Math.max(8, Math.min(anchor.bottom+8, document.documentElement.clientHeight-modal.offsetHeight-8)) + 'px';
  }
  document.getElementById('app-menu-button').addEventListener('click', () => { open(menu); positionMenu(); });
  window.addEventListener('resize', positionMenu);
  const fullscreen = document.getElementById('fullscreen-button');
  document.addEventListener('fullscreenchange', () => {
    document.getElementById('fullscreen-label').textContent = document.fullscreenElement ? 'Thoát toàn màn hình' : 'Toàn màn hình';
    fit();
  });
  fullscreen.addEventListener('click', async () => {
    const message = document.getElementById('fullscreen-status');
    message.hidden = true;
    close();
    if (!document.fullscreenEnabled) {
      openInstall();
      document.getElementById('install-prompt-status').textContent = 'Trình duyệt này không cho trang web ẩn toàn bộ thanh công cụ. Hãy thêm vào Màn hình chính và mở từ biểu tượng 580VN X để dùng trọn màn hình khả dụng.';
      return;
    }
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      message.textContent = 'Trình duyệt chưa mở được toàn màn hình. Bạn vẫn có thể cài máy tính từ mục Thêm vào màn hình chính.';
      message.hidden = false;
      open(menu);
    }
  });
  document.getElementById('feedback-open').addEventListener('click', () => open(feedback));
  document.getElementById('keyboard-help-button').addEventListener('click', () => open(document.getElementById('keyboard-dialog')));
  for (const button of document.querySelectorAll('[data-close-dialog]')) button.addEventListener('click', close);
  document.getElementById('guide-button').addEventListener('click', () => open(document.getElementById('guide-dialog')));
  const settings = document.getElementById('settings-dialog');
  const preferenceKey = 'calculator-appearance-v1';
  let preferences = { color:'black', highlight:false, touch:false };
  try {
    const saved = JSON.parse(localStorage.getItem(preferenceKey));
    if (saved && ['black','blue','pink'].includes(saved.color)) preferences.color = saved.color;
    if (saved?.highlight === true) preferences.highlight = true;
    if (saved?.touch === true) preferences.touch = true;
  } catch {}
  function applyPreferences(save = false) {
    const source = 'assets/device-face' + (preferences.color === 'black' ? '' : '-' + preferences.color) + '.svg';
    const face = calculator.querySelector('.device-face');
    if (face.getAttribute('src') !== source) face.setAttribute('src', source);
    resetTouch();
    calculator.dataset.keyHighlight = String(preferences.highlight);
    document.getElementById('screen-wrap').dataset.touch = String(preferences.touch);
    document.getElementById('lcd-touch').checked = preferences.touch;
    document.getElementById('key-highlight').checked = preferences.highlight;
    const preview = document.getElementById('case-preview');
    if (preview.getAttribute('src') !== source) preview.setAttribute('src', source);
    for (const button of document.querySelectorAll('[data-case-color]')) button.setAttribute('aria-pressed', String(button.dataset.caseColor === preferences.color));

    if (save) {
      const message = document.getElementById('settings-status');
      try { localStorage.setItem(preferenceKey, JSON.stringify(preferences)); message.textContent = 'Đã lưu cài đặt trên thiết bị này.'; }
      catch { message.textContent = 'Đã áp dụng. Trình duyệt không cho lưu, nên cần chọn lại khi mở lần sau.'; }
    }
  }
  for (const button of document.querySelectorAll('[data-case-color]')) button.addEventListener('click', () => { preferences.color = button.dataset.caseColor; applyPreferences(true); });
  document.getElementById('key-highlight').addEventListener('change', event => { preferences.highlight = event.target.checked; applyPreferences(true); });
  document.getElementById('lcd-touch').addEventListener('change', event => { preferences.touch = event.target.checked; applyPreferences(true); });
  document.getElementById('settings-button').addEventListener('click', () => open(settings));
  calculator.addEventListener('click', event => {
    const key = event.target.closest('.key:not(.key-locked)');
    if (!key) return;
    calculator.querySelector('.last-pressed')?.classList.remove('last-pressed');
    key.classList.add('last-pressed');
  });
  applyPreferences();

  const zoomDialog = document.getElementById('zoom-dialog');
  const zoom = document.getElementById('lcd-zoom');
  function zoomSize() {
    const width = document.getElementById('zoom-viewport').clientWidth * Number(zoom.value);
    const content = document.getElementById('zoom-content');
    const sourceWidth = Number(content.style.getPropertyValue('--source-width')) || 1;
    const scale = width / sourceWidth;
    content.style.transform = 'scale(' + scale + ')';
    const device = document.getElementById('zoom-device');
    device.style.width = width + 'px';
    device.style.height = (content.firstElementChild?.getBoundingClientRect().height || 0) + 'px';
    document.getElementById('lcd-zoom-value').value = Math.round(Number(zoom.value) * 100) + '%';
  }
  document.getElementById('zoom-button').addEventListener('click', () => {
    const clone = document.getElementById('screen-wrap').cloneNode(true);
    // Sao kiểu hiển thị đã tính ra pixel trước khi bỏ ID; không tạo ID trùng
    // và không cho bản phóng to can thiệp vào cây nhập liệu.
    const original = document.getElementById('screen-wrap');
    const sources = [original, ...original.querySelectorAll('*')];
    const copies = [clone, ...clone.querySelectorAll('*')];
    copies.forEach((node, i) => {
      if (node.id) { node.dataset.sourceId = node.id; node.removeAttribute('id'); }
      node.removeAttribute('tabindex');
      const from = sources[i];
      const computed = getComputedStyle(from);
      for (const name of computed) {
        const value = computed.getPropertyValue(name);
        // LCD được sao nguyên kích thước trước khi phóng đồng đều bằng zoom.
        node.style.setProperty(name, value);
      }
      if (node.matches('.cursor')) node.style.visibility = 'hidden';
    });
    clone.style.position = 'relative'; clone.style.inset = 'auto'; clone.style.pointerEvents = 'none';
    const content = document.getElementById('zoom-content');
    content.replaceChildren(clone);
    content.style.width = original.getBoundingClientRect().width + 'px';
    content.style.height = original.getBoundingClientRect().height + 'px';
    content.inert = true;
    content.style.setProperty('--source-width', original.getBoundingClientRect().width);
    zoom.value = '1'; open(zoomDialog); zoomSize();
    copies.forEach((node, i) => { node.scrollLeft = sources[i].scrollLeft; node.scrollTop = sources[i].scrollTop; });
  });
  zoom.addEventListener('input', zoomSize);
  new ResizeObserver(() => { if (modal.open && panel === zoomDialog) zoomSize(); }).observe(document.getElementById('zoom-viewport'));

  let installPrompt, justInstalled = false;
  const installed = () => justInstalled || window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const installNow = document.getElementById('install-now');
  const platformButtons = [...document.querySelectorAll('[data-install-platform]')];
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let installPlatform = isIOS ? 'ios' : /Android/.test(navigator.userAgent) ? 'android' : 'desktop';
  function showInstallPlatform(platform) {
    installPlatform = platform;
    for (const button of platformButtons) {
      const selected = button.dataset.installPlatform === platform;
      button.setAttribute('aria-pressed', String(selected));
      document.getElementById('install-' + button.dataset.installPlatform).hidden = !selected;
    }
    syncInstall();
  }
  function syncInstall() {
    installNow.hidden = Boolean(installed()) || installPlatform === 'ios';
    installNow.textContent = installPrompt ? 'Cài ngay' : 'Cài ngay — xem cách cài';
    document.getElementById('install-menu-label').textContent = installed() ? 'Hướng dẫn cài ứng dụng' : (isIOS ? 'Thêm vào màn hình chính' : 'Cài ngay');
    document.getElementById('install-shortcut').textContent = isIOS ? 'Cài ứng dụng' : 'Cài ngay';
    document.getElementById('install-complete').hidden = !installed();
    document.getElementById('install-shortcut').hidden = Boolean(installed());
  }
  for (const button of platformButtons) button.addEventListener('click', () => showInstallPlatform(button.dataset.installPlatform));
  function openInstall() {
    showInstallPlatform(installPlatform);
    document.getElementById('install-url').value = new URL('./', location.href).href;
    document.getElementById('install-copy-status').textContent = '';
    open(install);
  }
  document.getElementById('install-button').addEventListener('click', openInstall);
  document.getElementById('guide-install-button').addEventListener('click', openInstall);
  document.getElementById('install-shortcut').addEventListener('click', openInstall);
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; syncInstall(); });
  window.addEventListener('appinstalled', () => { justInstalled = true; installPrompt = null; syncInstall(); });
  installNow.addEventListener('click', async () => {
    if (installed()) return;
    if (!installPrompt) {
      document.getElementById('install-prompt-status').textContent = installPlatform === 'desktop'
        ? 'Chrome: bấm biểu tượng cài đặt ở bên phải thanh địa chỉ, hoặc menu ⋮ → Truyền, lưu và chia sẻ → Cài đặt trang dưới dạng ứng dụng. Edge: menu ⋯ → Ứng dụng → Cài đặt trang này. Safari trên Mac: Tệp → Thêm vào Dock. Nếu đã cài trước đó, mở từ biểu tượng ứng dụng.'
        : 'Chrome: mở menu ⋮ → Thêm vào màn hình chính → Cài đặt. Nếu đang ở trình duyệt trong Zalo/Facebook, hãy mở đường dẫn bằng Chrome trước.';
      return;
    }
    const prompt = installPrompt;
    installPrompt = null;
    syncInstall();
    installNow.disabled = true;
    installNow.textContent = 'Đang chờ xác nhận…';
    const message = document.getElementById('install-prompt-status');
    message.textContent = 'Hãy xác nhận trong cửa sổ cài đặt của trình duyệt.';
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      message.textContent = choice.outcome === 'accepted' ? 'Đã gửi yêu cầu cài đặt. Hãy chờ biểu tượng 580VN X xuất hiện.' : 'Bạn có thể cài sau bằng menu trình duyệt theo hướng dẫn phía trên.';
    } catch {
      message.textContent = 'Chưa mở được cửa sổ cài đặt. Hãy dùng menu trình duyệt theo hướng dẫn phía trên.';
    } finally { installNow.disabled = false; syncInstall(); }
  });
  document.getElementById('install-copy-link').addEventListener('click', async () => {
    const input = document.getElementById('install-url');
    const message = document.getElementById('install-copy-status');
    try { await navigator.clipboard.writeText(input.value); message.textContent = 'Đã sao chép. Hãy dán vào thanh địa chỉ Safari hoặc Chrome.'; }
    catch { input.focus(); input.select(); message.textContent = 'Hãy chọn Sao chép cho đường dẫn đang được chọn.'; }
  });
  showInstallPlatform(installPlatform);

  const status = document.getElementById('offline-status');
  document.getElementById('check-update-button').addEventListener('click', async () => {
    const message = document.getElementById('update-status');
    if (!navigator.onLine) { message.textContent = 'Đang ngoại tuyến. Hãy kết nối mạng để kiểm tra bản mới.'; return; }
    if (!registration) { message.textContent = 'Trình duyệt chưa sẵn sàng kiểm tra cập nhật. Hãy mở lại trang khi có mạng.'; return; }
    message.textContent = 'Đang kiểm tra phiên bản mới…';
    try {
      await registration.update();
      if (registration.waiting) { update.hidden = false; message.textContent = 'Có bản mới. Bấm Cập nhật khi đã hoàn tất phép tính.'; }
      else message.textContent = registration.installing ? 'Đang tải bản mới. Nút cập nhật sẽ hiện khi tải xong.' : 'Bạn đang dùng phiên bản mới nhất.';
    } catch { message.textContent = 'Chưa kiểm tra được. Máy tính hiện tại vẫn dùng được; hãy thử lại khi mạng ổn định.'; }
  });
  const update = document.getElementById('update-button');
  let ready = false, registration, reloadAfterUpdate = false;
  function showStatus() {
    status.dataset.error = String(!ready);
    if (ready) status.textContent = navigator.onLine ? 'Sẵn sàng dùng ngoại tuyến.' : 'Đang dùng ngoại tuyến. Máy tính vẫn hoạt động; gửi góp ý cần mạng.';
    else status.textContent = navigator.onLine ? 'Chưa sẵn sàng dùng ngoại tuyến. Hãy giữ kết nối và mở lại trang để tải đủ chương trình.' : 'Chưa lưu đủ chương trình ngoại tuyến. Cần kết nối mạng và mở lại trang.';
    const installStatus = document.getElementById('install-offline-status');
    installStatus.textContent = status.textContent;
    installStatus.dataset.error = String(!ready);
  }
  window.addEventListener('online', showStatus);
  window.addEventListener('offline', showStatus);
  async function checkCache(worker) {
    if (!worker) return;
    const channel = new MessageChannel();
    ready = await new Promise(resolve => {
      const timer = setTimeout(() => resolve(false), 6000);
      channel.port1.onmessage = event => { clearTimeout(timer); resolve(event.data?.ready === true); };
      worker.postMessage({ type: 'CHECK_CACHE' }, [channel.port2]);
    });
    channel.port1.close();
    showStatus();
  }
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    showStatus();
    return;
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadAfterUpdate) location.reload();
  });
  update.addEventListener('click', () => {
    if (!registration?.waiting) return;
    // Chỉ tải lại khi người dùng bấm; không tự làm mất phép tính đang nhập.
    reloadAfterUpdate = true;
    registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
  });
  function watchUpdate() {
    if (registration.waiting && navigator.serviceWorker.controller) update.hidden = false;
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        if (worker.state === 'installed' && registration.waiting && navigator.serviceWorker.controller) update.hidden = false;
        if (worker.state === 'redundant' && !registration.active) { ready = false; showStatus(); }
      });
    });
  }
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(async reg => {
    registration = reg;
    watchUpdate();
    const active = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('offline cache timeout')), 20000);
      navigator.serviceWorker.ready.then(value => { clearTimeout(timer); resolve(value); });
    });
    await checkCache(active.active);
  }).catch(async () => {
    try {
      // Kiểm cache đang hoạt động cả khi kiểm tra phiên bản mới bị mất mạng.
      registration = await navigator.serviceWorker.getRegistration();
      if (registration?.active) { watchUpdate(); await checkCache(registration.active); return; }
    } catch {}
    ready = false; showStatus();
  });
})();
