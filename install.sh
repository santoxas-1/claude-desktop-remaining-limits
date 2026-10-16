#!/usr/bin/env bash
set -e

echo "==================================================================="
echo "  Remaining Limits Mod for Claude Desktop (macOS / Linux)"
echo "==================================================================="
echo ""

CANDIDATES=(
  "/Applications/Claude.app/Contents/Resources/ion-dist"
  "$HOME/Applications/Claude.app/Contents/Resources/ion-dist"
  "/opt/Claude/resources/ion-dist"
  "$HOME/.local/share/Claude/resources/ion-dist"
)

ION_DIR=""
for dir in "${CANDIDATES[@]}"; do
  if [ -d "$dir" ]; then
    ION_DIR="$dir"
    break
  fi
done

if [ -z "$ION_DIR" ]; then
  echo "❌ Ошибка: Директория Claude Desktop ion-dist не найдена!"
  exit 1
fi

echo "📁 Найдено: $ION_DIR"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 1. Резервная копия
if [ ! -f "$ION_DIR/index.html.limits.bak" ]; then
  cp "$ION_DIR/index.html" "$ION_DIR/index.html.limits.bak"
  echo "✅ Создана резервная копия: index.html.limits.bak"
fi

# 2. Копирование скрипта
cp "$SCRIPT_DIR/remaining-limits.js" "$ION_DIR/remaining-limits.js"
echo "✅ Скопирован remaining-limits.js"

# 3. Подключение тега
if ! grep -q "remaining-limits.js" "$ION_DIR/index.html"; then
  TAG='<script src="/remaining-limits.js"></script>'
  if grep -q "cosmic-slider.js" "$ION_DIR/index.html"; then
    sed -i.tmp "s|<script src=\"/cosmic-slider.js\"></script>|<script src=\"/cosmic-slider.js\"></script>$TAG|g" "$ION_DIR/index.html"
  elif grep -q "/i18n-ru.js" "$ION_DIR/index.html"; then
    sed -i.tmp "s|<script src=\"/i18n-ru.js\"></script>|<script src=\"/i18n-ru.js\"></script>$TAG|g" "$ION_DIR/index.html"
  else
    sed -i.tmp "s|<head>|<head>$TAG|g" "$ION_DIR/index.html"
  fi
  rm -f "$ION_DIR/index.html.tmp"
  echo "✅ Тег скрипта добавлен в index.html"
else
  echo "ℹ️ Мод уже был подключен в index.html"
fi

echo ""
echo "🚀 Установка успешно завершена!"
echo "Перезапустите Claude Desktop (Cmd+R или Ctrl+R)."
