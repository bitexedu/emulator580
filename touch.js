'use strict';
// Quản lý vòng đời một lần chạm, độc lập phép tính và hình thức phím.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.CalculatorTouch = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  function bindKeys(doc, keypad, win) {
    const active = new Set();
    let press = null, blockClickUntil = -Infinity;
    const inside = (key, e) => { const r = key.getBoundingClientRect(); return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom; };
    function reset() {
      press?.key.classList.remove('touch-pressed'); press = null; active.clear();
    }
    doc.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
      active.add(e.pointerId);
      if (active.size > 1) { press?.key.classList.remove('touch-pressed'); press = null; return; }
      const key = e.target.closest?.('.key:not(.key-locked)');
      if (!key || !keypad.contains(key) || doc.querySelector('dialog[open]')) return;
      // Không để focus/nhấp tương thích di chuyển trang sau khi đã nhận chạm.
      e.preventDefault(); blockClickUntil = e.timeStamp + 800;
      press = {id:e.pointerId, key}; key.classList.add('touch-pressed');
    }, {capture:true, passive:false});
    doc.addEventListener('pointermove', e => {
      if (press?.id === e.pointerId && !inside(press.key, e)) {
        press.key.classList.remove('touch-pressed'); press = null;
      }
    }, true);
    doc.addEventListener('pointerup', e => {
      active.delete(e.pointerId);
      if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
      blockClickUntil = e.timeStamp + 800;
      if (press?.id !== e.pointerId) return;
      const key = press.key;
      const accept = inside(key,e) && !doc.querySelector('dialog[open]');
      reset(); e.preventDefault();
      // .click() dùng nguyên đường xử lý phím/SHIFT/ALPHA và chỉ chạy một lần.
      if (accept) key.click();
    }, {capture:true, passive:false});
    doc.addEventListener('click', e => {
      if (e.detail > 0 && (e.pointerType === 'touch' || e.pointerType === 'pen' || e.timeStamp <= blockClickUntil) && e.target.closest?.('.key')) {
        e.preventDefault(); e.stopImmediatePropagation();
      }
    }, true);
    for (const name of ['pointercancel','calculator-interaction-reset','visibilitychange']) doc.addEventListener(name, reset, true);
    for (const name of ['blur','pagehide','resize']) win.addEventListener(name, reset);
    return reset;
  }
  function bindLCD(doc, lcd, win, {enabled, overlayOpen, place, scroll, page}) {
    const pointers = new Map(); let gesture = null, suppressClick = false;
    function reset() {
      const ids = [...pointers.keys()]; pointers.clear(); gesture = null; suppressClick = false;
      for (const id of ids) if (lcd.hasPointerCapture?.(id)) lcd.releasePointerCapture(id);
    }
    lcd.addEventListener('click', e => {
      if (!enabled() || suppressClick) { e.preventDefault(); e.stopImmediatePropagation(); suppressClick = false; }
    }, true);
    lcd.addEventListener('pointerdown', e => {
      if (!enabled()) return;
      // Một chuỗi mới không được giữ cờ chặn click của thao tác trước.
      if (!pointers.size) { suppressClick = false; gesture = {x:e.clientX,y:e.clientY,overlay:overlayOpen(),moved:false,multi:false}; }
      else gesture.multi = true;
      pointers.set(e.pointerId, {x:e.clientX,y:e.clientY});
      if (!gesture.overlay) lcd.setPointerCapture(e.pointerId);
    });
    lcd.addEventListener('pointermove', e => {
      const prev = pointers.get(e.pointerId);
      if (!enabled() || !prev || !gesture) return;
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if (gesture.multi) { scroll((e.clientX-prev.x)/pointers.size); return; }
      if (Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>6) gesture.moved=true;
      if (gesture.moved && !gesture.overlay) place(e.clientX,e.clientY);
    });
    lcd.addEventListener('pointerup', e => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      const current = gesture;
      if (!pointers.size) gesture = null;
      if (!current || current.multi) { suppressClick=true; return; }
      if (current.overlay) {
        const dy=e.clientY-current.y;
        if (Math.abs(dy)>25) { page(dy<0?'down':'up'); suppressClick=true; }
      } else { place(e.clientX,e.clientY); suppressClick=true; }
    });
    // Hủy cả chuỗi nhiều ngón, không để con trỏ/capture cũ kéo dài sang lần bấm mới.
    lcd.addEventListener('pointercancel', reset);
    lcd.addEventListener('lostpointercapture', e => { if (pointers.has(e.pointerId)) reset(); });
    for (const name of ['calculator-interaction-reset','visibilitychange']) doc.addEventListener(name, reset);
    doc.addEventListener('pointerdown', e => { if (!lcd.contains(e.target)) reset(); }, true);
    for (const name of ['blur','pagehide','resize']) win.addEventListener(name, reset);
    return reset;
  }
  return {bindKeys,bindLCD};
});
