#!/usr/bin/env bash
[[ $UID -eq 0 ]] || exit 1

GROUP=$1
[[ "none" == $GROUP ]] && exit 1

SMARTCTLFILE="/etc/sudoers.d/smartctl"

sudo touch $SMARTCTLFILE
sudo chmod 660 $SMARTCTLFILE

[[ "wheel" == $GROUP ]] && {
    #~ echo "%wheel ALL = NOPASSWD:NOLOG_INPUT:NOLOG_OUTPUT:NOMAIL: /usr/sbin/smartctl" | sudo tee -a $SMARTCTLFILE
    echo "%wheel ALL = NOPASSWD:NOLOG_INPUT:NOLOG_OUTPUT:NOMAIL: /usr/sbin/smartctl" | sudo tee $SMARTCTLFILE
    #~ sudo chgrp -f wheel /etc/sudoers.d $SMARTCTLFILE
    sudo chgrp -f wheel $SMARTCTLFILE
}

[[ "sudo" == $GROUP ]] && {
    echo "%sudo ALL = NOPASSWD:NOLOG_INPUT:NOLOG_OUTPUT:NOMAIL: /usr/sbin/smartctl" | sudo tee $SMARTCTLFILE
    #~ sudo chgrp -f sudo /etc/sudoers.d $SMARTCTLFILE
    sudo chgrp -f sudo $SMARTCTLFILE
}

sudo chmod 440 $SMARTCTLFILE

exit 0
