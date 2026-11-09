'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { createDesktopServer, MAX_FEEDBACK_BYTES } = require('./server.cjs');

async function fixture(t, submitFeedback = async () => true) {
  const assetsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'calculator-desktop-test-'));
  await fs.writeFile(path.join(assetsDir, 'index.html'), '<h1>Offline calculator</h1>');
  await fs.mkdir(path.join(assetsDir, 'assets'));
  await fs.writeFile(path.join(assetsDir, 'assets/device-face.svg'), '<svg/>');
  await fs.writeFile(path.join(assetsDir, 'assets/private.svg'), 'private');
  await fs.writeFile(path.join(assetsDir, 'engine.js'), '/* packaged engine */');
  await fs.writeFile(path.join(assetsDir, 'private.txt'), 'not a product asset');
  await fs.writeFile(path.join(assetsDir, 'release.json'), JSON.stringify({ files: {
    'index.html': 'test', 'engine.js': 'test', 'assets/device-face.svg': 'test'
  } }));
  const desktop = await createDesktopServer({ assetsDir, submitFeedback });
  t.after(async () => {
    desktop.server.closeAllConnections();
    await new Promise(resolve => desktop.server.close(resolve));
    await fs.rm(assetsDir, { recursive: true, force: true });
  });
  return desktop;
}

test('only packaged assets are served; paths and internal source stay private', async t => {
  const { origin } = await fixture(t);
  assert.equal(await (await fetch(origin + '/')).text(), '<h1>Offline calculator</h1>');
  const script = await fetch(origin + '/engine.js');
  assert.match(script.headers.get('content-type'), /javascript/);
  assert.match(script.headers.get('content-security-policy'), /script-src 'self'/);
  const face = await fetch(origin + '/assets/device-face.svg');
  assert.equal(await face.text(), '<svg/>');
  assert.match(face.headers.get('content-type'), /image\/svg/);
  for (const name of ['/assets/private.svg', '/assets/..%2fprivate.txt', '/private.txt', '/main.cjs', '/..%2fprivate.txt', '/%ZZ']) {
    assert.equal((await fetch(origin + name)).status, 404, name);
  }
  assert.equal((await fetch(origin + '/', { method: 'DELETE' })).status, 405);
});

test('a foreign Host or Origin cannot send feedback to the loopback server', async t => {
  let sent = 0;
  const { origin } = await fixture(t, async () => { sent++; return true; });
  const body = { method: 'POST', headers: { 'Content-Type': 'multipart/form-data; boundary=test' }, body: 'test' };
  const wrongHost = await new Promise((resolve, reject) => {
    http.get(origin + '/', { headers: { Host:'attacker.invalid' } }, response => {
      response.resume(); resolve(response.statusCode);
    }).on('error', reject);
  });
  assert.equal(wrongHost, 403);
  assert.equal((await fetch(origin + '/feedback-success.html', { ...body,
    headers: { ...body.headers, Origin: 'https://attacker.invalid' } })).status, 403);
  assert.equal((await fetch(origin + '/feedback-success.html', body)).status, 403);
  assert.equal(sent, 0);
});

test('multipart feedback and image bytes reach the fixed recipient unchanged', async t => {
  let received;
  const { origin } = await fixture(t, async value => { received = value; return true; });
  const contentType = 'multipart/form-data; boundary=desktop-test';
  const body = Buffer.concat([Buffer.from('--desktop-test\r\nContent-Disposition: form-data; name="screenshot"; filename="lcd.png"\r\nContent-Type: image/png\r\n\r\n'),
    Buffer.from([137,80,78,71,0,255,13,10]), Buffer.from('\r\n--desktop-test--\r\n')]);
  const response = await fetch(origin + '/feedback-success.html', { method: 'POST',
    headers: { Origin: origin, 'Content-Type': contentType }, body });
  assert.equal(response.status, 200);
  assert.deepEqual(received.body, body);
  assert.equal(received.contentType, contentType);
});

test('bad content types, oversized uploads and offline delivery fail explicitly', async t => {
  let sent = 0;
  const { origin } = await fixture(t, async () => { sent++; throw new Error('offline'); });
  const post = (body, type) => fetch(origin + '/feedback-success.html', { method: 'POST',
    headers: { Origin: origin, 'Content-Type': type }, body });
  assert.equal((await post('not multipart', 'text/plain')).status, 415);
  assert.equal((await post(Buffer.alloc(MAX_FEEDBACK_BYTES + 1), 'multipart/form-data; boundary=x')).status, 413);
  assert.equal(sent, 0);
  assert.equal((await post('multipart', 'multipart/form-data; boundary=x')).status, 503);
  assert.equal(sent, 1);
});
