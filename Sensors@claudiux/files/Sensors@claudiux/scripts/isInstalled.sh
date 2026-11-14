#!/usr/bin/env bash
PKs=$@
#~ LANG=C pkcon -p search name $PKs | grep Installed | head -n 1 | awk '{print $1}'
LANG=C pkcon -p resolve $PKs | grep Installed | head -n 1 | awk '{print $1}'
exit 0
