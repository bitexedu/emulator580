'use strict';
// Kiểm tra hợp đồng gửi dữ liệu và xử lý lỗi, độc lập với phép toán CASIO.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, 'feedback.js'), 'utf8');
function setup(hostname = 'bitex-test.netlify.app', respond = async () => ({ ok: true }), onLine = true) {
  const ids = ['feedback-form','feedback-image','feedback-upload','feedback-preview','feedback-preview-image','feedback-filename','feedback-status','feedback-submit','feedback-remove','feedback-display','screen'];
  const elements = Object.fromEntries(ids.map(id => [id, { id, hidden: true, value: '', files: [], textContent: '', dataset: {}, handlers: {}, addEventListener(name, fn) { this.handlers[name] = fn; }, removeAttribute() {} }]));
  const form = elements['feedback-form'];
  form.action = 'https://' + hostname + '/feedback-success.html';
  form.valid = true;
  form.reportValidity = () => form.valid;
  form.resets = 0;
  form.reset = () => { form.resets++; elements['feedback-image'].files = []; };
  const sent = [], revoked = [];
  let previews = 0;
  class FormData { constructor(form) { this.form = form; this.image = elements['feedback-image'].files[0]; } }
  class DataTransfer { constructor() { this.files = []; this.items = { add: file => this.files.push(file) }; } }
  vm.runInNewContext(source, {
    navigator: { onLine }, document: { getElementById: id => elements[id] }, location: { hostname },
    URL: { createObjectURL: () => 'blob:preview-' + ++previews, revokeObjectURL: url => revoked.push(url) },
    FormData, DataTransfer, AbortController, setTimeout, clearTimeout,
    fetch: async (url, options) => { sent.push({url, options}); return respond(); }
  });
  const submit = () => form.handlers.submit({ preventDefault() {} });
  return {elements, form, sent, revoked, submit};
}
(async () => {
  let x = setup('bitex-test.netlify.app', undefined, false);
  await x.submit(); assert.equal(x.sent.length,0); assert.equal(x.form.resets,0); assert.match(x.elements['feedback-status'].textContent,/Cần kết nối mạng/);
  x = setup('127.0.0.1'); await x.submit(); assert.equal(x.sent.length,0); assert.equal(x.form.resets,0);
  x = setup('127.0.0.1'); x.form.dataset.desktopFeedback='true'; await x.submit(); assert.equal(x.sent.length,1); assert.equal(x.form.resets,1);
  x = setup(); x.form.valid=false; await x.submit(); assert.equal(x.sent.length,0);
  x = setup(); x.elements['feedback-image'].files=[{type:'image/svg+xml',size:20}]; await x.submit(); assert.equal(x.sent.length,0);
  x = setup(); x.elements['feedback-image'].files=[{type:'image/png',size:6*1024*1024}]; await x.submit(); assert.equal(x.sent.length,0);
  x = setup('bitex-test.netlify.app',async()=>({ok:false})); await x.submit(); assert.equal(x.form.resets,0); assert.equal(x.elements['feedback-status'].dataset.error,'true'); assert.equal(x.elements['feedback-submit'].disabled,false);
  x = setup('bitex-test.netlify.app',async()=>{throw new Error('Offline')}); await x.submit(); assert.equal(x.form.resets,0);
  x = setup(); const file={type:'image/png',size:1024,name:'ket-qua.png'}; x.elements['feedback-image'].files=[file]; x.elements.screen.textContent='1/3'; await x.submit();
  assert.equal(x.sent[0].options.method,'POST'); assert.equal(x.sent[0].options.headers,undefined); assert.equal(x.sent[0].options.body.image,file); assert.equal(x.elements['feedback-display'].value,'1/3'); assert.equal(x.form.resets,1);
  x=setup(); x.elements['feedback-image'].files=[file]; x.elements['feedback-image'].handlers.change(); assert.equal(x.elements['feedback-preview'].hidden,false); x.elements['feedback-remove'].handlers.click(); assert.equal(x.elements['feedback-preview'].hidden,true); assert.equal(x.revoked.length,1);
  let done; x=setup('bitex-test.netlify.app',()=>new Promise(resolve=>{done=resolve})); const first=x.submit(); await x.submit(); assert.equal(x.sent.length,1); done({ok:true}); await first; assert.equal(x.elements['feedback-submit'].disabled,false);
  x=setup(); x.form.handlers.paste({clipboardData:{items:[{kind:'file',getAsFile:()=>file}]},preventDefault(){}}); assert.equal(x.elements['feedback-image'].files[0],file);
  x=setup(); let prevented=false; x.form.handlers.paste({clipboardData:{items:[{kind:'string'}]},preventDefault(){prevented=true}}); assert.equal(prevented,false);
  console.log('Feedback: gửi ảnh, giữ nội dung khi lỗi, chặn gửi trùng và kiểm tra file — PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
