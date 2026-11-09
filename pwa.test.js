'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
function worker({ failInstall = false, source = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8') } = {}) {
  const handlers = {}, store = new Map(), deleted = [], network = [];
  let claimed = false, skipped = false;
  const caches = {
    open: async name => {
      if (!store.has(name)) store.set(name, new Map());
      const map = store.get(name);
      return {
        addAll: async requests => {
          if (failInstall) { map.set(requests[0].url, new Response('partial')); throw new Error('network'); }
          for (const req of requests) map.set(req.url, new Response('cached:' + new URL(req.url).pathname));
        },
        match: async key => map.get(typeof key === 'string' ? key : key.url)?.clone()
      };
    },
    keys: async () => [...store.keys()],
    delete: async name => { deleted.push(name); return store.delete(name); }
  };
  const scope = 'https://calculator.test/demo/';
  vm.runInNewContext(source, { URL, Request, caches, fetch:async req => { network.push(req); throw new Error('offline'); }, self: {
    registration: { scope }, clients:{ claim:async () => { claimed = true; } },
    skipWaiting:() => { skipped = true; }, addEventListener:(type, cb) => { handlers[type] = cb; }
  } });
  const lifecycle = async name => { let promise; handlers[name]({ waitUntil:p => { promise = p; } }); await promise; };
  const request = async (name, options) => {
    let promise;
    handlers.fetch({ request:new Request(new URL(name, scope), options), respondWith:p => { promise = p; } });
    return promise;
  };
  const cacheStatus = async () => { let promise, result; handlers.message({ data:{type:'CHECK_CACHE'}, ports:[{postMessage:r=>{result=r;}}], waitUntil:p=>{promise=p;} }); await promise; return result; };
  return { handlers, store, deleted, network, lifecycle, request, cacheStatus, get claimed(){return claimed;}, get skipped(){return skipped;} };
}
test('full shell opens offline at root, nested scope and query URL; no network dependency', async () => {
  const w = worker(); await w.lifecycle('install'); await w.lifecycle('activate');
  assert.equal(w.claimed, true);
  assert.equal((await w.cacheStatus()).ready, true);
  for (const name of ['./','index.html?launch=home','engine.js','keyboard.js','touch.js','assets/menu-tiles.svg','assets/device-face.svg','assets/device-face-blue.svg','assets/device-face-pink.svg','assets/icon-180.png']) {
    assert.match(await (await w.request(name)).text(), /^cached:/);
  }
  assert.equal(w.network.length, 0);
});
test('failed first install is not reported ready and partial shell is discarded', async () => {
  const w = worker({failInstall:true});
  await assert.rejects(w.lifecycle('install'), /network/);
  assert.equal(w.store.size, 0);
  assert.equal((await w.cacheStatus()).ready, false);
});
test('feedback POST, private files and third party requests bypass offline cache', async () => {
  const w = worker(); await w.lifecycle('install');
  for (const [name, options] of [['feedback-success.html',{method:'POST',body:'photo'}],['docs/private.json'],['https://other.test/engine.js']]) {
    assert.equal(await w.request(name, options), undefined);
  }
});
test('updates wait for user; activation removes only calculator caches', async () => {
  const w = worker(); w.store.set('calculator-shell-old',new Map()); w.store.set('unrelated-app',new Map());
  await w.lifecycle('install'); assert.equal(w.skipped, false);
  w.handlers.message({data:{type:'ACTIVATE_UPDATE'}}); assert.equal(w.skipped,true);
  await w.lifecycle('activate');
  assert.deepEqual(w.deleted,['calculator-shell-old']);
  assert.equal(w.store.has('unrelated-app'),true);
});
test('static package includes all offline assets, deterministic version and valid icon sizes', async t => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(),'calculator-pwa-release-'));
  t.after(()=>fs.rmSync(out,{recursive:true,force:true}));
  execFileSync(process.execPath,[path.join(__dirname,'build-release.js'),out]);
  const release = JSON.parse(fs.readFileSync(path.join(out,'release.json')));
  const code = fs.readFileSync(path.join(out,'sw.js'),'utf8');
  assert.ok(code.includes('calculator-shell-'+release.offlineCache));
  const shell = JSON.parse(code.match(/const SHELL_FILES = (\[[^;]+\]);/)[1]);
  for (const file of shell) assert.ok(fs.statSync(path.join(out,file)).isFile(), file);
  for (const file of Object.keys(release.files)) assert.equal(/^(?:docs|desktop|\.git|engine.test)/.test(file),false,file);
  for (const n of [180,192,512]) {
    const icon = fs.readFileSync(path.join(out,`assets/icon-${n}.png`));
    assert.equal(icon.readUInt32BE(16),n); assert.equal(icon.readUInt32BE(20),n);
  }
  execFileSync(process.execPath,[path.join(__dirname,'build-release.js'),out]);
  assert.equal(fs.readFileSync(path.join(out,'sw.js'),'utf8'),code);
  const w = worker({source:code}); await w.lifecycle('install'); assert.equal((await w.cacheStatus()).ready,true);
});

test('verified build has a consistent version in the menu, feedback, hashes and cache', t => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'calculator-qa-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const metadata = path.join(tmp, 'verified.json');
  const checkpoint = '1234567890abcdef1234567890abcdef12345678';
  const build = version => {
    fs.writeFileSync(metadata, JSON.stringify({version, calculatorCheckpoint:checkpoint,
      assertions:100, failures:0, pending:3, knownDivergences:2}));
    const output = path.join(tmp, 'app');
    execFileSync(process.execPath, [path.join(__dirname, 'build-release.js'), output, metadata]);
    const release = JSON.parse(fs.readFileSync(path.join(output, 'release.json')));
    const bytes = fs.readFileSync(path.join(output, 'index.html'));
    const html = bytes.toString('utf8');
    assert.equal(release.version, version);
    assert.equal(release.calculatorCheckpoint, checkpoint);
    assert.ok(html.includes('Phiên bản ' + version + ' · 1234567'));
    assert.ok(html.includes('name="version" value="' + version + '"'));
    assert.ok(html.includes('name="calculator-checkpoint" value="' + checkpoint + '"'));
    assert.equal(release.files['index.html'], require('node:crypto').createHash('sha256').update(bytes).digest('hex'));
    assert.ok(fs.readFileSync(path.join(output, 'sw.js'), 'utf8').includes('calculator-shell-' + release.offlineCache));
    return release.offlineCache;
  };
  assert.notEqual(build('2026.11.09-qa.1'), build('2026.11.09-qa.2'));
});

// TrueType horizontal metrics must preserve the empty left pixels in each cell.
for (const fontName of ['lcd-numerals.ttf','lcd-text.ttf']) test('LCD font bearings preserve measured character gaps: '+fontName, () => {
  const b = fs.readFileSync(path.join(__dirname, 'assets',fontName));
  const table = {};
  for (let i=0;i<b.readUInt16BE(4);i++) {
    const p=12+i*16; table[b.toString('ascii',p,p+4)] = b.readUInt32BE(p+8);
  }
  const count=b.readUInt16BE(table.maxp+4);
  assert.ok(b.readUInt16BE(table.head+16)&2);
  for (let i=0;i<count;i++) {
    const start=b.readUInt32BE(table.loca+i*4), end=b.readUInt32BE(table.loca+(i+1)*4);
    const bearing=b.readInt16BE(table.hmtx+i*4+2);
    assert.equal(bearing,start===end?0:b.readInt16BE(table.glyf+start+2),'glyph '+i+' left pixels');
  }
});
