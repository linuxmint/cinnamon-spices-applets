#!/bin/bash
# Installs a udev rule making Intel RAPL energy counters readable without root.
# Run via: pkexec bash /path/to/setup-rapl.sh
RULE='SUBSYSTEM=="powercap", KERNEL=="intel-rapl:*", ACTION=="add", RUN+="/bin/chmod o+r /sys%p/energy_uj"'
echo "$RULE" > /etc/udev/rules.d/99-rapl-read.rules
chmod 644 /etc/udev/rules.d/99-rapl-read.rules
udevadm trigger --subsystem-match=powercap
# Apply immediately to already-loaded devices
for f in /sys/class/powercap/intel-rapl*/energy_uj; do
  [ -f "$f" ] && chmod o+r "$f"
done
