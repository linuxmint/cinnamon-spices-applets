#!/usr/bin/env bash

for pid in $(systemd-inhibit --list --mode=block --no-legend --who=$USER | awk '{print $5}'); do killall -9 $pid ; done
