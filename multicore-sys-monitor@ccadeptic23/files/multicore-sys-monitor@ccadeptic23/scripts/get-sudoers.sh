#!/bin/bash
###
# Returns the comma-separated list of sudoers.
###

sudoers1=$(getent group sudo | sed -e "s/:/ /g" | awk '{print$4}')
sudoers2=$(getent group wheel | sed -e "s/:/ /g" | awk '{print$4}')

[ -z $sudoers2 ] && {
        echo "$sudoers1"
        exit 0
} || {
        [ -z $sudoers1 ] && {
                echo "$sudoers2"
                exit 0
        } || {
                echo "$sudoers1,$sudoers2"
                exit 0
        }
}

exit 1
