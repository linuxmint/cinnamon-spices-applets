#!/bin/bash

# WMM File manager Script Router
# Actúa como intermediario para ejecutar el script de Python correcto
# según el escritorio que esté activo en este momento.

SCRIPT_NAME="shell_send_to_monitor.py"

DESKTOP="${XDG_CURRENT_DESKTOP:-${DESKTOP_SESSION:-unknown}}"
DESKTOP=$(echo "$DESKTOP" | tr '[:upper:]' '[:lower:]')
DATA_BASE="${XDG_DATA_HOME:-$HOME/.local/share}"

ROOT=""

case "$DESKTOP" in
    *cinnamon*)
        ROOT="$DATA_BASE/cinnamon/applets/wmm-applet@maki"
        ;;
    *gnome*|*ubuntu*)
        ROOT="$DATA_BASE/gnome-shell/extensions/wmm@maki"
        ;;
    *kde*|*plasma*)
        ROOT="$DATA_BASE/plasma/wallpapers/org.maki.wmm" # Preparado para el futuro
        ;;
    *)
        # Fallback: Si no sabemos el escritorio, buscamos cuál de las instalaciones existe
        if [ -d "$DATA_BASE/cinnamon/applets/wmm-applet@maki" ]; then
            ROOT="$DATA_BASE/cinnamon/applets/wmm-applet@maki"
        elif [ -d "$DATA_BASE/gnome-shell/extensions/wmm@maki" ]; then
            ROOT="$DATA_BASE/gnome-shell/extensions/wmm@maki"
        fi
        ;;
esac

if [ -z "$ROOT" ] || [ ! -d "$ROOT" ]; then
    notify-send -u critical "WMM Error" "No se encontró la instalación de WMM para el escritorio: $DESKTOP"
    exit 1
fi

# Ejecutar el script de Python objetivo con los argumentos restantes
python3 "$ROOT/python/$SCRIPT_NAME" "$@"
