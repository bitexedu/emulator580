'use strict';
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const MAX_FEEDBACK_BYTES = 6 * 1024 * 1024;
const FEEDBACK_URL = 'https://bitex-calculator-beta.netlify.app/feedback-success.html';
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'";
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png', '.ttf':'font/ttf', '.svg':'image/svg+xml', '.webmanifest':'application/manifest+json' };

async function submitToNetlify({ body, contentType }) {
  const response = await fetch(FEEDBACK_URL, { method: 'POST',
    headers: { 'Content-Type': contentType }, body, signal: AbortSignal.timeout(30000) });
  await response.body?.cancel();
  return response.ok;
}

function readBody(req, res) {
  return new Promise(resolve => {
    const chunks = [];
    let size = 0, finished = false;
    const fail = () => { if (!finished) { finished = true; resolve(null); } };
    req.on('aborted', fail);
    req.on('error', fail);
    req.on('data', chunk => {
      if (finished) return;
      size += chunk.length;
      if (size > MAX_FEEDBACK_BYTES) {
        res.writeHead(413); res.end('Upload too large'); fail(); return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => { if (!finished) { finished = true; resolve(Buffer.concat(chunks)); } });
  });
}

async function createDesktopServer({ assetsDir, submitFeedback = submitToNetlify }) {
  const manifest = JSON.parse(await fs.readFile(path.join(assetsDir, 'release.json'), 'utf8'));
  const allowed = new Set([...Object.keys(manifest.files), 'release.json']);
  allowed.delete('_headers');
  let origin;
  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const reply = (code, text) => { res.writeHead(code, { 'Content-Type':'text/plain; charset=utf-8' }); res.end(text); };
    if (req.headers.host !== new URL(origin).host) { reply(403, 'Invalid Host'); return; }
    let name;
    try { name = decodeURIComponent(new URL(req.url, origin).pathname).slice(1) || 'index.html'; }
    catch { reply(404, 'Not found'); return; }
    if (req.method === 'POST' && name === 'feedback-success.html') {
      if (req.headers.origin !== origin) { reply(403, 'Invalid Origin'); return; }
      const contentType = req.headers['content-type'] || '';
      if (!/^multipart\/form-data;\s*boundary=/i.test(contentType)) { reply(415, 'Expected multipart feedback'); return; }
      if (Number(req.headers['content-length']) > MAX_FEEDBACK_BYTES) { reply(413, 'Upload too large'); req.resume(); return; }
      const body = await readBody(req, res);
      if (body === null) return;
      try {
        if (!await submitFeedback({ body, contentType })) throw new Error('Not accepted');
        reply(200, 'Feedback received');
      } catch { reply(503, 'Feedback needs an Internet connection. Please try again.'); }
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) { reply(405, 'Method not allowed'); return; }
    if (name.split('/').some(part => part === '..' || part === '.' || part === '') || name.includes('\\') || !allowed.has(name)) { reply(404, 'Not found'); return; }
    try {
      const content = await fs.readFile(path.join(assetsDir, name));
      res.writeHead(200, { 'Content-Type':TYPES[path.extname(name)] || 'application/octet-stream' });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch { reply(404, 'Not found'); }
  });
  server.requestTimeout = 35000;
  server.headersTimeout = 10000;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  origin = 'http://127.0.0.1:' + server.address().port;
  return { server, origin };
}
module.exports = { createDesktopServer, MAX_FEEDBACK_BYTES };
