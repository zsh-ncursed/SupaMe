// SupaMe: иконка в трее с меню «Открыть» / «Выход» (вместо скриптов запуска).
// Локальный сервис + браузер, как в ТЗ (вариант A); Electron не используется.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, probeExisting, openBrowser, stopServer } from './server.mjs';

let server = null;
let url = null;
let systray = null;
let shuttingDown = false;

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    systray?.kill?.();
  } catch {
    /* бинарник трея мог уже умереть */
  }
  await stopServer(server);
  process.exit(0);
}

async function main() {
  // ТЗ 5.1.3: если сервис уже работает — переиспользуем
  const existing = await probeExisting();
  if (existing) {
    url = existing;
    console.log(`SupaMe уже запущен: ${existing}`);
  } else {
    if (!fs.existsSync(new URL('../dist/index.html', import.meta.url))) {
      console.error('Не найдена сборка. Сначала: npm run build');
      process.exit(1);
    }
    ({ server, url } = await startServer());
    console.log(`SupaMe: ${url}`);
  }

  // Иконка в трее: «Открыть» и «Выход»
  try {
    const mod = await import('systray2');
    // CJS-интероп: module.exports = { default: [class Systray] }
    const pkg = mod.default ?? mod;
    const Systray = typeof pkg === 'function' ? pkg : (pkg.default ?? pkg);
    if (typeof Systray !== 'function') {
      throw new Error('неожиданный экспорт модуля systray2');
    }

    // npm может снять бит исполнения с бинарника — чиним перед запуском
    const binName =
      process.platform === 'win32'
        ? 'tray_windows_release.exe'
        : `tray_${process.platform}_release`;
    const binPath = path.join(
      path.dirname(fileURLToPath(import.meta.resolve('systray2'))),
      'traybin',
      binName
    );
    try {
      fs.accessSync(binPath, fs.constants.X_OK);
    } catch {
      fs.chmodSync(binPath, 0o755);
    }

    const icon = fs.readFileSync(new URL('./tray.png', import.meta.url)).toString('base64');

    systray = new Systray({
      menu: {
        icon,
        title: 'SupaMe',
        tooltip: `SupaMe — ${url}`,
        items: [
          {
            id: 'open',
            title: 'Открыть',
            tooltip: 'Открыть редактор в браузере',
            checked: false,
            enabled: true,
          },
          {
            id: 'quit',
            title: 'Выход',
            tooltip: 'Остановить и выйти',
            checked: false,
            enabled: true,
          },
        ],
      },
      debug: false,
      copyDir: false,
    });

    // Если бинарник трея умер (нет графической среды) — остаёмся в консольном режиме
    try {
      systray.onExit?.((code) => {
        console.error(`Трей остановлен (код ${code}). Откройте ${url} в браузере.`);
      });
    } catch {
      /* процесс трея уже не существует */
    }

    systray.onClick((action) => {
      const id = action.item_id ?? String(action.seq_id);
      if (id === 'open' || action.seq_id === 0) {
        openBrowser(url);
      } else if (id === 'quit' || action.seq_id === 1) {
        void shutdown();
      }
    });
  } catch (err) {
    // Нет графической среды или утилита трея недоступна — режим консоли
    console.error(`Трей недоступен (${err.message}). Откройте ${url} в браузере.`);
    openBrowser(url);
  }

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

void main();
