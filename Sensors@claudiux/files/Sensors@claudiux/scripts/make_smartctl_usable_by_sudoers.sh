#!/bin/bash
[[ $UID -eq 0 ]] || exit 1

echo "%sudo ALL = NOPASSWD:NOLOG_INPUT:NOLOG_OUTPUT: /usr/sbin/smartctl" | sudo tee "/etc/sudoers.d/smartctl"
echo "%wheel ALL = NOPASSWD:NOLOG_INPUT:NOLOG_OUTPUT: /usr/sbin/smartctl" | sudo tee -a "/etc/sudoers.d/smartctl"

exit 0
