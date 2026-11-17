#!/usr/bin/env bash
set -euo pipefail

UUID="mouse-power-saver@doctorshoe"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APPLET_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET_APPLET_DIR="$HOME/.local/share/cinnamon/applets/$UUID"

declare -a VENDORS
declare -a PRODUCTS
declare -a NAMES
declare -a PATHS
declare -A SEEN
COUNT=0

find_usb_mice() {
    COUNT=0

    for e in /sys/class/input/event*; do
        [[ -e "$e" ]] || continue

        local props
        props="$(udevadm info -q property -p "$e" 2>/dev/null || true)"

        echo "$props" | grep -q '^ID_INPUT_MOUSE=1$' || continue

        local p
        p="$(readlink -f "$e/device")"

        while [[ "$p" != "/" && "$p" != "/sys" ]]; do
            if [[ -f "$p/idVendor" && -f "$p/idProduct" && -d "$p/power" ]]; then
                local vendor product name key
                vendor="$(cat "$p/idVendor")"
                product="$(cat "$p/idProduct")"
                vendor="${vendor,,}"
                product="${product,,}"
                name="$(cat "$p/product" 2>/dev/null || echo "USB mouse")"
                key="$vendor:$product"

                if [[ -z "${SEEN[$key]+x}" ]]; then
                    SEEN[$key]=1
                    VENDORS[$COUNT]="$vendor"
                    PRODUCTS[$COUNT]="$product"
                    NAMES[$COUNT]="$name"
                    PATHS[$COUNT]="$(basename "$p")"
                    COUNT=$((COUNT + 1))
                fi

                break
            fi

            p="$(dirname "$p")"
        done
    done
}

echo "Mouse Power Saver by DoctorShoe"
echo

find_usb_mice

if [[ "$COUNT" -eq 0 ]]; then
    echo "Keine USB-Maus gefunden."
    echo "Hinweis: Bluetooth-Mäuse und manche Funkmäuse werden derzeit nicht unterstützt."
    exit 1
fi

echo "Gefundene USB-Mäuse:"
echo

for ((i=0; i<COUNT; i++)); do
    nr=$((i + 1))
    echo "[$nr] ${NAMES[$i]}  ${VENDORS[$i]}:${PRODUCTS[$i]}  (${PATHS[$i]})"
done

echo

if [[ "$COUNT" -eq 1 ]]; then
    choice=1
    echo "Es wurde nur eine USB-Maus gefunden. Auswahl: 1"
else
    read -rp "Welche Maus soll Mouse Power Saver steuern? [1-$COUNT]: " choice
fi

if ! [[ "$choice" =~ ^[0-9]+$ ]] || [[ "$choice" -lt 1 ]] || [[ "$choice" -gt "$COUNT" ]]; then
    echo "Ungültige Auswahl."
    exit 1
fi

idx=$((choice - 1))
vendor="${VENDORS[$idx]}"
product="${PRODUCTS[$idx]}"
name="${NAMES[$idx]}"

echo
echo "Gewählte Maus:"
echo "$name  $vendor:$product"
echo

echo "Installiere Applet nach:"
echo "$TARGET_APPLET_DIR"
echo

rm -rf "$TARGET_APPLET_DIR"
mkdir -p "$(dirname "$TARGET_APPLET_DIR")"
cp -a "$APPLET_DIR" "$TARGET_APPLET_DIR"

echo "Installiere Helper nach /usr/local/bin"
sudo cp "$APPLET_DIR/scripts/mouse-power-saver" /usr/local/bin/mouse-power-saver
sudo cp "$APPLET_DIR/scripts/mouse-power-saver-gui" /usr/local/bin/mouse-power-saver-gui
sudo chown root:root /usr/local/bin/mouse-power-saver /usr/local/bin/mouse-power-saver-gui
sudo chmod 755 /usr/local/bin/mouse-power-saver /usr/local/bin/mouse-power-saver-gui

echo "Schreibe Konfiguration nach /etc/mouse-power-saver.conf"
sudo tee /etc/mouse-power-saver.conf >/dev/null <<EOC
# Mouse Power Saver by DoctorShoe
VENDOR="$vendor"
PRODUCT="$product"
DEVICE_NAME="$name"
EOC

sudo chown root:root /etc/mouse-power-saver.conf
sudo chmod 644 /etc/mouse-power-saver.conf

user_name="$(id -un)"

echo "Richte eng begrenzte sudo-Regel ein"
sudo tee /etc/sudoers.d/mouse-power-saver >/dev/null <<EOS
$user_name ALL=(root) NOPASSWD: /usr/local/bin/mouse-power-saver on 10000
$user_name ALL=(root) NOPASSWD: /usr/local/bin/mouse-power-saver on 20000
$user_name ALL=(root) NOPASSWD: /usr/local/bin/mouse-power-saver on 30000
$user_name ALL=(root) NOPASSWD: /usr/local/bin/mouse-power-saver on 60000
$user_name ALL=(root) NOPASSWD: /usr/local/bin/mouse-power-saver off
EOS

sudo chmod 440 /etc/sudoers.d/mouse-power-saver
sudo visudo -cf /etc/sudoers.d/mouse-power-saver

echo "Setze Standard: 1 Minute"
sudo /usr/local/bin/mouse-power-saver on 60000

echo
echo "Fertig."
echo
echo "Bitte Cinnamon neu laden:"
echo "  Alt + F2, dann r, dann Enter"
echo
echo "Danach Applet hinzufügen:"
echo "  Rechtsklick auf Leiste → Applets → Mouse Power Saver → Hinzufügen"
