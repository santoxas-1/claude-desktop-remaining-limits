#!/usr/bin/env bash
set -e

echo "==================================================================="
echo "  Удаление Remaining Limits Mod (macOS / Linux)"
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

# 1. Удаление скрипта
rm -f "$ION_DIR/remaining-limits.js"
echo "✅ Файл remaining-limits.js удален"

# 2. Восстановление index.html
if [ -f "$ION_DIR/index.html.limits.bak" ]; then
  mv "$ION_DIR/index.html.limits.bak" "$ION_DIR/index.html"
  echo "✅ index.html успешно восстановлен из резервной копии"
else
  sed -i.tmp 's|<script src="/remaining-limits.js"></script>||g' "$ION_DIR/index.html"
  rm -f "$ION_DIR/index.html.tmp"
  echo "✅ Тег скрипта удален из index.html"
fi

echo ""
echo "🚀 Удаление завершено! Перезапустите Claude Desktop."
