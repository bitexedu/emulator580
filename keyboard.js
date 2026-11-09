'use strict';
// PC shortcuts use the existing buttons: menus, SHIFT/ALPHA and calculator
// modes keep exactly the same dispatch path as a mouse click or touch.
(() => {
  const actions = {
    '.':'dot', ',':'dot', '+':'add', '-':'subtract', '*':'multiply', '/':'divide',
    '(':'open-paren', ')':'close-paren', '^':'power', '=':'equals', Enter:'equals',
    Backspace:'delete', Escape:'clear', Delete:'clear',
    ArrowLeft:'cursor-left', ArrowRight:'cursor-right', ArrowUp:'cursor-up', ArrowDown:'cursor-down',
    F1:'shift', F2:'alpha', m:'menu', o:'optn', c:'calc',
    s:'sin', k:'cos', t:'tan', l:'logn', n:'ln', r:'sqrt', q:'square',
    f:'fraction', e:'times10', x:'input-x', a:'ans', d:'toggle-exact'
  };
  const pressed = new Map();
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.keyCode === 229) return;
    const target = event.target;
    if (target?.isContentEditable || target?.closest?.('input,textarea,select,[role="textbox"]') || document.querySelector('dialog[open]')) return;
    // Preserve Enter for app controls, but prevent the browser from also
    // clicking the last focused calculator button after evaluating.
    if (event.key === 'Enter' && target?.closest?.('button,a,[role="button"]') && !target.closest('.key')) return;
    let key = event.key;
    if (event.code === 'NumpadDecimal' && (key === ',' || key === '.')) key = '.';
    if (/^[a-z]$/i.test(key)) key = key.toLowerCase();
    const number = /^[0-9]$/.test(key);
    const action = actions[key];
    if (!number && !action) return;
    const selector = number ? '.key[data-digit="' + key + '"]' : '.key[data-action="' + action + '"]';
    const button = document.querySelector(selector);
    if (!button) return;
    event.preventDefault();
    if (event.repeat && !number && action !== 'delete' && !action.startsWith('cursor-')) return;
    const code = event.code || event.key;
    pressed.get(code)?.classList.remove('keyboard-pressed');
    pressed.set(code, button);
    button.classList.add('keyboard-pressed');
    // A dialog restores focus to its opener. Once typing resumes, move
    // focus back so Enter evaluates instead of reopening that dialog.
    button.focus({ preventScroll: true });
    button.click();
  });
  document.addEventListener('keyup', event => {
    const code = event.code || event.key;
    pressed.get(code)?.classList.remove('keyboard-pressed');
    pressed.delete(code);
  });
  window.addEventListener('blur', () => {
    for (const button of pressed.values()) button.classList.remove('keyboard-pressed');
    pressed.clear();
  });
})();
