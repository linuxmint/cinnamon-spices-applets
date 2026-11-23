#!/bin/sh
# Install the optional udev rule that lets Cinnamon Vantage change the
# battery charge mode without a password prompt. Run this script with sudo.

set -e

DIR=$(dirname "$(readlink -f "$0")")

install -Dm755 "$DIR/udev-perms.sh" /usr/local/lib/cinnamonvantage/udev-perms.sh
install -Dm644 "$DIR/99-cinnamonvantage.rules" /etc/udev/rules.d/99-cinnamonvantage.rules

udevadm control --reload-rules
/usr/local/lib/cinnamonvantage/udev-perms.sh

echo "Cinnamon Vantage udev rule installed."
