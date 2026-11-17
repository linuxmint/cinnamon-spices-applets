#!/bin/sh
# Give members of the plugdev group write access to the Lenovo charge mode
# attributes used by Cinnamon Vantage. Safe to run repeatedly.

for f in \
    /sys/class/power_supply/BAT*/charge_types \
    /sys/bus/platform/drivers/ideapad_acpi/VPC2004:*/conservation_mode
do
    [ -e "$f" ] || continue
    /bin/chgrp plugdev "$f" 2>/dev/null
    /bin/chmod 0660 "$f" 2>/dev/null
done

exit 0
