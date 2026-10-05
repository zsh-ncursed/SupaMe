#!/usr/bin/env bash
# SupaMe: остановка приложения
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PID_FILE="$DIR/.supame.pid"

stop_pid() {
  local pid="$1"
  kill -0 "$pid" 2>/dev/null || return 0
  kill "$pid" 2>/dev/null || true
  for _ in $(seq 1 40); do
    kill -0 "$pid" 2>/dev/null || return 0
    sleep 0.1
  done
  kill -9 "$pid" 2>/dev/null || true
}

stopped=0

# Основной способ: pid-файл
if [ -f "$PID_FILE" ]; then
  PID="$(cat "$PID_FILE")"
  if kill -0 "$PID" 2>/dev/null; then
    stop_pid "$PID"
    echo "SupaMe остановлен (PID $PID)"
    stopped=1
  else
    echo "Процесс из pid-файла уже не работает"
  fi
  rm -f "$PID_FILE"
fi

# Страховка: процессы launcher.mjs из директории этого проекта (например, после сбоя)
PIDS="$(pgrep -f 'node .*launcher\.mjs' 2>/dev/null || true)"
for p in $PIDS; do
  cwd="$(readlink "/proc/$p/cwd" 2>/dev/null || true)"
  if [ "$cwd" = "$DIR" ]; then
    stop_pid "$p"
    echo "Остановлен процесс (PID $p)"
    stopped=1
  fi
done

if [ "$stopped" = "0" ]; then
  echo "SupaMe не запущен"
fi

exit 0
