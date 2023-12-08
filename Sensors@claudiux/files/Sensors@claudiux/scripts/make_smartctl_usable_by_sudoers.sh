#!/bin/bash
[[ $UID -eq 0 ]] || exit 1

GROUP=$1
[[ "none" == $GROUP ]] && exit 1


echo "%sudo ALL = NOPASSWD:NOLOG_INPUT:NOLOG_OUTPUT:NOMAIL: /usr/sbin/smartctl" | sudo tee "/etc/sudoers.d/smartctl"
echo "%wheel ALL = NOPASSWD:NOLOG_INPUT:NOLOG_OUTPUT:NOMAIL: /usr/sbin/smartctl" | sudo tee -a "/etc/sudoers.d/smartctl"
#~ sudo chmod +r /etc/sudoers.d/smartctl

#~ echo $(groups)

#~ for gr in $(groups); do [[ "wheel" == $gr ]] && sudo chgrp -f wheel /etc/sudoers.d ; done

#~ for gr in $(groups); do [[ "sudo" == $gr ]] && sudo chgrp -f sudo /etc/sudoers.d ; done

[[ "wheel" == $GROUP ]] && sudo chgrp -f wheel /etc/sudoers.d /etc/sudoers.d/smartctl

[[ "sudo" == $GROUP ]] && sudo chgrp -f sudo /etc/sudoers.d /etc/sudoers.d/smartctl

exit 0
