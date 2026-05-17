#!/usr/bin/env bash
set -euo pipefail
UUID="creature@AIapplet"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$UUID"
DEST="$HOME/.local/share/cinnamon/applets/$UUID"
mkdir -p "$HOME/.local/share/cinnamon/applets"
rm -rf "$DEST"
cp -a "$SRC_DIR" "$DEST"
mkdir -p "$DEST/profil_picture" "$DEST/animations"
if [ ! -f "$DEST/profil_picture/roberto.png" ]; then
  if [ -f "$DEST/animations/roberto.png" ]; then
    cp "$DEST/animations/roberto.png" "$DEST/profil_picture/roberto.png"
  elif [ -f "$DEST/icon.png" ]; then
    cp "$DEST/icon.png" "$DEST/profil_picture/roberto.png"
  fi
fi
find "$DEST" -type d -name '__pycache__' -prune -exec rm -rf {} + 2>/dev/null || true
find "$DEST" -type f -name '*.pyc' -delete 2>/dev/null || true
python3 -m json.tool "$DEST/metadata.json" >/dev/null
python3 -m json.tool "$DEST/settings-schema.json" >/dev/null
python3 -m json.tool "$DEST/settings-schema.en.json" >/dev/null
python3 -m json.tool "$DEST/creature-library.json" >/dev/null
python3 -m json.tool "$DEST/i18n/fr.json" >/dev/null
python3 -m json.tool "$DEST/i18n/en.json" >/dev/null
echo "Créature installée dans $DEST"
echo "Recharge Cinnamon avec : cinnamon --replace"
