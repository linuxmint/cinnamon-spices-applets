#!/bin/bash
# Instalador de Media Clock para Cinnamon
set -e

UUID="media-clock@Juanes767"
DEST="$HOME/.local/share/cinnamon/applets/$UUID"

echo "Instalando Media Clock..."
mkdir -p "$HOME/.local/share/cinnamon/applets"
rm -rf "$DEST"
cp -r "$(dirname "$0")" "$DEST"

echo "Listo. Reinicia Cinnamon con Ctrl + Alt + Esc"
echo "Luego anade el applet: clic derecho en el panel -> Applets -> Administrar"
