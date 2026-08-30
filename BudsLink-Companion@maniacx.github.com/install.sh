#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

UUID="BudsLink-Companion@maniacx.github.com"
SOURCE_DIR="$SCRIPT_DIR/files/$UUID"
APPLET_DIR="$HOME/.local/share/cinnamon/applets/$UUID"

echo "Installing applet BudsLink-Companion"

rm -rf "$APPLET_DIR"
mkdir -p "$APPLET_DIR"

cp "$SOURCE_DIR/applet.js" \
   "$SOURCE_DIR/metadata.json" \
   "$SOURCE_DIR/settings-schema.json" \
   "$SOURCE_DIR/stylesheet.css" \
   "$APPLET_DIR"

cp -r "$SOURCE_DIR/lib" "$APPLET_DIR"
cp -r "$SOURCE_DIR/icons" "$APPLET_DIR"
cp "$SOURCE_DIR/icon.png" "$APPLET_DIR"

if compgen -G "$SOURCE_DIR/po/*.po" > /dev/null; then
    for po in "$SOURCE_DIR"/po/*.po; do
        lang=$(basename "$po" .po)

        mkdir -p "$HOME/.local/share/locale/$lang/LC_MESSAGES"

        msgfmt "$po" -o "$HOME/.local/share/locale/$lang/LC_MESSAGES/$UUID.mo"
    done
fi

if ! cinnamon-dbus-command ReloadXlet "$UUID" APPLET; then
    echo "Restart Cinnamon to load the applet:"
    echo "  X11:     Alt+F2, then enter 'r'"
    echo "  Wayland: Log out and log back in"
fi

echo "Done."
