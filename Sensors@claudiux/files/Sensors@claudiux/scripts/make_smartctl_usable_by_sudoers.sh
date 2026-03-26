#!/usr/bin/env bash
[[ $UID -eq 0 ]] || exit 1

GROUP=$1
[[ "none" == $GROUP ]] && exit 1

SMARTCTLFILE="/etc/sudoers.d/smartctl"
[[ -x /usr/bin/dnf ]] && {
    # Distro is Fedora!
    [[ -d /etc/sudoersSensors.d ]] || {
        sudo mkdir -p /etc/sudoersSensors.d
        sudo chmod 755 /etc/sudoersSensors.d
        sudo chgrp -f wheel /etc/sudoersSensors.d
    }
    SMARTCTLFILE="/etc/sudoersSensors.d/smartctl"
    line=$(sudo cat /etc/sudoers | grep sudoersSensors )
    [[ -n "$line" ]] || {
        echo "#includedir /etc/sudoersSensors.d" | sudo tee -a /etc/sudoers
    }
}

[[ -x /usr/bin/pacman ]] && {
    # Distro is Arch!
    [[ -d /etc/sudoersSensors.d ]] || {
        sudo mkdir -p /etc/sudoersSensors.d
        sudo chmod 755 /etc/sudoersSensors.d
        sudo chgrp -f wheel /etc/sudoersSensors.d
    }
    SMARTCTLFILE="/etc/sudoersSensors.d/smartctl"
    line=$(sudo cat /etc/sudoers | grep sudoersSensors )
    [[ -n "$line" ]] || {
        echo "@includedir /etc/sudoersSensors.d" | sudo tee -a /etc/sudoers
    }
}

sudo touch $SMARTCTLFILE
sudo chmod 660 $SMARTCTLFILE

[[ "wheel" == $GROUP ]] && {
    echo "%wheel ALL = NOPASSWD:NOLOG_INPUT:NOLOG_OUTPUT:NOMAIL: /usr/sbin/smartctl" | sudo tee $SMARTCTLFILE
    sudo chgrp -f wheel $SMARTCTLFILE
}

[[ "sudo" == $GROUP ]] && {
    echo "%sudo ALL = NOPASSWD:NOLOG_INPUT:NOLOG_OUTPUT:NOMAIL: /usr/sbin/smartctl" | sudo tee $SMARTCTLFILE
    sudo chgrp -f sudo $SMARTCTLFILE
}

sudo chmod 440 $SMARTCTLFILE

exit 0
