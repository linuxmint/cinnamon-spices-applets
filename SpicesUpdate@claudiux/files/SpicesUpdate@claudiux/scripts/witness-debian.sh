#!/bin/sh
ret=$(hostnamectl | grep System | sed "s/: /%/" | cut -d'%' -f2 | cut -d' ' -f1)
if [ "$ret" = "Debian" ]; then
    touch /tmp/DEBIAN;
fi
exit 0
