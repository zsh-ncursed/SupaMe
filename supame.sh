#!/usr/bin/env bash
# SupaMe: первоначальный запуск в одну команду.
#   ./supame.sh            — установить (если нужно), собрать (если нужно), запустить трей
#   ./supame.sh --rebuild  — принудительно пересобрать
#   ./supame.sh --browser  — без трея: сервер + браузер в терминале (Ctrl+C — выход)
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

PID_FILE="$DIR/.supame.pid"
LOG_FILE="$DIR/.supame.log"

REBUILD=0
BROWSER=0
for arg in "$@"; do
  case "$arg" in
    --rebuild) REBUILD=1 ;;
    --browser) BROWSER=1 ;;
    *) ;;
  esac
done

command -v node >/dev/null 2>&1 || { echo "Node.js не найден. Установите Node.js 20+ (https://nodejs.org)"; exit 1; }
NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Нужен Node.js 20+, сейчас $(node -v)"
  exit 1
fi

# Уже запущен? (по pid-файлу)
if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  URL="$(grep -o 'http://127\.0\.0\.1:[0-9]*' "$LOG_FILE" 2>/dev/null | tail -1 || true)"
  echo "SupaMe уже запущен${URL:+: $URL}"
  exit 0
fi

# Зависимости (один раз)
if [ ! -d node_modules ]; then
  echo "Установка зависимостей (одноразовая, может занять пару минут)…"
  npm install --no-audit --no-fund
fi

# Сборка (один раз или по флагу)
if [ "$REBUILD" = "1" ] || [ ! -f dist/index.html ]; then
  echo "Сборка приложения…"
  npm run build
fi

# Запуск в фоне: трей (или консольный режим)
CMD="desktop/tray.mjs"
[ "$BROWSER" = "1" ] && CMD="desktop/launcher.mjs"

nohup node "$CMD" >"$LOG_FILE" 2>&1 &
PID=$!
echo "$PID" > "$PID_FILE"

# Ждём появления URL и проверяем ответ (до 30 с)
URL=""
OK=0
for _ in $(seq 1 120); do
  URL="$(grep -o 'http://127\.0\.0\.1:[0-9]*' "$LOG_FILE" 2>/dev/null | tail -1 || true)"
  if [ -n "$URL" ] && curl -sf -o /dev/null "$URL" 2>/dev/null; then
    OK=1
    break
  fi
  if ! kill -0 "$PID" 2>/dev/null; then
    # процесс мог завершиться, переиспользовав уже работающий экземпляр
    if [ -n "$URL" ] && curl -sf -o /dev/null "$URL" 2>/dev/null; then OK=1; break; fi
    echo "Ошибка запуска. Лог:"
    tail -20 "$LOG_FILE" || true
    rm -f "$PID_FILE"
    exit 1
  fi
  sleep 0.25
done

if [ "$OK" != "1" ]; then
  echo "Сервер не ответил за 30 с. Лог: $LOG_FILE"
  exit 1
fi

# При первом запуске сразу открыть редактор в браузере (дальше — через иконку в трее)
xdg-open "$URL" >/dev/null 2>&1 || open "$URL" >/dev/null 2>&1 || true

echo "SupaMe запущен: $URL (PID $PID)"
echo "Управление — иконка в трее: «Открыть» / «Выход»"
