// Static server cuc bo cho kiem tra UI.
// Khong dung cache de trinh duyet luon nap code moi nhat sau moi lan sua.
const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.env.BITEX_ROOT || __dirname);
const host = '127.0.0.1';
const port = Number(process.env.BITEX_PORT || 8771);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8'
};

function send(res, status, body, type) {
  res.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': type || 'text/plain; charset=utf-8'
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://${host}`).pathname);
  } catch {
    send(res, 400, 'Bad request');
    return;
  }

  const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.resolve(root, requested);
  if (filePath !== root && !filePath.startsWith(root + path.sep)) {
    send(res, 403, 'Forbidden');
    return;
  }

  fs.readFile(filePath, (error, body) => {
    if (error) {
      send(res, error.code === 'ENOENT' ? 404 : 500,
        error.code === 'ENOENT' ? 'Not found' : 'Server error');
      return;
    }
    send(res, 200, body, contentTypes[path.extname(filePath).toLowerCase()]);
  });
});

server.listen(port, host, () => {
  console.log(`BITEX Calculator: http://${host}:${port}`);
});
