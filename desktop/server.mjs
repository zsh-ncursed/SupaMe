// Общий модуль: статический сервер для dist, выбор свободного порта, открытие браузера
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DIST = path.join(__dirname, '..', 'dist');
export const HOST = '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

export function openBrowser(url) {
  const platform = process.platform;
  const cmd = platform === 'win32' ? 'cmd' : platform === 'darwin' ? 'open' : 'xdg-open';
  const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.on('error', () => console.log(`Откройте в браузере: ${url}`));
    child.unref();
  } catch {
    console.log(`Откройте в браузере: ${url}`);
  }
}

function handleRequest(distDir, req, res) {
  try {
    const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const rel = path.normalize(urlPath).replace(/^([.][.][/\\])+/, '');
    let filePath = path.join(distDir, rel);
    if (!filePath.startsWith(distDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, 'index.html'); // SPA fallback
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(500);
    res.end('Internal error');
  }
}

/**
 * Запускает http-сервер, раздающий dist.
 * Если порт занят — пробует следующий (5180, 5181, …).
 */
export function startServer(distDir = DIST, startPort = 5180, attempts = 20) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => handleRequest(distDir, req, res));

    function tryListen(port, left) {
      server.once('error', (err) => {
        if (/** @type {NodeJS.ErrnoException} */ (err).code === 'EADDRINUSE' && left > 0) {
          tryListen(port + 1, left - 1);
        } else {
          reject(err);
        }
      });
      server.listen(port, HOST, () => {
        resolve({ server, url: `http://${HOST}:${server.address().port}` });
      });
    }
    tryListen(startPort, attempts);
  });
}

/** Уже отвечает сервер SupaMe на стандартном порту? (ТЗ 5.1.3 — переиспользуем экземпляр) */
export function probeExisting(startPort = 5180) {
  const url = `http://${HOST}:${startPort}`;
  return fetch(url, { signal: AbortSignal.timeout(1500) })
    .then((r) => (r.ok ? url : null))
    .catch(() => null);
}

export function stopServer(server) {
  if (!server) return Promise.resolve();
  return new Promise((resolve) => server.close(() => resolve()));
}
