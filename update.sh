#!/usr/bin/env bash
set -e

echo "==================================================================="
echo "  Обновление Remaining Limits Mod (macOS / Linux)"
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

# 1. Обновление скрипта
cp "$SCRIPT_DIR/remaining-limits.js" "$ION_DIR/remaining-limits.js"
echo "✅ Файл remaining-limits.js обновлен"

# 2. Проверка подключения
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
  echo "✅ Подключение в index.html восстановлено"
else
  echo "✅ Мод подключен в index.html"
fi

echo ""
echo "🚀 Обновление завершено! Нажмите Cmd+R / Ctrl+R в Claude Desktop."
