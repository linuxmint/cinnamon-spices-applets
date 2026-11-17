#!/usr/bin/env bash
set -euo pipefail

UUID="mouse-power-saver@doctorshoe"
TARGET_APPLET_DIR="$HOME/.local/share/cinnamon/applets/$UUID"

echo "Deinstalliere Mouse Power Saver by DoctorShoe"
echo

if command -v /usr/local/bin/mouse-power-saver >/dev/null 2>&1; then
    echo "Setze Maus zurück auf Normalbetrieb ..."
    sudo /usr/local/bin/mouse-power-saver off || true
fi

echo "Entferne Applet ..."
rm -rf "$TARGET_APPLET_DIR"

echo "Entferne Helper, Konfiguration, sudo-Regel und udev-Regel ..."
sudo rm -f /usr/local/bin/mouse-power-saver
sudo rm -f /usr/local/bin/mouse-power-saver-gui
sudo rm -f /etc/mouse-power-saver.conf
sudo rm -f /etc/sudoers.d/mouse-power-saver
sudo rm -f /etc/udev/rules.d/90-usb-mouse-autosuspend.rules

sudo udevadm control --reload-rules || true

echo
echo "Fertig."
echo "Bitte Cinnamon neu laden: Alt + F2, r, Enter"
