@echo off
rem SupaMe: первоначальный запуск в одну команду (Windows)
rem   supame.cmd            - установить (если нужно), собрать (если нужно), запустить трей
rem   supame.cmd --rebuild  - принудительно пересобрать
setlocal
cd /d "%~dp0"

set REBUILD=0
if "%~1"=="--rebuild" set REBUILD=1

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js не найден. Установите Node.js 20+ с https://nodejs.org
  pause
  exit /b 1
)

if not exist node_modules (
  echo Установка зависимостей ^(одноразовая^)...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto fail
)

if not exist dist\index.html set REBUILD=1
if "%REBUILD%"=="1" (
  echo Сборка приложения...
  call npm run build
  if errorlevel 1 goto fail
)

echo Запуск SupaMe - смотрите иконку в трее: Открыть / Выход
start "SupaMe" /min node desktop\tray.mjs
timeout /t 2 >nul
echo Готово. Редактор откроется в браузере по пункту «Открыть» в трее.
exit /b 0

:fail
echo Ошибка. Проверьте вывод выше.
pause
exit /b 1
