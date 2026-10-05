#!/usr/bin/env bash
# SupaMe: запуск приложения (сборка при необходимости + локальный сервер в фоне)
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

PID_FILE="$DIR/.supame.pid"
LOG_FILE="$DIR/.supame.log"

is_running() {
  [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

if is_running; then
  echo "SupaMe уже запущен (PID $(cat "$PID_FILE")). Остановить: ./stop.sh"
  exit 0
fi

# Сборка: принудительно по флагу --build или если dist отсутствует
if [ "${1:-}" = "--build" ] || [ ! -f "$DIR/dist/index.html" ]; then
  if [ ! -d "$DIR/node_modules" ]; then
    echo "Устанавливаю зависимости…"
    npm install --no-audit --no-fund
  fi
  echo "Сборка приложения…"
  npm run build
fi

# Запуск в фоне
nohup node "$DIR/launcher.mjs" >"$LOG_FILE" 2>&1 &
PID=$!
echo "$PID" > "$PID_FILE"

# Ждём готовности (до ~15 с), порт берём из лога launcher'а
URL=""
for _ in $(seq 1 60); do
  if ! kill -0 "$PID" 2>/dev/null; then
    echo "Ошибка запуска. Последние строки лога:"
    tail -20 "$LOG_FILE" || true
    rm -f "$PID_FILE"
    exit 1
  fi
  URL="$(grep -o 'http://127\.0\.0\.1:[0-9]*' "$LOG_FILE" 2>/dev/null | tail -1 || true)"
  if [ -n "$URL" ] && curl -sf -o /dev/null "$URL"; then
    break
  fi
  sleep 0.25
done

if [ -z "$URL" ]; then
  echo "Сервер не ответил за 15 с. Лог: $LOG_FILE"
  exit 1
fi

echo "SupaMe запущен: $URL (PID $PID)"
echo "Лог: $LOG_FILE"
echo "Остановить: ./stop.sh"
