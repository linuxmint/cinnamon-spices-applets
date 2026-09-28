#!/bin/sh

##
## Find the user directory in the prefix
##

prefix=$1; shift
wine_cmd=$1; shift

userdir=$(WINEPREFIX="${prefix}" "${wine_cmd}" "cmd" "/c" "echo" "%UserProfile%" | tr -d '\r' | grep -E "^[^[:cntrl:]]+" -)
echo "${userdir}"

