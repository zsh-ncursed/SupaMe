// SupaMe: запуск локального сервиса без трея (headless/CLI-режим).
// Открывает браузер и держит сервер в foreground (Ctrl+C — выход).
import fs from 'node:fs';
import { startServer, probeExisting, openBrowser, stopServer } from './server.mjs';

async function main() {
  const existing = await probeExisting();
  if (existing) {
    console.log(`SupaMe уже запущен: ${existing}`);
    openBrowser(existing);
    return;
  }
  if (!fs.existsSync(new URL('../dist/index.html', import.meta.url))) {
    console.error('Не найдена сборка. Сначала: npm run build');
    process.exit(1);
  }

  const { server, url } = await startServer();
  console.log(`SupaMe запущен: ${url}`);
  console.log('Ctrl+C — остановка');
  openBrowser(url);

  process.on('SIGINT', () => void stopServer(server));
  process.on('SIGTERM', () => void stopServer(server));
}

void main();
