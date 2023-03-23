#!/bin/bash
[[ $UID -eq 0 ]] || exit 1

echo "%sudo ALL = NOPASSWD: /usr/sbin/smartctl" | sudo tee "/etc/sudoers.d/smartctl"
echo "%wheel ALL = NOPASSWD: /usr/sbin/smartctl" | sudo tee -a "/etc/sudoers.d/smartctl"

exit 0
